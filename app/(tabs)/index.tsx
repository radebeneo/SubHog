import CreateSubscriptionModal from "@/components/CreateSubscriptionModal";
import ListHeading from "@/components/ListHeading";
import SubscriptionCard from "@/components/SubscriptionCard";
import UpcomingSubscriptionCard from "@/components/UpcomingSubscriptionCard";
import { icons } from "@/constants/icons";
import images from "@/constants/images";
import { colors, spacing } from "@/constants/theme";
import { useSubscriptions } from "@/context/SubscriptionContext";
import "@/global.css";
import { useSubscriptionSummary } from "@/hooks/useSubscriptionSummary";
import { posthog, sanitizePostHogProperties } from "@/lib/posthog";
import { formatCurrency } from "@/lib/utils";
import { useUser } from "@clerk/expo";
import dayjs from "dayjs";
import { useState } from "react";
import { FlatList, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function App() {
  const [expandedSubscriptionId, setExpandedSubscriptionId] = useState<
    string | null
  >(null);
  const { subscriptions, addSubscription } = useSubscriptions();
  const { monthlySpend, nextRenewalDate, upcomingSubscriptions } =
    useSubscriptionSummary();
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const { user } = useUser();
  const displayName =
    user?.firstName || user?.emailAddresses[0]?.emailAddress || "Subscriber";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background, padding: spacing[5] }}
    >
      <FlatList
        ListHeaderComponent={
          <>
            <View className="home-header">
              <View className="home-user">
                <Image
                  className="home-avatar"
                  source={user?.imageUrl ? { uri: user.imageUrl } : images.avatar}
                />
                <Text className="home-user-name">{displayName}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add subscription"
                onPress={() => setIsCreateModalVisible(true)}
              >
                <Image source={icons.add} className="home-add-icon" />
              </Pressable>
            </View>

            <View className="home-balance-card">
              <Text className="home-balance-label">Monthly spend</Text>
              <View className="home-summary__row">
                <Text className="home-balance-amount">
                  {formatCurrency(monthlySpend)}
                </Text>
                <View className="home-summary__renewal">
                  <Text className="home-summary__caption">Next renewal</Text>
                  <Text className="home-balance-date">
                    {nextRenewalDate
                      ? dayjs(nextRenewalDate).format("DD MMM")
                      : "None"}
                  </Text>
                </View>
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
                  <Text className="home-empty-state">No upcoming renewals.</Text>
                }
              />
            </View>
            <ListHeading title="All Subscriptions" />
          </>
        }
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
          <View>
            <Text className="home-empty-state">
              No subscriptions yet. Add your first to start tracking your spending.
            </Text>
            <Pressable
              className="auth-button"
              accessibilityRole="button"
              onPress={() => setIsCreateModalVisible(true)}
            >
              <Text className="auth-button-text">Add subscription</Text>
            </Pressable>
          </View>
        }
        extraData={expandedSubscriptionId}
        ItemSeparatorComponent={() => <View className="h-4" />}
        contentContainerClassName="pb-20"
      />
      <CreateSubscriptionModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onCreate={addSubscription}
      />
    </SafeAreaView>
  );
}
