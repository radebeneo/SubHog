import type { ApiErrorCode } from "./api-types.ts";

export type ApiErrorKind =
  | "authentication"
  | "authorization"
  | "conflict"
  | "validation"
  | "provider"
  | "server"
  | "transport"
  | "cancelled";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly retryable: boolean;

  constructor(
    message: string,
    details: {
      code: string;
      status?: number;
      kind: ApiErrorKind;
      retryable?: boolean;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.code = details.code;
    this.status = details.status ?? 0;
    this.kind = details.kind;
    this.retryable = details.retryable ?? false;
  }
}

const backendErrorKinds: Record<ApiErrorCode, ApiErrorKind> = {
  AUTH_INVALID: "authentication",
  AUTH_PROVIDER_UNAVAILABLE: "provider",
  REQUEST_INVALID: "validation",
  LEGACY_EMAIL_CONFLICT: "conflict",
  IDENTITY_CONFLICT: "conflict",
  PROFILE_EMAIL_UNVERIFIED: "validation",
  PROFILE_INCOMPLETE: "validation",
  PROVISIONING_FAILED: "server",
  IDENTITY_NOT_PROVISIONED: "authorization",
  INVALID_USER_ID: "validation",
  NOT_OWNER: "authorization",
  USER_NOT_FOUND: "validation",
  DATA_INTEGRITY_ERROR: "server",
};

export function classifyBackendError(
  code: ApiErrorCode,
  message: string,
  status: number,
): ApiError {
  return new ApiError(message, {
    code,
    status,
    kind: backendErrorKinds[code],
    retryable: code === "AUTH_PROVIDER_UNAVAILABLE" || status >= 500,
  });
}

export function transportError(
  message: string,
  code = "NETWORK_ERROR",
): ApiError {
  return new ApiError(message, { code, kind: "transport", retryable: true });
}

export function cancelledError(code = "REQUEST_CANCELLED"): ApiError {
  return new ApiError("The request was cancelled.", {
    code,
    kind: "cancelled",
  });
}
