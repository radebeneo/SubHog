import SubscriptionCard from "@/components/SubscriptionCard";
import { HOME_SUBSCRIPTIONS } from "@/constants/data";
import { posthog } from "@/lib/posthog";
import { styled } from "nativewind";
import { useState } from "react";
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

const Subscriptions = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSubscriptionId, setExpandedSubscriptionId] = useState<
    string | null
  >(null);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const subscriptions = HOME_SUBSCRIPTIONS.filter((subscription) => {
    if (!normalizedQuery) return true;

    return [
      subscription.name,
      subscription.plan,
      subscription.category,
      subscription.status,
      subscription.paymentMethod,
    ].some((field) => field?.toLowerCase().includes(normalizedQuery));
  });

  return (
    <SafeAreaView className="flex-1 bg-background p-5">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <Text className="mb-5 text-3xl font-sans-bold text-primary">
          Subscriptions
        </Text>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search subscriptions"
          placeholderTextColor="rgba(0,0,0,0.6)"
          autoCapitalize="none"
          autoCorrect={false}
          className="mb-5 rounded-2xl border border-border bg-card px-4 py-3 text-base font-sans-medium text-primary"
          accessibilityLabel="Search subscriptions"
        />
        <FlatList
          data={subscriptions}
          renderItem={({ item }) => (
            <SubscriptionCard
              {...item}
              expanded={expandedSubscriptionId === item.id}
              onPress={() => {
                const isExpanding = expandedSubscriptionId !== item.id;
                posthog?.capture("subscription_details_toggled", {
                  subscription_id: item.id,
                  is_expanded: isExpanding,
                  category: item.category ?? "",
                  subscription_status: item.status ?? "",
                });
                setExpandedSubscriptionId(isExpanding ? item.id : null);
              }}
            />
          )}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text className="home-empty-state">No subscriptions found.</Text>
          }
          ItemSeparatorComponent={() => <View className="h-4" />}
          contentContainerClassName="pb-20"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Subscriptions;
