import { useSubscriptions } from "@/providers/SubscriptionContext";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

export default function SubscriptionStateView() {
  const { state, provision, retry } = useSubscriptions();

  if (
    state.status === "authentication-loading" ||
    state.status === "resolving-identity" ||
    state.status === "loading-subscriptions" ||
    state.status === "provisioning"
  ) {
    const label =
      state.status === "provisioning"
        ? "Setting up your account..."
        : state.status === "loading-subscriptions"
          ? "Loading subscriptions..."
          : state.status === "resolving-identity"
            ? "Resolving your account..."
            : "Checking authentication...";
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <ActivityIndicator size="large" />
        <Text className="mt-4 text-center text-base font-sans-medium text-primary">
          {label}
        </Text>
      </View>
    );
  }

  if (state.status === "unprovisioned") {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-center text-2xl font-sans-bold text-primary">
          Finish account setup
        </Text>
        <Text className="mt-3 text-center text-base font-sans-medium text-muted-foreground">
          Create your SubHog profile before loading owned subscriptions.
        </Text>
        <Pressable className="auth-button mt-6 w-full" onPress={() => void provision()}>
          <Text className="auth-button-text">Create SubHog profile</Text>
        </Pressable>
      </View>
    );
  }

  if (state.status === "error") {
    const provisionFailure = state.failure.operation === "provision";
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-center text-2xl font-sans-bold text-primary">
          {state.failure.operation === "configuration"
            ? "API configuration required"
            : "Subscriptions unavailable"}
        </Text>
        <Text className="mt-3 text-center text-base font-sans-medium text-destructive">
          {state.failure.message}
        </Text>
        {state.failure.mutationMayHaveCompleted && (
          <Text className="mt-3 text-center text-sm font-sans-medium text-muted-foreground">
            Account setup may have completed on the server. Recheck before choosing to submit again.
          </Text>
        )}
        {state.failure.operation !== "configuration" && (
          <Pressable className="auth-button mt-6 w-full" onPress={() => void retry()}>
            <Text className="auth-button-text">
              {provisionFailure ? "Recheck account" : "Try again"}
            </Text>
          </Pressable>
        )}
        {provisionFailure && state.failure.retryable && (
          <Pressable
            className="auth-secondary-button mt-3 w-full"
            onPress={() => void provision()}
          >
            <Text className="auth-secondary-button-text">
              Submit setup again
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  return null;
}
