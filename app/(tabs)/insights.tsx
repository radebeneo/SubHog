import SubscriptionIcon from "@/components/SubscriptionIcon";
import { useSubscriptions } from "@/context/SubscriptionContext";
import { formatCurrency } from "@/lib/utils";
import dayjs from "dayjs";
import { styled } from "nativewind";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

const getMonthlyCost = (subscription: Subscription) =>
  subscription.billing === "Yearly"
    ? subscription.price / 12
    : subscription.price;

const Insights = () => {
  const { subscriptions } = useSubscriptions();
  const activeSubscriptions = subscriptions.filter(
    (subscription) => subscription.status === "active",
  );
  const monthlySpend = activeSubscriptions.reduce(
    (total, subscription) => total + getMonthlyCost(subscription),
    0,
  );
  const averageCost = activeSubscriptions.length
    ? monthlySpend / activeSubscriptions.length
    : 0;
  const categories = Object.entries(
    activeSubscriptions.reduce<Record<string, number>>(
      (totals, subscription) => {
        const category = subscription.category || "Other";
        totals[category] =
          (totals[category] || 0) + getMonthlyCost(subscription);
        return totals;
      },
      {},
    ),
  )
    .sort(([, firstTotal], [, secondTotal]) => secondTotal - firstTotal)
    .slice(0, 4);
  const largestCategorySpend = categories[0]?.[1] || 0;
  const upcomingRenewals = [...activeSubscriptions]
    .filter((subscription) => subscription.renewalDate)
    .sort(
      (first, second) =>
        dayjs(first.renewalDate).valueOf() -
        dayjs(second.renewalDate).valueOf(),
    )
    .slice(0, 3);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="px-5"
        contentContainerClassName="pb-28"
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-1 mt-2 text-3xl font-sans-bold text-primary">
          Monthly Insights
        </Text>
        <Text className="mb-5 text-base font-sans-medium text-muted-foreground">
          A clearer view of where your money goes.
        </Text>

        <View className="rounded-bl-4xl rounded-tr-4xl bg-primary p-6">
          <Text className="text-sm font-sans-semibold text-white/70">
            Estimated monthly spend
          </Text>
          <Text className="mt-2 text-4xl font-sans-extrabold text-white">
            {formatCurrency(monthlySpend)}
          </Text>
          <Text className="mt-2 text-sm font-sans-medium text-white/70">
            Across {activeSubscriptions.length} active subscription
            {activeSubscriptions.length === 1 ? "" : "s"}
          </Text>
        </View>

        <View className="my-5 flex-row gap-3">
          <View className="min-h-28 flex-1 rounded-2xl border border-border bg-card p-4">
            <Text className="text-sm font-sans-semibold text-muted-foreground">
              Average cost
            </Text>
            <Text className="mt-2 text-xl font-sans-bold text-primary">
              {formatCurrency(averageCost)}
            </Text>
            <Text className="mt-1 text-xs font-sans-medium text-muted-foreground">
              per active service
            </Text>
          </View>
          <View className="min-h-28 flex-1 rounded-2xl border border-border bg-card p-4">
            <Text className="text-sm font-sans-semibold text-muted-foreground">
              Annual outlook
            </Text>
            <Text className="mt-2 text-xl font-sans-bold text-primary">
              {formatCurrency(monthlySpend * 12)}
            </Text>
            <Text className="mt-1 text-xs font-sans-medium text-muted-foreground">
              at today&apos;s pace
            </Text>
          </View>
        </View>

        <Text className="mb-3 text-2xl font-sans-bold text-primary">
          Spending by category
        </Text>
        <View className="rounded-2xl border border-border bg-card p-4">
          {categories.length ? (
            categories.map(([category, total], index) => (
              <View
                className={index < categories.length - 1 ? "mb-4" : ""}
                key={category}
              >
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-base font-sans-semibold text-primary">
                    {category}
                  </Text>
                  <Text className="text-sm font-sans-bold text-primary">
                    {formatCurrency(total)}
                  </Text>
                </View>
                <View className="h-2 overflow-hidden rounded-full bg-muted">
                  <View
                    className="h-full rounded-full bg-accent"
                    style={{
                      width: `${largestCategorySpend ? (total / largestCategorySpend) * 100 : 0}%`,
                    }}
                  />
                </View>
              </View>
            ))
          ) : (
            <Text className="text-base font-sans-medium text-muted-foreground">
              Add an active subscription to see your category breakdown.
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
                  <Text
                    className="text-base font-sans-bold text-primary"
                    numberOfLines={1}
                  >
                    {subscription.name}
                  </Text>
                  <Text className="mt-1 text-sm font-sans-semibold text-muted-foreground">
                    {subscription.renewalDate
                      ? dayjs(subscription.renewalDate).format("DD MMM YYYY")
                      : "Date not provided"}
                  </Text>
                </View>
                <Text className="text-base font-sans-bold text-primary">
                  {formatCurrency(
                    getMonthlyCost(subscription),
                    subscription.currency,
                  )}
                </Text>
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
