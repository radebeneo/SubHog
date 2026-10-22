import { useSubscriptions } from "@/context/SubscriptionContext";
import { Text, View } from "react-native";

export default function BackendNotice() {
  const { state } = useSubscriptions();

  if (state.status !== "backend-unconfigured") return null;

  return (
    <View className="mb-5 rounded-2xl border border-border bg-muted p-4">
      <Text className="text-base font-sans-bold text-primary">
        Backend not connected
      </Text>
      <Text className="mt-2 text-sm font-sans-medium text-muted-foreground">
        You are signed in. Subscription data and management will be available
        once the backend is connected.
      </Text>
    </View>
  );
}
