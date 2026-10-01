export const API_ERROR_CODES = Object.freeze([
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
]);

export const SUBSCRIPTION_CURRENCIES = Object.freeze(["USD", "GBP", "ZAR"]);
export const SUBSCRIPTION_FREQUENCIES = Object.freeze([
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);
export const SUBSCRIPTION_CATEGORIES = Object.freeze([
  "sports",
  "news",
  "entertainment",
  "education",
  "health",
  "others",
]);
export const SUBSCRIPTION_STATUSES = Object.freeze([
  "active",
  "cancelled",
  "expired",
]);

const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value) => typeof value === "string";

const isOneOf = (values, value) =>
  typeof value === "string" && values.includes(value);

export const isApiErrorCode = (value) => isOneOf(API_ERROR_CODES, value);

export const isApiSuccessEnvelope = (value, isData) =>
  isRecord(value) && value.success === true && isData(value.data);

export const isApiErrorEnvelope = (value) =>
  isRecord(value) &&
  value.success === false &&
  isApiErrorCode(value.code) &&
  isString(value.message);

export const isProvisionIdentityRequest = (value) =>
  value === undefined || (isRecord(value) && Object.keys(value).length === 0);

export const isOwnedSubscriptionsParams = (value) =>
  isRecord(value) && isString(value.userId);

export const isIdentityDto = (value) =>
  isRecord(value) &&
  value.provider === "clerk" &&
  isString(value.clerkUserId) &&
  (value.userId === null || isString(value.userId)) &&
  typeof value.provisioned === "boolean" &&
  value.provisioned === (value.userId !== null);

export const isProvisionedIdentityDto = (value) =>
  isRecord(value) &&
  value.provider === "clerk" &&
  isString(value.clerkUserId) &&
  isString(value.userId) &&
  isString(value.email) &&
  isString(value.name);

export const isSubscriptionDto = (value) =>
  isRecord(value) &&
  isString(value._id) &&
  isString(value.name) &&
  typeof value.price === "number" &&
  Number.isFinite(value.price) &&
  isOneOf(SUBSCRIPTION_CURRENCIES, value.currency) &&
  isOneOf(SUBSCRIPTION_FREQUENCIES, value.frequency) &&
  isOneOf(SUBSCRIPTION_CATEGORIES, value.category) &&
  isString(value.paymentMethod) &&
  isOneOf(SUBSCRIPTION_STATUSES, value.status) &&
  isString(value.startDate) &&
  (value.renewalDate === null || isString(value.renewalDate)) &&
  isString(value.user) &&
  isString(value.createdAt) &&
  isString(value.updatedAt);

export const isSubscriptionDtoList = (value) =>
  Array.isArray(value) && value.every(isSubscriptionDto);