import SubscriptionIcon from "@/components/SubscriptionIcon";
import SubscriptionStateView from "@/components/SubscriptionStateView";
import { useSubscriptions } from "@/providers/SubscriptionContext";
import { formatCurrency } from "@/features/subscriptions/utils";
import { getUpcomingRenewals, groupRecurringAmounts } from "@subhog/domain";
import dayjs from "dayjs";
import { styled } from "nativewind";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

const Insights = () => {
  const { state, subscriptions } = useSubscriptions();

  if (state.status !== "ready") {
    return <SubscriptionStateView />;
  }

  const activeSubscriptions = subscriptions.filter(
    (subscription) => subscription.status === "active",
  );
  const spendGroups = groupRecurringAmounts(activeSubscriptions);
  const upcomingRenewals = getUpcomingRenewals(activeSubscriptions, 3);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="px-5"
        contentContainerClassName="pb-28"
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-1 mt-2 text-3xl font-sans-bold text-primary">
          Subscription Insights
        </Text>
        <Text className="mb-5 text-base font-sans-medium text-muted-foreground">
          Amounts stay separated by currency and billing frequency.
        </Text>

        <View className="rounded-bl-4xl rounded-tr-4xl bg-primary p-6">
          <Text className="text-sm font-sans-semibold text-white/70">
            Active subscriptions
          </Text>
          <Text className="mt-2 text-4xl font-sans-extrabold text-white">
            {activeSubscriptions.length}
          </Text>
        </View>

        <Text className="mb-3 mt-6 text-2xl font-sans-bold text-primary">
          Recurring amounts
        </Text>
        <View className="rounded-2xl border border-border bg-card p-4">
          {spendGroups.length ? (
            spendGroups.map(([key, group], index) => (
              <View
                className={
                  index < spendGroups.length - 1
                    ? "mb-4 flex-row items-center justify-between"
                    : "flex-row items-center justify-between"
                }
                key={key}
              >
                <Text className="text-base font-sans-semibold text-primary">
                  {group.billing}
                </Text>
                <Text className="text-base font-sans-bold text-primary">
                  {formatCurrency(group.total, group.currency)}
                </Text>
              </View>
            ))
          ) : (
            <Text className="text-base font-sans-medium text-muted-foreground">
              No active subscriptions yet.
            </Text>
          )}
        </View>

        <Text className="mb-3 mt-6 text-2xl font-sans-bold text-primary">
          Next renewals
        </Text>
        <View className="rounded-2xl border border-border bg-card p-4">
          {upcomingRenewals.length ? (
            upcomingRenewals.map((subscription, index) => (
              <View
                className={
                  index < upcomingRenewals.length - 1
                    ? "mb-4 flex-row items-center"
                    : "flex-row items-center"
                }
                key={subscription.id}
              >
                <SubscriptionIcon
                  source={subscription.icon}
                  size={48}
                  className="size-12 rounded-lg"
                />
                <View className="ml-3 min-w-0 flex-1">
                  <Text className="text-base font-sans-bold text-primary" numberOfLines={1}>
                    {subscription.name}
                  </Text>
                  <Text className="mt-1 text-sm font-sans-semibold text-muted-foreground">
                    {dayjs(subscription.renewalDate).format("DD MMM YYYY")}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-base font-sans-bold text-primary">
                    {formatCurrency(subscription.price, subscription.currency)}
                  </Text>
                  <Text className="text-xs font-sans-medium text-muted-foreground">
                    {subscription.billing}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text className="text-base font-sans-medium text-muted-foreground">
              No upcoming renewals yet.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Insights;
