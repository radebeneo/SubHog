import DeleteSubscriptionModal from "@/components/DeleteSubscriptionModal";
import EditSubscriptionModal from "@/components/EditSubscriptionModal";
import SubscriptionCard from "@/components/SubscriptionCard";
import SubscriptionDataNotice from "@/components/SubscriptionDataNotice";
import { colors, spacing } from "@/constants/theme";
import { useSubscriptions } from "@/context/SubscriptionContext";
import { posthog, sanitizePostHogProperties } from "@/lib/posthog";
import { useState } from "react";
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const Subscriptions = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSubscriptionId, setExpandedSubscriptionId] = useState<
    string | null
  >(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { subscriptions: allSubscriptions, updateSubscription, deleteSubscription, status, canWrite } =
    useSubscriptions();
  const editingSubscription = allSubscriptions.find((item) => item.id === editingId);
  const deletingSubscription = allSubscriptions.find((item) => item.id === deletingId);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const subscriptions = allSubscriptions.filter((subscription) => {
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
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background, padding: spacing[5] }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
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
        <SubscriptionDataNotice />
        <FlatList
          data={subscriptions}
          renderItem={({ item }) => (
            <SubscriptionCard
              {...item}
              expanded={expandedSubscriptionId === item.id}
              onEditPress={() => setEditingId(item.id)}
              onDeletePress={() => setDeletingId(item.id)}
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
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          ListEmptyComponent={
            status === "ready" ? <Text className="home-empty-state">No subscriptions found.</Text> : null
          }
          ItemSeparatorComponent={() => <View className="h-4" />}
          contentContainerClassName="pb-20"
        />
      </KeyboardAvoidingView>
      {editingSubscription && (
        <EditSubscriptionModal
          key={editingSubscription.id}
          subscription={editingSubscription}
          onClose={() => setEditingId(null)}
          canWrite={canWrite}
          onSave={(fields) => updateSubscription(editingSubscription.id, fields)}
        />
      )}
      {deletingSubscription && (
        <DeleteSubscriptionModal
          name={deletingSubscription.name}
          onClose={() => setDeletingId(null)}
          canWrite={canWrite}
          onConfirm={() => deleteSubscription(deletingSubscription.id)}
        />
      )}
    </SafeAreaView>
  );
};

export default Subscriptions;
