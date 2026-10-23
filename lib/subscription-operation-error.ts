import { ConvexError } from "convex/values";

// Never expose raw errors: they may include tokens, input values or server traces.
export function subscriptionOperationMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "object" && error.data !== null) {
    const data: unknown = error.data;
    if (typeof data === "object" && data !== null && "code" in data) {
      switch (data.code) {
        case "INVALID_INPUT": return "Some details were rejected. Check the fields and try again.";
        case "UNAUTHENTICATED": return "Your session could not be verified. Reconnect or sign in again.";
        case "NOT_FOUND": return "This subscription is no longer available. Refresh the list before trying again.";
      }
    }
  }
  return "The change could not be confirmed. Reconnect and check your subscriptions before trying again.";
}
