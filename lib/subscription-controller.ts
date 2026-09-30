import { RequestSessionScope, type RequestOptions } from "./api-client.ts";
import { ApiError } from "./api-errors.ts";
import type {
  IdentityDto,
  ProvisionedIdentityDto,
  SubscriptionDto,
} from "./api-types.ts";

export type SubscriptionOperation =
  | "configuration"
  | "identity"
  | "provision"
  | "subscriptions";

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

export interface SubscriptionApi {
  getIdentity(options?: RequestOptions): Promise<IdentityDto>;
  provisionIdentity(options?: RequestOptions): Promise<ProvisionedIdentityDto>;
  listSubscriptions(
    userId: string,
    options?: RequestOptions,
  ): Promise<SubscriptionDto[]>;
}

type Listener = () => void;

export class SubscriptionController {
  private readonly api: SubscriptionApi;
  private state: SubscriptionState = { status: "authentication-loading" };
  private readonly listeners = new Set<Listener>();
  private generation = 0;
  private sessionKey: string | null = null;
  private clerkUserId: string | null = null;
  private scope: RequestSessionScope | null = null;
  private provisioning: Promise<void> | null = null;

  constructor(api: SubscriptionApi) {
    this.api = api;
  }

  getState = (): SubscriptionState => this.state;

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
            this.state.failure.retryable
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
      const subscriptions = await this.api.listSubscriptions(apiUserId, { scope });
      if (!this.isCurrent(generation, scope)) return;
      if (subscriptions.some((subscription) => subscription.user !== apiUserId)) {
        throw new ApiError("The API returned subscriptions for another owner.", {
          code: "RESPONSE_OWNERSHIP_INVALID",
          kind: "server",
        });
      }
      this.setState({ status: "ready", identity, subscriptions });
    } catch (error) {
      if (!this.isCurrent(generation, scope) || isCancellation(error)) return;
      this.setFailure("subscriptions", error, identity, false);
    }
  }

  private assertClerkUser(clerkUserId: string): void {
    if (clerkUserId !== this.clerkUserId) {
      throw new ApiError("The API returned an identity for another account.", {
        code: "RESPONSE_IDENTITY_MISMATCH",
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

  private isCurrent(generation: number, scope: RequestSessionScope): boolean {
    return generation === this.generation && scope === this.scope && scope.isCurrent();
  }

  private invalidate(): void {
    this.generation += 1;
    this.scope?.invalidate();
    this.scope = null;
    this.sessionKey = null;
    this.clerkUserId = null;
    this.provisioning = null;
  }

  private setState(state: SubscriptionState): void {
    this.state = state;
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

function normalizeFailure(error: unknown): Omit<
  SubscriptionFailure,
  "operation" | "mutationMayHaveCompleted"
> {
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
  return error instanceof ApiError &&
    (error.kind === "transport" || error.kind === "cancelled");
}
