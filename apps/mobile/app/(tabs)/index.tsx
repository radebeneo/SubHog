import ListHeading from "@/components/ListHeading";
import SubscriptionCard from "@/components/SubscriptionCard";
import SubscriptionStateView from "@/components/SubscriptionStateView";
import UpcomingSubscriptionCard from "@/components/UpcomingSubscriptionCard";
import images from "@/constants/images";
import { useSubscriptions } from "@/context/SubscriptionContext";
import "@/global.css";
import { posthog, sanitizePostHogProperties } from "@/lib/posthog";
import { useUser } from "@clerk/expo";
import dayjs from "dayjs";
import { styled } from "nativewind";
import { useState } from "react";
import { FlatList, Image, Text, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

export default function App() {
  const [expandedSubscriptionId, setExpandedSubscriptionId] = useState<
    string | null
  >(null);
  const { state, subscriptions } = useSubscriptions();
  const { user } = useUser();
  const displayName =
    user?.firstName || user?.emailAddresses[0]?.emailAddress || "Subscriber";

  if (state.status !== "ready") {
    return <SubscriptionStateView />;
  }

  const activeSubscriptions = subscriptions.filter(
    (subscription) => subscription.status === "active",
  );
  const upcomingSubscriptions = activeSubscriptions
    .filter((subscription) => subscription.renewalDate)
    .map((subscription) => ({
      ...subscription,
      daysLeft: Math.max(0, dayjs(subscription.renewalDate).diff(dayjs(), "day")),
    }))
    .sort((first, second) => first.daysLeft - second.daysLeft)
    .slice(0, 4);

  return (
    <SafeAreaView className="flex-1 bg-background p-5">
      <FlatList
        ListHeaderComponent={() => (
          <>
            <View className="home-header">
              <View className="home-user">
                <Image
                  className="home-avatar"
                  source={user?.imageUrl ? { uri: user.imageUrl } : images.avatar}
                />
                <Text className="home-user-name">{displayName}</Text>
              </View>
              <Text className="text-sm font-sans-semibold text-muted-foreground">
                Read only
              </Text>
            </View>

            <View className="home-balance-card">
              <Text className="home-balance-label">Active subscriptions</Text>
              <View className="home-balance-row">
                <Text className="home-balance-amount">
                  {activeSubscriptions.length}
                </Text>
                <Text className="home-balance-date">API backed</Text>
              </View>
            </View>

            <View className="mb-5">
              <ListHeading title="Upcoming" />
              <FlatList
                data={upcomingSubscriptions}
                horizontal
                renderItem={({ item }) => (
                  <UpcomingSubscriptionCard {...item} />
                )}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                ListEmptyComponent={
                  <Text className="home-empty-state">
                    No upcoming renewals.
                  </Text>
                }
              />
            </View>

            <ListHeading title="All Subscriptions" />
          </>
        )}
        data={subscriptions}
        renderItem={({ item }) => (
          <SubscriptionCard
            {...item}
            expanded={expandedSubscriptionId === item.id}
            onPress={() => {
              const isExpanding = expandedSubscriptionId !== item.id;
              posthog?.capture(
                "subscription_details_toggled",
                sanitizePostHogProperties({
                  subscription_id: item.id,
                  is_expanded: isExpanding,
                  category: item.category,
                  subscription_status: item.status,
                }),
              );
              setExpandedSubscriptionId(isExpanding ? item.id : null);
            }}
          />
        )}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text className="home-empty-state">No subscriptions found.</Text>
        }
        extraData={expandedSubscriptionId}
        ItemSeparatorComponent={() => <View className="h-4" />}
        contentContainerClassName="pb-20"
      />
    </SafeAreaView>
  );
}
