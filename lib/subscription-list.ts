export const SUBSCRIPTIONS_PER_PAGE = 20;

export function getSubscriptionPage<T>(subscriptions: readonly T[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(subscriptions.length / SUBSCRIPTIONS_PER_PAGE));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = (page - 1) * SUBSCRIPTIONS_PER_PAGE;

  return {
    items: subscriptions.slice(start, start + SUBSCRIPTIONS_PER_PAGE),
    page,
    pageCount,
  };
}

export function shouldScrollSubscriptions(
  itemCount: number,
  contentHeight: number,
  viewportHeight: number,
) {
  // Ignore sub-pixel layout rounding and never scroll the empty illustration.
  return itemCount > 0 && viewportHeight > 0 && contentHeight > viewportHeight + 1;
}
