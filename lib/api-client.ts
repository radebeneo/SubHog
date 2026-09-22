import {
    ApiError,
    cancelledError,
    classifyBackendError,
    transportError,
} from "./api-errors.ts";
import {
    isApiErrorCode,
    type IdentityDto,
    type ProvisionedIdentityDto,
    type SubscriptionCategory,
    type SubscriptionCurrency,
    type SubscriptionDto,
    type SubscriptionFrequency,
    type SubscriptionStatus,
} from "./api-types.ts";
import type { ClerkTokenGetter } from "./clerk-token.ts";

export interface RequestScope {
  isCurrent(): boolean;
  onChange?(listener: () => void): () => void;
}

export class RequestSessionScope implements RequestScope {
  private current = true;
  private readonly listeners = new Set<() => void>();

  isCurrent(): boolean {
    return this.current;
  }

  invalidate(): void {
    if (!this.current) return;
    this.current = false;
    for (const listener of this.listeners) listener();
    this.listeners.clear();
  }

  onChange(listener: () => void): () => void {
    if (!this.current) {
      listener();
      return () => undefined;
    }
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken: ClerkTokenGetter;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface RequestOptions {
  signal?: AbortSignal;
  scope?: RequestScope;
}

const currencies: readonly SubscriptionCurrency[] = ["USD", "GBP", "ZAR"];
const frequencies: readonly SubscriptionFrequency[] = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
];
const categories: readonly SubscriptionCategory[] = [
  "sports",
  "news",
  "entertainment",
  "education",
  "health",
  "others",
];
const statuses: readonly SubscriptionStatus[] = [
  "active",
  "cancelled",
  "expired",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function assertSuccessEnvelope<T>(
  value: unknown,
  isData: (data: unknown) => data is T,
): T {
  if (!isRecord(value) || value.success !== true || !isData(value.data)) {
    throw transportError(
      "The API returned an unexpected response shape.",
      "RESPONSE_INVALID",
    );
  }
  return value.data;
}

function isIdentity(value: unknown): value is IdentityDto {
  return (
    isRecord(value) &&
    value.provider === "clerk" &&
    isString(value.clerkUserId) &&
    isNullableString(value.userId) &&
    typeof value.provisioned === "boolean" &&
    value.provisioned === (value.userId !== null)
  );
}

function isProvisionedIdentity(
  value: unknown,
): value is ProvisionedIdentityDto {
  return (
    isRecord(value) &&
    value.provider === "clerk" &&
    isString(value.clerkUserId) &&
    isString(value.userId) &&
    isString(value.email) &&
    isString(value.name)
  );
}

function isSubscription(value: unknown): value is SubscriptionDto {
  return (
    isRecord(value) &&
    isString(value._id) &&
    isString(value.name) &&
    typeof value.price === "number" &&
    Number.isFinite(value.price) &&
    isOneOf(currencies, value.currency) &&
    isOneOf(frequencies, value.frequency) &&
    isOneOf(categories, value.category) &&
    isString(value.paymentMethod) &&
    isOneOf(statuses, value.status) &&
    isString(value.startDate) &&
    isNullableString(value.renewalDate) &&
    isString(value.user) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function isSubscriptionList(value: unknown): value is SubscriptionDto[] {
  return Array.isArray(value) && value.every(isSubscription);
}

function parseBackendError(value: unknown, status: number): ApiError {
  if (
    isRecord(value) &&
    value.success === false &&
    isApiErrorCode(value.code) &&
    isString(value.message)
  ) {
    return classifyBackendError(value.code, value.message, status);
  }
  return transportError(
    "The API returned an unexpected error response.",
    "RESPONSE_INVALID",
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getToken: ClerkTokenGetter;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly refreshPromises = new WeakMap<object, Promise<string>>();
  private readonly credentials = new Set<string>();

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.getToken = options.getToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  getIdentity(options?: RequestOptions): Promise<IdentityDto> {
    return this.request<IdentityDto>(
      "/identity",
      { ...options, read: true },
      isIdentity,
    );
  }

  provisionIdentity(options?: RequestOptions): Promise<ProvisionedIdentityDto> {
    return this.request<ProvisionedIdentityDto>(
      "/identity/provision",
      { ...options, method: "POST" },
      isProvisionedIdentity,
    );
  }

  listSubscriptions(
    userId: string,
    options?: RequestOptions,
  ): Promise<SubscriptionDto[]> {
    return this.request<SubscriptionDto[]>(
      `/subscriptions/user/${encodeURIComponent(userId)}`,
      { ...options, read: true },
      isSubscriptionList,
    );
  }

  private async request<T>(
    path: string,
    options: RequestOptions & { method?: string; read?: boolean },
    isData: (data: unknown) => data is T,
  ): Promise<T> {
    this.assertCanRetry(options);
    const token = await this.acquireToken({}, options);
    const response = await this.send(path, token, options);
    this.assertCanRetry(options);

    if (response.error?.code === "AUTH_INVALID" && options.read) {
      this.assertCanRetry(options);
      const refreshedToken = await this.acquireFreshToken(options);
      this.assertCanRetry(options);
      const replay = await this.send(path, refreshedToken, options);
      this.assertCanRetry(options);
      return this.finishResponse(replay, isData);
    }

    return this.finishResponse(response, isData);
  }

  private async acquireToken(
    options?: {
      skipCache?: boolean;
    },
    requestOptions?: RequestOptions,
  ): Promise<string> {
    let token: string | null;
    try {
      token = await this.awaitRequest(this.getToken(options), requestOptions);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Authentication could not be completed.", {
        code: "AUTH_TOKEN_ACQUISITION_FAILED",
        kind: "authentication",
      });
    }
    if (token === null) {
      throw new ApiError("Authentication is required.", {
        code: "AUTH_TOKEN_MISSING",
        kind: "authentication",
      });
    }
    this.credentials.add(token);
    return token;
  }

  private async acquireFreshToken(options: RequestOptions): Promise<string> {
    const key = options.scope ?? this;
    let refreshPromise = this.refreshPromises.get(key);
    if (!refreshPromise) {
      refreshPromise = this.acquireToken({ skipCache: true }).finally(() => {
        if (this.refreshPromises.get(key) === refreshPromise) {
          this.refreshPromises.delete(key);
        }
      });
      this.refreshPromises.set(key, refreshPromise);
    }
    return this.awaitRequest(refreshPromise, options);
  }

  private assertCanRetry(options: RequestOptions): void {
    if (options.signal?.aborted) {
      throw cancelledError();
    }
    if (options.scope && !options.scope.isCurrent()) {
      throw cancelledError("REQUEST_SCOPE_CHANGED");
    }
  }

  private async send(
    path: string,
    token: string,
    options: RequestOptions & { method?: string },
  ): Promise<{ response?: Response; error?: ApiError }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: options.method ?? "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          return {
            error: transportError(
              "The API returned malformed JSON.",
              "RESPONSE_INVALID",
            ),
          };
        }
        const error = parseBackendError(payload, response.status);
        return { error: this.sanitizeError(error) };
      }
      return { response };
    } catch (error) {
      if (options.signal?.aborted) return { error: cancelledError() };
      if (isAbortError(error))
        return { error: transportError("The request timed out.", "TIMEOUT") };
      return { error: transportError("The network request failed.") };
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onAbort);
    }
  }

  private sanitizeError(error: ApiError): ApiError {
    for (const credential of this.credentials) {
      if (credential && error.message.includes(credential)) {
        return new ApiError("The API returned an unsafe error response.", {
          code: error.code,
          status: error.status,
          kind: error.kind,
          retryable: error.retryable,
        });
      }
    }
    return error;
  }

  private async awaitRequest<T>(
    promise: Promise<T>,
    options?: RequestOptions,
  ): Promise<T> {
    this.assertCanRetry(options ?? {});
    if (!options?.signal && !options?.scope?.onChange) return promise;

    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        options.signal?.removeEventListener("abort", onAbort);
        unsubscribe?.();
      };
      const cancel = (error: ApiError) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const onAbort = () => cancel(cancelledError());
      const unsubscribe = options.scope?.onChange?.(() =>
        cancel(cancelledError("REQUEST_SCOPE_CHANGED")),
      );
      options.signal?.addEventListener("abort", onAbort, { once: true });
      promise.then(
        (value) => {
          if (settled) return;
          try {
            this.assertCanRetry(options);
            settled = true;
            cleanup();
            resolve(value);
          } catch (error) {
            cancel(error as ApiError);
          }
        },
        (error: unknown) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        },
      );
    });
  }

  private async finishResponse<T>(
    result: { response?: Response; error?: ApiError },
    isData: (data: unknown) => data is T,
  ): Promise<T> {
    if (result.error) throw result.error;
    const response = result.response;
    if (!response)
      throw transportError("The request did not return a response.");
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw transportError(
        "The API returned malformed JSON.",
        "RESPONSE_INVALID",
      );
    }
    return assertSuccessEnvelope(payload, isData);
  }
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  return new ApiClient(options);
}
