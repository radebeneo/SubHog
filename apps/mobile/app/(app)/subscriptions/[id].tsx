import CreateSubscriptionModal from "@/components/CreateSubscriptionModal";
import SubscriptionIcon from "@/components/SubscriptionIcon";
import SubscriptionStateView from "@/components/SubscriptionStateView";
import {
  formatCurrency,
  formatStatusLabel,
  formatSubscriptionDateTime,
} from "@/features/subscriptions/utils";
import { useSubscriptions } from "@/providers/SubscriptionContext";
import { router, useLocalSearchParams } from "expo-router";
import { styled } from "nativewind";
import { Fragment, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

export default function SubscriptionDetails() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const {
    state,
    subscriptions,
    getSubscription,
    updateSubscription,
    cancelSubscription,
    deleteSubscription,
    clearAction,
  } = useSubscriptions();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "cancel" | "delete" | null
  >(null);
  const subscription = subscriptions.find((item) => item.id === id);

  useEffect(() => {
    if (state.status !== "ready" || !id) return;

    let active = true;
    clearAction();
    void getSubscription(id).then((result) => {
      if (!active || result.status === "stale") return;
      if (result.status === "success") {
        setNotFound(false);
      } else {
        setNotFound(result.failure.code === "SUBSCRIPTION_NOT_FOUND");
        setMessage(result.failure.message);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [clearAction, getSubscription, id, state.status]);

  if (state.status !== "ready") return <SubscriptionStateView />;

  const describeFailure = (status: string, failureMessage: string) =>
    status === "ambiguous"
      ? "The request result is uncertain after rechecking your subscriptions. Review the current status before trying again."
      : failureMessage;

  const performCancel = async () => {
    if (!id) return;
    setPendingAction("cancel");
    setMessage(null);
    try {
      const result = await cancelSubscription(id);
      if (result.status === "success") {
        setMessage("Subscription tracking was cancelled.");
      } else if (result.status !== "stale") {
        setMessage(describeFailure(result.status, result.failure.message));
      }
    } finally {
      setPendingAction(null);
    }
  };

  const performDelete = async () => {
    if (!id) return;
    setPendingAction("delete");
    setMessage(null);
    try {
      const result = await deleteSubscription(id);
      if (result.status === "success") {
        router.replace("/subscriptions");
      } else if (result.status !== "stale") {
        setMessage(describeFailure(result.status, result.failure.message));
      }
    } finally {
      setPendingAction(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background p-6">
        <ActivityIndicator size="large" />
        <Text className="mt-4 font-sans-medium text-primary">
          Loading subscription...
        </Text>
      </SafeAreaView>
    );
  }

  if (!id || notFound || !subscription) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-center text-2xl font-sans-bold text-primary">
          Subscription not found
        </Text>
        <Text className="mt-3 text-center font-sans-medium text-muted-foreground">
          {message ?? "This subscription is unavailable or no longer exists."}
        </Text>
        <Pressable
          className="auth-button mt-6 w-full"
          onPress={() => router.replace("/subscriptions")}
          accessibilityRole="button"
        >
          <Text className="auth-button-text">Back to subscriptions</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="p-5 pb-12">
        <Pressable
          className="mb-6 self-start"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text className="font-sans-bold text-accent">Back</Text>
        </Pressable>

        <View className="items-center rounded-3xl bg-card p-6">
          <SubscriptionIcon
            source={subscription.icon}
            size={80}
            className="h-20 w-20"
          />
          <Text className="mt-4 text-center text-3xl font-sans-bold text-primary">
            {subscription.name}
          </Text>
          <Text className="mt-2 text-xl font-sans-bold text-accent">
            {formatCurrency(subscription.price, subscription.currency)}
          </Text>
          <Text className="mt-1 font-sans-medium text-muted-foreground">
            {subscription.billing}
          </Text>
        </View>

        <View className="mt-5 rounded-3xl border border-border bg-card p-5">
          <DetailRow label="Category" value={subscription.category} />
          <DetailRow
            label="Status"
            value={formatStatusLabel(subscription.status)}
          />
          <DetailRow label="Payment" value={subscription.paymentMethod} />
          <DetailRow
            label="Started"
            value={formatSubscriptionDateTime(subscription.startDate)}
          />
          <DetailRow
            label="Renewal"
            value={formatSubscriptionDateTime(
              subscription.renewalDate ?? undefined,
            )}
          />
        </View>

        {message && (
          <Text
            className="mt-4 text-center font-sans-medium text-destructive"
            accessibilityRole="alert"
          >
            {message}
          </Text>
        )}

        <Pressable
          className="auth-button mt-6"
          onPress={() => setEditing(true)}
          disabled={pendingAction !== null}
          accessibilityRole="button"
        >
          <Text className="auth-button-text">Edit subscription</Text>
        </Pressable>

        {subscription.status === "active" && (
          <Fragment>
            <Pressable
              className="auth-secondary-button mt-3"
              disabled={pendingAction !== null}
              onPress={() =>
                Alert.alert(
                  "Cancel subscription tracking?",
                  "This only marks the subscription as cancelled in SubHog. It does not cancel billing with the merchant.",
                  [
                    { text: "Keep tracking", style: "cancel" },
                    {
                      text: "Cancel tracking",
                      style: "destructive",
                      onPress: () => void performCancel(),
                    },
                  ],
                )
              }
              accessibilityRole="button"
            >
              <Text className="auth-secondary-button-text">
                {pendingAction === "cancel"
                  ? "Cancelling..."
                  : "Cancel tracking"}
              </Text>
            </Pressable>
            <Text className="mt-2 text-center text-sm font-sans-medium text-muted-foreground">
              Cancelling tracking in SubHog does not cancel merchant billing.
            </Text>
          </Fragment>
        )}

        <Pressable
          className="mt-6 rounded-2xl border border-destructive px-5 py-4"
          disabled={pendingAction !== null}
          onPress={() =>
            Alert.alert(
              "Delete subscription?",
              "This permanently removes the subscription from SubHog.",
              [
                { text: "Keep subscription", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => void performDelete(),
                },
              ],
            )
          }
          accessibilityRole="button"
        >
          <Text className="text-center font-sans-bold text-destructive">
            {pendingAction === "delete"
              ? "Deleting..."
              : "Delete subscription"}
          </Text>
        </Pressable>
      </ScrollView>

      <CreateSubscriptionModal
        visible={editing}
        initialSubscription={subscription}
        onClose={() => setEditing(false)}
        onSubmit={(payload) => updateSubscription(subscription.id, payload)}
      />
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <View className="mb-4 flex-row justify-between gap-4">
      <Text className="font-sans-semibold text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-right font-sans-bold text-primary">
        {value?.trim() || "Not provided"}
      </Text>
    </View>
  );
}
