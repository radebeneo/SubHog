import { describe, expect, it } from "vitest";
import {
  getSubscriptionPage,
  shouldScrollSubscriptions,
  SUBSCRIPTIONS_PER_PAGE,
} from "../lib/subscription-list";

const subscriptions = Array.from({ length: 45 }, (_, index) => ({ id: String(index + 1) }));

describe("subscription list pagination", () => {
  it("shows at most 20 cards per page, without gaps or duplicates", () => {
    const first = getSubscriptionPage(subscriptions, 1);
    const second = getSubscriptionPage(subscriptions, 2);
    const third = getSubscriptionPage(subscriptions, 3);

    expect(SUBSCRIPTIONS_PER_PAGE).toBe(20);
    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(20);
    expect(third.items).toHaveLength(5);
    expect(first.pageCount).toBe(3);
    expect([...first.items, ...second.items, ...third.items]).toEqual(subscriptions);
  });

  it.each([0, 1, 19, 20])("does not offer extra pages for %s cards", (count) => {
    const result = getSubscriptionPage(subscriptions.slice(0, count), 1);
    expect(result.items).toHaveLength(count);
    expect(result.page).toBe(1);
    expect(result.pageCount).toBe(1);
  });

  it("starts pagination at the 21st card", () => {
    const result = getSubscriptionPage(subscriptions.slice(0, 21), 2);
    expect(result.items).toEqual([subscriptions[20]]);
    expect(result.pageCount).toBe(2);
  });

  it("clamps the page after deletion or filtering reduces the available results", () => {
    const result = getSubscriptionPage(subscriptions.slice(0, 20), 3);
    expect(result.page).toBe(1);
    expect(result.items).toHaveLength(20);
    expect(getSubscriptionPage([], 3)).toEqual({ items: [], page: 1, pageCount: 1 });
    expect(getSubscriptionPage(subscriptions, 0).page).toBe(1);
  });
});

describe("subscription list scrolling", () => {
  it("keeps empty states and short lists stationary", () => {
    expect(shouldScrollSubscriptions(0, 900, 500)).toBe(false);
    expect(shouldScrollSubscriptions(2, 250, 500)).toBe(false);
    expect(shouldScrollSubscriptions(3, 500, 500)).toBe(false);
    expect(shouldScrollSubscriptions(3, 500.5, 500)).toBe(false);
    expect(shouldScrollSubscriptions(20, 3000, 0)).toBe(false);
  });

  it("enables scrolling when cards overflow, including expanded cards or a smaller viewport", () => {
    expect(shouldScrollSubscriptions(20, 3000, 500)).toBe(true);
    expect(shouldScrollSubscriptions(1, 700, 500)).toBe(true);
    expect(shouldScrollSubscriptions(2, 400, 300)).toBe(true);
    expect(shouldScrollSubscriptions(2, 400, 500)).toBe(false);
  });
});
