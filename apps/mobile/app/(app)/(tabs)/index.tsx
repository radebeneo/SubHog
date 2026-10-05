import CreateSubscriptionModal from "@/components/CreateSubscriptionModal";
import ListHeading from "@/components/ListHeading";
import SubscriptionCard from "@/components/SubscriptionCard";
import SubscriptionStateView from "@/components/SubscriptionStateView";
import UpcomingSubscriptionCard from "@/components/UpcomingSubscriptionCard";
import images from "@/config/images";
import { getUpcomingSubscriptions } from "@/features/subscriptions/utils";
import { useSubscriptions } from "@/providers/SubscriptionContext";
import { useUser } from "@clerk/expo";
import { router } from "expo-router";
import { styled } from "nativewind";
import { Fragment, useState } from "react";
import { FlatList, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

export default function Home() {
  const [createVisible, setCreateVisible] = useState(false);
  const { state, subscriptions, createSubscription } = useSubscriptions();
  const { user } = useUser();
  const displayName =
    user?.firstName ||
    user?.emailAddresses[0]?.emailAddress ||
    "Subscriber";

  if (state.status !== "ready") return <SubscriptionStateView />;

  const activeSubscriptions = subscriptions.filter(
    (subscription) => subscription.status === "active",
  );
  const upcomingSubscriptions = getUpcomingSubscriptions(subscriptions).slice(
    0,
    4,
  );
  const openSubscription = (id: string) =>
    router.push({ pathname: "/subscriptions/[id]", params: { id } });

  return (
    <SafeAreaView className="flex-1 bg-background p-5">
      <FlatList
        ListHeaderComponent={() => (
          <Fragment>
            <View className="home-header">
              <View className="home-user">
                <Image
                  className="home-avatar"
                  source={
                    user?.imageUrl ? { uri: user.imageUrl } : images.avatar
                  }
                />
                <Text className="home-user-name">{displayName}</Text>
              </View>
              <Pressable
                className="rounded-full bg-primary px-4 py-2"
                onPress={() => setCreateVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Add subscription"
              >
                <Text className="font-sans-bold text-background">Add</Text>
              </Pressable>
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
              <ListHeading
                title="Upcoming"
                onPress={() =>
                  router.push({
                    pathname: "/subscriptions",
                    params: { view: "upcoming" },
                  })
                }
              />
              <FlatList
                data={upcomingSubscriptions}
                horizontal
                renderItem={({ item }) => (
                  <UpcomingSubscriptionCard
                    {...item}
                    onPress={() => openSubscription(item.id)}
                  />
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

            <ListHeading
              title="All Subscriptions"
              onPress={() => router.push("/subscriptions")}
            />
          </Fragment>
        )}
        data={subscriptions}
        renderItem={({ item }) => (
          <SubscriptionCard
            {...item}
            onPress={() => openSubscription(item.id)}
          />
        )}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text className="home-empty-state">No subscriptions found.</Text>
        }
        ItemSeparatorComponent={() => <View className="h-4" />}
        contentContainerClassName="pb-20"
      />
      <CreateSubscriptionModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onSubmit={createSubscription}
      />
    </SafeAreaView>
  );
}
