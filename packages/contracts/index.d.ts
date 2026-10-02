export declare const API_ERROR_CODES: readonly [
  "AUTH_INVALID",
  "AUTH_PROVIDER_UNAVAILABLE",
  "IDENTITY_RESOLUTION_FAILED",
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
  "SUBSCRIPTIONS_READ_FAILED",
  "SUBSCRIPTION_NOT_FOUND",
  "SUBSCRIPTION_READ_FAILED",
  "SUBSCRIPTION_WRITE_FAILED"
];
export declare const SUBSCRIPTION_CURRENCIES: readonly ["USD", "GBP", "ZAR"];
export declare const SUBSCRIPTION_FREQUENCIES: readonly [
  "daily",
  "weekly",
  "monthly",
  "yearly"
];
export declare const SUBSCRIPTION_CATEGORIES: readonly [
  "sports",
  "news",
  "entertainment",
  "education",
  "health",
  "others"
];
export declare const SUBSCRIPTION_STATUSES: readonly [
  "active",
  "cancelled",
  "expired"
];

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
export type SubscriptionCurrency = (typeof SUBSCRIPTION_CURRENCIES)[number];
export type SubscriptionFrequency = (typeof SUBSCRIPTION_FREQUENCIES)[number];
export type SubscriptionCategory = (typeof SUBSCRIPTION_CATEGORIES)[number];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

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

export interface ProvisionIdentityRequest {
  [key: string]: never;
}

export interface OwnedSubscriptionsParams {
  userId: string;
}

export declare const SUBSCRIPTION_UPDATE_FIELDS: readonly [
  "name",
  "price",
  "currency",
  "frequency",
  "category",
  "paymentMethod",
  "startDate",
  "renewalDate"
];

export interface UpdateSubscriptionRequest {
  name?: string;
  price?: number;
  currency?: SubscriptionCurrency;
  frequency?: SubscriptionFrequency;
  category?: SubscriptionCategory;
  paymentMethod?: string;
  startDate?: string;
  renewalDate?: string;
}

export declare function isApiErrorCode(value: unknown): value is ApiErrorCode;
export declare function isApiSuccessEnvelope<T>(
  value: unknown,
  isData: (data: unknown) => data is T,
): value is ApiSuccess<T>;
export declare function isApiErrorEnvelope(
  value: unknown,
): value is ApiErrorEnvelope;
export declare function isProvisionIdentityRequest(
  value: unknown,
): value is ProvisionIdentityRequest | undefined;
export declare function isOwnedSubscriptionsParams(
  value: unknown,
): value is OwnedSubscriptionsParams;
export declare function isUpdateSubscriptionRequest(
  value: unknown,
): value is UpdateSubscriptionRequest;
export declare function isEmptyMutationRequest(
  value: unknown,
): value is ProvisionIdentityRequest | undefined;
export declare function isIdentityDto(value: unknown): value is IdentityDto;
export declare function isProvisionedIdentityDto(
  value: unknown,
): value is ProvisionedIdentityDto;
export declare function isSubscriptionDto(
  value: unknown,
): value is SubscriptionDto;
export declare function isSubscriptionDtoList(
  value: unknown,
): value is SubscriptionDto[];
