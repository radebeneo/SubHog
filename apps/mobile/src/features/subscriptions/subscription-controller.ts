import {
  ApiError,
  RequestSessionScope,
  type RequestOptions,
} from "@subhog/api-client";
import type {
  CreateSubscriptionRequest,
  IdentityDto,
  ProvisionedIdentityDto,
  SubscriptionDto,
  UpdateSubscriptionRequest,
} from "@subhog/contracts";

export type SubscriptionAction =
  | "create"
  | "get"
  | "update"
  | "cancel"
  | "delete";

export type SubscriptionOperation =
  | "configuration"
  | "identity"
  | "provision"
  | "subscriptions"
  | SubscriptionAction;

export interface SubscriptionFailure {
  operation: SubscriptionOperation;
  code: string;
  kind: string;
  message: string;
  retryable: boolean;
  mutationMayHaveCompleted: boolean;
}

export type SubscriptionState =
  | { status: "authentication-loading" }
  | { status: "signed-out" }
  | { status: "resolving-identity" }
  | { status: "unprovisioned"; identity: IdentityDto }
  | { status: "provisioning"; identity: IdentityDto }
  | { status: "loading-subscriptions"; identity: IdentityDto }
  | {
      status: "ready";
      identity: IdentityDto;
      subscriptions: SubscriptionDto[];
    }
  | {
      status: "error";
      identity: IdentityDto | null;
      failure: SubscriptionFailure;
    };

export type AuthSnapshot =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; userId: string; sessionId: string };

type SubscriptionActionSuccessState = {
  status: "success";
  operation: SubscriptionAction;
  subscriptionId?: string;
  subscription?: SubscriptionDto;
};

type SubscriptionActionFailureState = {
  status: "validation-error" | "error" | "ambiguous";
  operation: SubscriptionAction;
  subscriptionId?: string;
  failure: SubscriptionFailure;
};

export type SubscriptionActionState =
  | { status: "idle" }
  | {
      status: "pending";
      operation: SubscriptionAction;
      subscriptionId?: string;
    }
  | SubscriptionActionSuccessState
  | SubscriptionActionFailureState;

export type SubscriptionActionResult =
  | Exclude<SubscriptionActionState, { status: "idle" | "pending" }>
  | {
      status: "stale";
      operation: SubscriptionAction;
      subscriptionId?: string;
    };

export interface SubscriptionApi {
  getIdentity(options?: RequestOptions): Promise<IdentityDto>;
  provisionIdentity(options?: RequestOptions): Promise<ProvisionedIdentityDto>;
  listSubscriptions(
    userId: string,
    options?: RequestOptions,
  ): Promise<SubscriptionDto[]>;
  getSubscription(
    id: string,
    options?: RequestOptions,
  ): Promise<SubscriptionDto>;
  createSubscription(
    payload: CreateSubscriptionRequest,
    options?: RequestOptions,
  ): Promise<SubscriptionDto>;
  updateSubscription(
    id: string,
    payload: UpdateSubscriptionRequest,
    options?: RequestOptions,
  ): Promise<SubscriptionDto>;
  cancelSubscription(
    id: string,
    options?: RequestOptions,
  ): Promise<SubscriptionDto>;
  deleteSubscription(id: string, options?: RequestOptions): Promise<void>;
}

type Listener = () => void;

interface ReadySession {
  generation: number;
  actionSequence: number;
  identity: IdentityDto & { userId: string };
  scope: RequestSessionScope;
  subscriptions: SubscriptionDto[];
}

export class SubscriptionController {
  private readonly api: SubscriptionApi;
  private state: SubscriptionState = { status: "authentication-loading" };
  private actionState: SubscriptionActionState = { status: "idle" };
  private readonly listeners = new Set<Listener>();
  private generation = 0;
  private actionSequence = 0;
  private sessionKey: string | null = null;
  private clerkUserId: string | null = null;
  private scope: RequestSessionScope | null = null;
  private provisioning: Promise<void> | null = null;

  constructor(api: SubscriptionApi) {
    this.api = api;
  }

  getState = (): SubscriptionState => this.state;
  getActionState = (): SubscriptionActionState => this.actionState;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  updateAuth(auth: AuthSnapshot): void {
    const nextKey =
      auth.status === "signed-in" ? `${auth.userId}:${auth.sessionId}` : null;
    if (
      auth.status === "signed-in" &&
      this.sessionKey === nextKey &&
      this.scope?.isCurrent()
    ) {
      return;
    }

    this.invalidate();
    if (auth.status === "loading") {
      this.setState({ status: "authentication-loading" });
      return;
    }
    if (auth.status === "signed-out") {
      this.setState({ status: "signed-out" });
      return;
    }

    this.sessionKey = nextKey;
    this.clerkUserId = auth.userId;
    this.scope = new RequestSessionScope();
    void this.resolveIdentity();
  }

  retry = async (): Promise<void> => {
    if (!this.scope?.isCurrent()) return;
    if (
      this.state.status === "error" &&
      this.state.failure.operation === "subscriptions" &&
      this.state.identity?.userId
    ) {
      await this.loadSubscriptions(
        this.state.identity,
        this.state.identity.userId,
      );
      return;
    }
    await this.resolveIdentity();
  };

  provision = (): Promise<void> => {
    if (this.provisioning) return this.provisioning;
    const identity =
      this.state.status === "unprovisioned"
        ? this.state.identity
        : this.state.status === "error" &&
            this.state.failure.operation === "provision" &&
            (this.state.failure.retryable ||
              this.state.failure.code === "PROFILE_INCOMPLETE")
          ? this.state.identity
          : null;
    if (!identity || !this.scope?.isCurrent()) return Promise.resolve();

    const generation = this.generation;
    const scope = this.scope;
    this.setState({ status: "provisioning", identity });
    const request = this.api
      .provisionIdentity({ scope })
      .then(async (provisioned) => {
        if (!this.isCurrent(generation, scope)) return;
        this.assertClerkUser(provisioned.clerkUserId);
        const resolved: IdentityDto = {
          provider: provisioned.provider,
          clerkUserId: provisioned.clerkUserId,
          userId: provisioned.userId,
          provisioned: true,
        };
        await this.loadSubscriptions(resolved, provisioned.userId, generation);
      })
      .catch((error: unknown) => {
        if (!this.isCurrent(generation, scope)) return;
        this.setFailure(
          "provision",
          error,
          identity,
          isAmbiguousMutationFailure(error),
        );
      })
      .finally(() => {
        if (this.provisioning === request) this.provisioning = null;
      });
    this.provisioning = request;
    return request;
  };

  clearAction = (): void => {
    this.actionSequence += 1;
    if (this.actionState.status !== "idle") {
      this.setActionState({ status: "idle" });
    }
  };

  getSubscription = async (id: string): Promise<SubscriptionActionResult> => {
    const session = this.startAction("get", id);
    if (!session) return unavailableResult("get", id);

    try {
      const subscription = await this.api.getSubscription(id, {
        scope: session.scope,
      });
      if (!this.isCurrentAction(session)) return staleResult("get", id);
      this.assertSubscriptionOwner(subscription, session.identity.userId);
      this.replaceCanonicalSubscription(session.identity, subscription);
      const result = successResult("get", id, subscription);
      this.setActionState(result);
      return result;
    } catch (error) {
      if (!this.isCurrentAction(session) || isCancellation(error)) {
        return staleResult("get", id);
      }
      return this.setActionFailure("get", error, id, false);
    }
  };

  createSubscription = (
    payload: CreateSubscriptionRequest,
  ): Promise<SubscriptionActionResult> =>
    this.runMutation(
      "create",
      undefined,
      (scope) => this.api.createSubscription(payload, { scope }),
      (subscriptions, previous, response) => {
        if (response) {
          return subscriptions.find((item) => item._id === response._id);
        }
        return subscriptions.find(
          (item) =>
            !previous.some((existing) => existing._id === item._id) &&
            matchesCreatePayload(item, payload),
        );
      },
    );

  updateSubscription = (
    id: string,
    payload: UpdateSubscriptionRequest,
  ): Promise<SubscriptionActionResult> =>
    this.runMutation(
      "update",
      id,
      (scope) => this.api.updateSubscription(id, payload, { scope }),
      (subscriptions) => {
        const subscription = subscriptions.find((item) => item._id === id);
        return subscription && matchesUpdatePayload(subscription, payload)
          ? subscription
          : undefined;
      },
    );

  cancelSubscription = (id: string): Promise<SubscriptionActionResult> =>
    this.runMutation(
      "cancel",
      id,
      (scope) => this.api.cancelSubscription(id, { scope }),
      (subscriptions) =>
        subscriptions.find(
          (item) => item._id === id && item.status === "cancelled",
        ),
    );

  deleteSubscription = (id: string): Promise<SubscriptionActionResult> =>
    this.runMutation(
      "delete",
      id,
      async (scope) => {
        await this.api.deleteSubscription(id, { scope });
      },
      (subscriptions) =>
        subscriptions.some((item) => item._id === id) ? undefined : true,
    );

  dispose(): void {
    this.invalidate();
    this.listeners.clear();
  }

  private async resolveIdentity(): Promise<void> {
    const scope = this.scope;
    if (!scope?.isCurrent()) return;
    const generation = this.generation;
    this.setState({ status: "resolving-identity" });
    try {
      const identity = await this.api.getIdentity({ scope });
      if (!this.isCurrent(generation, scope)) return;
      this.assertClerkUser(identity.clerkUserId);
      if (!identity.provisioned || !identity.userId) {
        this.setState({ status: "unprovisioned", identity });
        return;
      }
      await this.loadSubscriptions(identity, identity.userId, generation);
    } catch (error) {
      if (!this.isCurrent(generation, scope) || isCancellation(error)) return;
      this.setFailure("identity", error, null, false);
    }
  }

  private async loadSubscriptions(
    identity: IdentityDto,
    apiUserId: string,
    generation = this.generation,
  ): Promise<void> {
    const scope = this.scope;
    if (!scope?.isCurrent() || generation !== this.generation) return;
    this.setState({ status: "loading-subscriptions", identity });
    try {
      const subscriptions = await this.api.listSubscriptions(apiUserId, {
        scope,
      });
      if (!this.isCurrent(generation, scope)) return;
      this.assertSubscriptionOwners(subscriptions, apiUserId);
      this.setState({ status: "ready", identity, subscriptions });
    } catch (error) {
      if (!this.isCurrent(generation, scope) || isCancellation(error)) return;
      this.setFailure("subscriptions", error, identity, false);
    }
  }

  private async runMutation(
    operation: Exclude<SubscriptionAction, "get">,
    subscriptionId: string | undefined,
    request: (
      scope: RequestSessionScope,
    ) => Promise<SubscriptionDto | undefined>,
    confirm: (
      subscriptions: SubscriptionDto[],
      previous: SubscriptionDto[],
      response?: SubscriptionDto,
    ) => SubscriptionDto | true | undefined,
  ): Promise<SubscriptionActionResult> {
    const session = this.startAction(operation, subscriptionId);
    if (!session) return unavailableResult(operation, subscriptionId);

    let response: SubscriptionDto | undefined;
    try {
      response = await request(session.scope);
      if (!this.isCurrentAction(session)) {
        return staleResult(operation, subscriptionId);
      }
      if (response) {
        this.assertSubscriptionOwner(response, session.identity.userId);
      }
    } catch (error) {
      if (!this.isCurrentAction(session)) {
        return staleResult(operation, subscriptionId);
      }
      if (!isAmbiguousMutationFailure(error)) {
        return this.setActionFailure(operation, error, subscriptionId, false);
      }
      return this.reconcileAmbiguousMutation(
        session,
        operation,
        subscriptionId,
        error,
        confirm,
      );
    }

    try {
      const subscriptions = await this.fetchCanonicalSubscriptions(session);
      if (!subscriptions) return staleResult(operation, subscriptionId);
      const canonical = confirm(
        subscriptions,
        session.subscriptions,
        response,
      );
      if (!canonical) {
        return this.setActionFailure(
          operation,
          new ApiError("The server result could not be confirmed.", {
            code: "SUBSCRIPTION_WRITE_FAILED",
            kind: "server",
            retryable: true,
          }),
          subscriptionId,
          true,
        );
      }
      const result = successResult(operation, subscriptionId, canonical);
      this.setActionState(result);
      return result;
    } catch (error) {
      if (!this.isCurrentAction(session)) {
        return staleResult(operation, subscriptionId);
      }
      return this.setActionFailure(operation, error, subscriptionId, true);
    }
  }

  private async reconcileAmbiguousMutation(
    session: ReadySession,
    operation: Exclude<SubscriptionAction, "get">,
    subscriptionId: string | undefined,
    mutationError: unknown,
    confirm: (
      subscriptions: SubscriptionDto[],
      previous: SubscriptionDto[],
      response?: SubscriptionDto,
    ) => SubscriptionDto | true | undefined,
  ): Promise<SubscriptionActionResult> {
    try {
      const subscriptions = await this.fetchCanonicalSubscriptions(session);
      if (!subscriptions) return staleResult(operation, subscriptionId);
      const canonical = confirm(subscriptions, session.subscriptions);
      if (canonical) {
        const result = successResult(operation, subscriptionId, canonical);
        this.setActionState(result);
        return result;
      }
    } catch {
      if (!this.isCurrentAction(session)) {
        return staleResult(operation, subscriptionId);
      }
    }
    return this.setActionFailure(
      operation,
      mutationError,
      subscriptionId,
      true,
    );
  }

  private startAction(
    operation: SubscriptionAction,
    subscriptionId?: string,
  ): ReadySession | null {
    const scope = this.scope;
    if (
      this.state.status !== "ready" ||
      !this.state.identity.userId ||
      !scope?.isCurrent()
    ) {
      return null;
    }

    this.actionSequence += 1;
    this.setActionState({ status: "pending", operation, subscriptionId });
    return {
      generation: this.generation,
      actionSequence: this.actionSequence,
      identity: {
        ...this.state.identity,
        userId: this.state.identity.userId,
      },
      scope,
      subscriptions: this.state.subscriptions,
    };
  }

  private async fetchCanonicalSubscriptions(
    session: ReadySession,
  ): Promise<SubscriptionDto[] | null> {
    const subscriptions = await this.api.listSubscriptions(
      session.identity.userId,
      { scope: session.scope },
    );
    if (!this.isCurrentAction(session)) return null;
    this.assertSubscriptionOwners(subscriptions, session.identity.userId);
    this.setState({
      status: "ready",
      identity: session.identity,
      subscriptions,
    });
    return subscriptions;
  }

  private replaceCanonicalSubscription(
    identity: IdentityDto,
    subscription: SubscriptionDto,
  ): void {
    if (this.state.status !== "ready") return;
    const subscriptions = this.state.subscriptions.some(
      (item) => item._id === subscription._id,
    )
      ? this.state.subscriptions.map((item) =>
          item._id === subscription._id ? subscription : item,
        )
      : [...this.state.subscriptions, subscription];
    this.setState({ status: "ready", identity, subscriptions });
  }

  private setActionFailure(
    operation: SubscriptionAction,
    error: unknown,
    subscriptionId: string | undefined,
    ambiguous: boolean,
  ): SubscriptionActionFailureState {
    const result = actionFailure(
      operation,
      error,
      subscriptionId,
      ambiguous,
    );
    this.setActionState(result);
    return result;
  }

  private assertClerkUser(clerkUserId: string): void {
    if (clerkUserId !== this.clerkUserId) {
      throw new ApiError("The API returned an identity for another account.", {
        code: "RESPONSE_IDENTITY_MISMATCH",
        kind: "server",
      });
    }
  }

  private assertSubscriptionOwner(
    subscription: SubscriptionDto,
    apiUserId: string,
  ): void {
    if (subscription.user !== apiUserId) {
      throw new ApiError("The API returned a subscription for another owner.", {
        code: "RESPONSE_OWNERSHIP_INVALID",
        kind: "server",
      });
    }
  }

  private assertSubscriptionOwners(
    subscriptions: SubscriptionDto[],
    apiUserId: string,
  ): void {
    if (subscriptions.some((subscription) => subscription.user !== apiUserId)) {
      throw new ApiError("The API returned subscriptions for another owner.", {
        code: "RESPONSE_OWNERSHIP_INVALID",
        kind: "server",
      });
    }
  }

  private setFailure(
    operation: SubscriptionOperation,
    error: unknown,
    identity: IdentityDto | null,
    mutationMayHaveCompleted: boolean,
  ): void {
    const normalized = normalizeFailure(error);
    this.setState({
      status: "error",
      identity,
      failure: { operation, mutationMayHaveCompleted, ...normalized },
    });
  }

  private isCurrent(
    generation: number,
    scope: RequestSessionScope,
  ): boolean {
    return (
      generation === this.generation &&
      scope === this.scope &&
      scope.isCurrent()
    );
  }

  private isCurrentAction(session: ReadySession): boolean {
    return (
      this.isCurrent(session.generation, session.scope) &&
      session.actionSequence === this.actionSequence
    );
  }

  private invalidate(): void {
    this.generation += 1;
    this.actionSequence += 1;
    this.scope?.invalidate();
    this.scope = null;
    this.sessionKey = null;
    this.clerkUserId = null;
    this.provisioning = null;
    this.actionState = { status: "idle" };
  }

  private setState(state: SubscriptionState): void {
    this.state = state;
    this.emit();
  }

  private setActionState(state: SubscriptionActionState): void {
    this.actionState = state;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export function configurationFailure(message: string): SubscriptionState {
  return {
    status: "error",
    identity: null,
    failure: {
      operation: "configuration",
      code: "API_CONFIGURATION_INVALID",
      kind: "configuration",
      message,
      retryable: false,
      mutationMayHaveCompleted: false,
    },
  };
}

function normalizeFailure(
  error: unknown,
): Omit<SubscriptionFailure, "operation" | "mutationMayHaveCompleted"> {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      kind: error.kind,
      message: error.message,
      retryable: error.retryable,
    };
  }
  return {
    code: "UNKNOWN_ERROR",
    kind: "server",
    message: "The request could not be completed.",
    retryable: true,
  };
}

function isCancellation(error: unknown): boolean {
  return error instanceof ApiError && error.kind === "cancelled";
}

function isAmbiguousMutationFailure(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.kind === "transport" || error.kind === "cancelled")
  );
}

function actionFailure(
  operation: SubscriptionAction,
  error: unknown,
  subscriptionId: string | undefined,
  ambiguous: boolean,
): SubscriptionActionFailureState {
  const normalized = normalizeFailure(error);
  return {
    status: ambiguous
      ? "ambiguous"
      : normalized.kind === "validation"
        ? "validation-error"
        : "error",
    operation,
    subscriptionId,
    failure: {
      operation,
      mutationMayHaveCompleted: ambiguous,
      ...normalized,
    },
  };
}

function successResult(
  operation: SubscriptionAction,
  subscriptionId: string | undefined,
  canonical: SubscriptionDto | true,
): SubscriptionActionSuccessState {
  return {
    status: "success",
    operation,
    subscriptionId,
    ...(canonical === true ? {} : { subscription: canonical }),
  };
}

function staleResult(
  operation: SubscriptionAction,
  subscriptionId?: string,
): SubscriptionActionResult {
  return { status: "stale", operation, subscriptionId };
}

function unavailableResult(
  operation: SubscriptionAction,
  subscriptionId?: string,
): SubscriptionActionResult {
  return actionFailure(
    operation,
    new ApiError("Subscriptions are not ready yet.", {
      code: "SUBSCRIPTIONS_READ_FAILED",
      kind: "server",
      retryable: true,
    }),
    subscriptionId,
    false,
  );
}

function matchesCreatePayload(
  subscription: SubscriptionDto,
  payload: CreateSubscriptionRequest,
): boolean {
  return matchesUpdatePayload(subscription, payload);
}

function matchesUpdatePayload(
  subscription: SubscriptionDto,
  payload: UpdateSubscriptionRequest,
): boolean {
  return (Object.keys(payload) as (keyof UpdateSubscriptionRequest)[]).every(
    (key) => subscription[key] === payload[key],
  );
}
