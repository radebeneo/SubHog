export const API_ERROR_CODES = [
  "AUTH_INVALID",
  "AUTH_PROVIDER_UNAVAILABLE",
  "REQUEST_INVALID",
  "LEGACY_EMAIL_CONFLICT",
  "IDENTITY_CONFLICT",
  "PROFILE_EMAIL_UNVERIFIED",
  "PROFILE_INCOMPLETE",
  "PROVISIONING_FAILED",
  "IDENTITY_NOT_PROVISIONED",
  "INVALID_USER_ID",
  "NOT_OWNER",
  "USER_NOT_FOUND",
  "DATA_INTEGRITY_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
export type SubscriptionCurrency = "USD" | "GBP" | "ZAR";
export type SubscriptionFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type SubscriptionCategory =
  | "sports"
  | "news"
  | "entertainment"
  | "education"
  | "health"
  | "others";
export type SubscriptionStatus = "active" | "cancelled" | "expired";

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorEnvelope {
  success: false;
  code: ApiErrorCode;
  message: string;
}

export interface IdentityDto {
  provider: "clerk";
  clerkUserId: string;
  userId: string | null;
  provisioned: boolean;
}

export interface ProvisionedIdentityDto {
  provider: "clerk";
  clerkUserId: string;
  userId: string;
  email: string;
  name: string;
}

export interface SubscriptionDto {
  _id: string;
  name: string;
  price: number;
  currency: SubscriptionCurrency;
  frequency: SubscriptionFrequency;
  category: SubscriptionCategory;
  paymentMethod: string;
  status: SubscriptionStatus;
  startDate: string;
  renewalDate: string | null;
  user: string;
  createdAt: string;
  updatedAt: string;
}

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return (
    typeof value === "string" && API_ERROR_CODES.includes(value as ApiErrorCode)
  );
}
