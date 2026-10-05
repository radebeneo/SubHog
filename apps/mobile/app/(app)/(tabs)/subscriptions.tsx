import CreateSubscriptionModal from "@/components/CreateSubscriptionModal";
import SubscriptionCard from "@/components/SubscriptionCard";
import SubscriptionStateView from "@/components/SubscriptionStateView";
import { getUpcomingSubscriptions } from "@/features/subscriptions/utils";
import { useSubscriptions } from "@/providers/SubscriptionContext";
import { router, useLocalSearchParams } from "expo-router";
import { styled } from "nativewind";
import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

export default function Subscriptions() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [createVisible, setCreateVisible] = useState(false);
  const { state, subscriptions: allSubscriptions, createSubscription } =
    useSubscriptions();

  if (state.status !== "ready") return <SubscriptionStateView />;

  const upcomingOrder = new Map(
    getUpcomingSubscriptions(allSubscriptions).map((subscription, index) => [
      subscription.id,
      index,
    ]),
  );
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const subscriptions = allSubscriptions
    .filter(
      (subscription) =>
        view !== "upcoming" || upcomingOrder.has(subscription.id),
    )
    .filter((subscription) => {
      if (!normalizedQuery) return true;
      return [
        subscription.name,
        subscription.plan,
        subscription.category,
        subscription.status,
        subscription.paymentMethod,
      ].some((field) => field?.toLowerCase().includes(normalizedQuery));
    })
    .sort((first, second) =>
      view === "upcoming"
        ? upcomingOrder.get(first.id)! - upcomingOrder.get(second.id)!
        : 0,
    );

  return (
    <SafeAreaView className="flex-1 bg-background p-5">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="mb-5 flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-3xl font-sans-bold text-primary">
            {view === "upcoming" ? "Upcoming Renewals" : "Subscriptions"}
          </Text>
          <Pressable
            className="rounded-full bg-primary px-4 py-2"
            onPress={() => setCreateVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Add subscription"
          >
            <Text className="font-sans-bold text-background">Add</Text>
          </Pressable>
        </View>
        {view === "upcoming" && (
          <Pressable
            className="mb-4 self-start"
            onPress={() => router.setParams({ view: "" })}
            accessibilityRole="button"
            accessibilityLabel="Show all subscriptions"
          >
            <Text className="font-sans-semibold text-accent">
              Show all subscriptions
            </Text>
          </Pressable>
        )}
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
              onPress={() =>
                router.push({
                  pathname: "/subscriptions/[id]",
                  params: { id: item.id },
                })
              }
            />
          )}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          ListEmptyComponent={
            <Text className="home-empty-state">
              {view === "upcoming"
                ? "No upcoming renewals."
                : "No subscriptions found."}
            </Text>
          }
          ItemSeparatorComponent={() => <View className="h-4" />}
          contentContainerClassName="pb-20"
        />
      </KeyboardAvoidingView>
      <CreateSubscriptionModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onSubmit={createSubscription}
      />
    </SafeAreaView>
  );
}
