import {
  isApiErrorEnvelope,
  isApiSuccessEnvelope,
  isIdentityDto,
  isProvisionedIdentityDto,
  isSubscriptionDto,
  isSubscriptionDtoList,
  type CreateSubscriptionRequest,
  type IdentityDto,
  type ProvisionedIdentityDto,
  type SubscriptionDto,
  type UpdateSubscriptionRequest,
} from "@subhog/contracts";
import {
  ApiError,
  cancelledError,
  classifyBackendError,
  transportError,
} from "./api-errors.ts";
import type { TokenGetter } from "./token.ts";

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
  getToken: TokenGetter;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface RequestOptions {
  signal?: AbortSignal;
  scope?: RequestScope;
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function parseBackendError(value: unknown, status: number): ApiError {
  if (isApiErrorEnvelope(value)) {
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
  private readonly getToken: TokenGetter;
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
      isIdentityDto,
    );
  }

  deleteIdentity(options?: RequestOptions): Promise<void> {
    return this.request("/identity", { ...options, method: "DELETE" });
  }

  provisionIdentity(options?: RequestOptions): Promise<ProvisionedIdentityDto> {
    return this.request<ProvisionedIdentityDto>(
      "/identity/provision",
      { ...options, method: "POST", body: {} },
      isProvisionedIdentityDto,
    );
  }

  listSubscriptions(
    userId: string,
    options?: RequestOptions,
  ): Promise<SubscriptionDto[]> {
    return this.request<SubscriptionDto[]>(
      `/subscriptions/user/${encodeURIComponent(userId)}`,
      { ...options, read: true },
      isSubscriptionDtoList,
    );
  }

  getSubscription(
    id: string,
    options?: RequestOptions,
  ): Promise<SubscriptionDto> {
    return this.request<SubscriptionDto>(
      `/subscriptions/${encodeURIComponent(id)}`,
      { ...options, read: true },
      isSubscriptionDto,
    );
  }

  createSubscription(
    payload: CreateSubscriptionRequest,
    options?: RequestOptions,
  ): Promise<SubscriptionDto> {
    return this.request<SubscriptionDto>(
      "/subscriptions",
      { ...options, method: "POST", body: { ...payload } },
      isSubscriptionDto,
    );
  }

  updateSubscription(
    id: string,
    payload: UpdateSubscriptionRequest,
    options?: RequestOptions,
  ): Promise<SubscriptionDto> {
    return this.request<SubscriptionDto>(
      `/subscriptions/${encodeURIComponent(id)}`,
      { ...options, method: "PUT", body: { ...payload } },
      isSubscriptionDto,
    );
  }

  cancelSubscription(
    id: string,
    options?: RequestOptions,
  ): Promise<SubscriptionDto> {
    return this.request<SubscriptionDto>(
      `/subscriptions/${encodeURIComponent(id)}/cancel`,
      { ...options, method: "PUT" },
      isSubscriptionDto,
    );
  }

  deleteSubscription(id: string, options?: RequestOptions): Promise<void> {
    return this.request(
      `/subscriptions/${encodeURIComponent(id)}`,
      { ...options, method: "DELETE" },
    );
  }

  listUpcomingRenewals(options?: RequestOptions): Promise<SubscriptionDto[]> {
    return this.request<SubscriptionDto[]>(
      "/subscriptions/upcoming-renewals",
      { ...options, read: true },
      isSubscriptionDtoList,
    );
  }

  private async request<T = void>(
    path: string,
    options: RequestOptions & {
      method?: string;
      read?: boolean;
      body?: JsonValue;
    },
    isData?: (data: unknown) => data is T,
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
    options: RequestOptions & {
      method?: string;
      body?: JsonValue;
    },
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
          ...(options.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
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
    isData?: (data: unknown) => data is T,
  ): Promise<T> {
    if (result.error) throw result.error;
    const response = result.response;
    if (!response)
      throw transportError("The request did not return a response.");
    if (response.status === 204) {
      if (!isData) return undefined as T;
      throw transportError(
        "The API returned an unexpected response shape.",
        "RESPONSE_INVALID",
      );
    }
    if (!isData) {
      throw transportError(
        "The API returned an unexpected response shape.",
        "RESPONSE_INVALID",
      );
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw transportError(
        "The API returned malformed JSON.",
        "RESPONSE_INVALID",
      );
    }
    if (!isApiSuccessEnvelope(payload, isData)) {
      throw transportError(
        "The API returned an unexpected response shape.",
        "RESPONSE_INVALID",
      );
    }
    return payload.data;
  }
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  return new ApiClient(options);
}
