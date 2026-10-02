import assert from "node:assert/strict";
import test from "node:test";

import {
  API_ERROR_CODES,
  isApiSuccessEnvelope,
  isIdentityDto,
  isSubscriptionDto,
  isSubscriptionDtoList,
  isUpdateSubscriptionRequest,
  SUBSCRIPTION_CATEGORIES,
  SUBSCRIPTION_CURRENCIES,
  SUBSCRIPTION_FREQUENCIES,
  SUBSCRIPTION_STATUSES,
} from "../index.js";

const ownerId = "665f00000000000000000001";
const subscription = {
  _id: "665f00000000000000000010",
  name: "Example Plus",
  price: 12.5,
  currency: "USD",
  frequency: "monthly",
  category: "entertainment",
  paymentMethod: "card",
  status: "active",
  startDate: "2026-01-01T00:00:00.000Z",
  renewalDate: null,
  user: ownerId,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

test("pins the deployed v1 subscription enums", () => {
  assert.deepEqual(SUBSCRIPTION_CURRENCIES, ["USD", "GBP", "ZAR"]);
  assert.deepEqual(SUBSCRIPTION_FREQUENCIES, ["daily", "weekly", "monthly", "yearly"]);
  assert.deepEqual(SUBSCRIPTION_CATEGORIES, [
    "sports", "news", "entertainment", "education", "health", "others",
  ]);
  assert.deepEqual(SUBSCRIPTION_STATUSES, ["active", "cancelled", "expired"]);
  assert.ok(API_ERROR_CODES.includes("SUBSCRIPTION_NOT_FOUND"));
});

test("pins the complete-list array envelope and exact UTC ISO DTO", () => {
  assert.equal(isSubscriptionDto(subscription), true);
  assert.equal(isSubscriptionDtoList([subscription]), true);
  assert.equal(
    isApiSuccessEnvelope({ success: true, data: [subscription] }, isSubscriptionDtoList),
    true,
  );
  assert.equal(
    isApiSuccessEnvelope({ success: true, data: { items: [subscription] } }, isSubscriptionDtoList),
    false,
  );
  assert.equal(isSubscriptionDto({ ...subscription, workflowRunId: "private" }), false);
  assert.equal(isSubscriptionDto({ ...subscription, createdAt: "2026-01-01" }), false);
  assert.equal(isSubscriptionDto({ ...subscription, currency: "EUR" }), false);
});

test("identity DTOs require exact keys and canonical API user IDs", () => {
  assert.equal(isIdentityDto({
    provider: "clerk",
    clerkUserId: "user_subject",
    userId: ownerId,
    provisioned: true,
  }), true);
  assert.equal(isIdentityDto({
    provider: "clerk",
    clerkUserId: "user_subject",
    userId: "not-an-object-id",
    provisioned: true,
  }), false);
});

test("subscription updates allow only validated client-controlled fields", () => {
  assert.equal(isUpdateSubscriptionRequest({
    name: "Updated",
    price: 0,
    startDate: "2026-01-01T00:00:00.000Z",
  }), true);
  for (const value of [
    {},
    { user: ownerId },
    { status: "cancelled" },
    { workflowRunId: "private" },
    { name: "x" },
    { price: Number.NaN },
    { currency: "EUR" },
    { startDate: "2026-01-01" },
  ]) {
    assert.equal(isUpdateSubscriptionRequest(value), false);
  }
});
