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
  "SUBSCRIPTION_NOT_FOUND",
  "SUBSCRIPTION_READ_FAILED",
  "SUBSCRIPTION_WRITE_FAILED",
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

const hasExactKeys = (value, keys) => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
};

const isNonBlankString = (value) =>
  isString(value) && value.trim().length > 0;

const isObjectId = (value) =>
  isString(value) && /^[0-9a-f]{24}$/i.test(value);

const isIsoDate = (value) => {
  if (!isString(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

const isEmail = (value) => {
  if (!isString(value) || value !== value.trim()) return false;
  const parts = value.split("@");
  return parts.length === 2
    && parts[0].length > 0
    && parts[1].includes(".")
    && !parts[1].startsWith(".")
    && !parts[1].endsWith(".");
};

const isOneOf = (values, value) =>
  typeof value === "string" && values.includes(value);

export const isApiErrorCode = (value) => isOneOf(API_ERROR_CODES, value);

export const isApiSuccessEnvelope = (value, isData) =>
  isRecord(value)
  && hasExactKeys(value, ["success", "data"])
  && value.success === true
  && isData(value.data);

export const isApiErrorEnvelope = (value) =>
  isRecord(value) &&
  hasExactKeys(value, ["success", "code", "message"]) &&
  value.success === false &&
  isApiErrorCode(value.code) &&
  isNonBlankString(value.message);

export const isProvisionIdentityRequest = (value) =>
  value === undefined || (isRecord(value) && Object.keys(value).length === 0);

export const isOwnedSubscriptionsParams = (value) =>
  isRecord(value) && hasExactKeys(value, ["userId"]) && isObjectId(value.userId);

export const SUBSCRIPTION_UPDATE_FIELDS = Object.freeze([
  "name",
  "price",
  "currency",
  "frequency",
  "category",
  "paymentMethod",
  "startDate",
  "renewalDate",
]);

const isSubscriptionUpdateField = (key, value) => {
  switch (key) {
    case "name":
      return isString(value) && value.trim().length >= 2 && value.trim().length <= 100;
    case "price":
      return typeof value === "number" && Number.isFinite(value) && value >= 0;
    case "currency":
      return isOneOf(SUBSCRIPTION_CURRENCIES, value);
    case "frequency":
      return isOneOf(SUBSCRIPTION_FREQUENCIES, value);
    case "category":
      return isOneOf(SUBSCRIPTION_CATEGORIES, value);
    case "paymentMethod":
      return isNonBlankString(value);
    case "startDate":
    case "renewalDate":
      return isIsoDate(value);
    default:
      return false;
  }
};

export const isUpdateSubscriptionRequest = (value) => {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0
    && keys.every((key) => SUBSCRIPTION_UPDATE_FIELDS.includes(key))
    && keys.every((key) => isSubscriptionUpdateField(key, value[key]));
};

export const isEmptyMutationRequest = isProvisionIdentityRequest;

export const isIdentityDto = (value) =>
  isRecord(value) &&
  hasExactKeys(value, ["provider", "clerkUserId", "userId", "provisioned"]) &&
  value.provider === "clerk" &&
  isNonBlankString(value.clerkUserId) &&
  (value.userId === null || isObjectId(value.userId)) &&
  typeof value.provisioned === "boolean" &&
  value.provisioned === (value.userId !== null);

export const isProvisionedIdentityDto = (value) =>
  isRecord(value) &&
  hasExactKeys(value, ["provider", "clerkUserId", "userId", "email", "name"]) &&
  value.provider === "clerk" &&
  isNonBlankString(value.clerkUserId) &&
  isObjectId(value.userId) &&
  isEmail(value.email) &&
  isString(value.name) && value.name.length >= 2 && value.name.length <= 20;

export const isSubscriptionDto = (value) =>
  isRecord(value) &&
  hasExactKeys(value, [
    "_id", "name", "price", "currency", "frequency", "category",
    "paymentMethod", "status", "startDate", "renewalDate", "user",
    "createdAt", "updatedAt",
  ]) &&
  isObjectId(value._id) &&
  isNonBlankString(value.name) &&
  value.name.length >= 2 && value.name.length <= 100 &&
  typeof value.price === "number" &&
  Number.isFinite(value.price) &&
  isOneOf(SUBSCRIPTION_CURRENCIES, value.currency) &&
  isOneOf(SUBSCRIPTION_FREQUENCIES, value.frequency) &&
  isOneOf(SUBSCRIPTION_CATEGORIES, value.category) &&
  isNonBlankString(value.paymentMethod) &&
  isOneOf(SUBSCRIPTION_STATUSES, value.status) &&
  isIsoDate(value.startDate) &&
  (value.renewalDate === null || isIsoDate(value.renewalDate)) &&
  isObjectId(value.user) &&
  isIsoDate(value.createdAt) &&
  isIsoDate(value.updatedAt);

export const isSubscriptionDtoList = (value) =>
  Array.isArray(value) && value.every(isSubscriptionDto);
