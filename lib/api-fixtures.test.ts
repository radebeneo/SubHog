import type {
    IdentityDto,
    ProvisionedIdentityDto,
    SubscriptionDto,
} from "./api-types.ts";

export const identityFixture: IdentityDto = {
  provider: "clerk",
  clerkUserId: "user_2abc123",
  userId: "665f000000000000000001",
  provisioned: true,
};

export const provisionedIdentityFixture: ProvisionedIdentityDto = {
  provider: "clerk",
  clerkUserId: "user_2abc123",
  userId: "665f000000000000000001",
  email: "owner@example.test",
  name: "Owner Example",
};

export const subscriptionFixture: SubscriptionDto = {
  _id: "665f000000000000000010",
  name: "Example Plus",
  price: 12.5,
  currency: "USD",
  frequency: "monthly",
  category: "entertainment",
  paymentMethod: "card",
  status: "active",
  startDate: "2026-01-01T00:00:00.000Z",
  renewalDate: "2026-02-01T00:00:00.000Z",
  user: "665f000000000000000001",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export function successFixture<T>(data: T): Response {
  return Response.json({ success: true, data });
}

export function errorFixture(
  status: number,
  code: string,
  message = "Stable client-safe message",
): Response {
  return new Response(JSON.stringify({ success: false, code, message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
