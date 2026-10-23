import { useSubscriptions } from "@/context/SubscriptionContext";
import { Pressable, Text, View } from "react-native";

export default function SubscriptionDataNotice() {
  const { status, connected, retry } = useSubscriptions();
  if (status === "ready" && connected) return null;
  const message = status === "unconfigured"
    ? "Subscription storage is not configured. Connect Convex before adding subscriptions."
    : status === "auth-loading" ? "Verifying your session with Convex…"
    : status === "auth-required" ? "Convex could not verify your session. Check your connection or sign in again."
    : status === "error" ? "Could not load your subscriptions. Try refreshing the list."
    : !connected ? "Connecting to Convex… Changes are disabled until the connection returns."
    : "Loading all your subscriptions…";
  return (
    <View className="mb-5 rounded-2xl border border-border bg-card p-4">
      <Text className="auth-helper" accessibilityLiveRegion="polite">{message}</Text>
      {status === "error" && (
        <Pressable className="auth-secondary-button mt-3" accessibilityRole="button" onPress={retry}>
          <Text className="auth-label">Refresh subscriptions</Text>
        </Pressable>
      )}
    </View>
  );
}
