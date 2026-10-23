import DeleteSubscriptionModal from "@/components/DeleteSubscriptionModal";
import EditSubscriptionModal from "@/components/EditSubscriptionModal";
import SubscriptionCard from "@/components/SubscriptionCard";
import SubscriptionDataNotice from "@/components/SubscriptionDataNotice";
import images from "@/constants/images";
import { colors, spacing } from "@/constants/theme";
import { useSubscriptions } from "@/context/SubscriptionContext";
import { posthog, sanitizePostHogProperties } from "@/lib/posthog";
import {
  getSubscriptionPage,
  shouldScrollSubscriptions,
  SUBSCRIPTIONS_PER_PAGE,
} from "@/lib/subscription-list";
import { useState } from "react";
import {
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const Subscriptions = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
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
  const { items: pageSubscriptions, page, pageCount } =
    getSubscriptionPage(subscriptions, currentPage);
  const canScroll = shouldScrollSubscriptions(
    pageSubscriptions.length,
    contentHeight,
    viewportHeight,
  );

  // Clamp before rendering children if deletion or editing removes a page.
  if (currentPage !== page) {
    setCurrentPage(page);
    setContentHeight(0);
    setExpandedSubscriptionId(null);
  }

  const changePage = (nextPage: number) => {
    setCurrentPage(nextPage);
    setContentHeight(0);
    setExpandedSubscriptionId(null);
  };

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
          onChangeText={(query) => {
            setSearchQuery(query);
            if (query.trim().toLowerCase() !== normalizedQuery) changePage(1);
          }}
          placeholder="Search subscriptions"
          placeholderTextColor="rgba(0,0,0,0.6)"
          autoCapitalize="none"
          autoCorrect={false}
          className="mb-5 rounded-2xl border border-border bg-card px-4 py-3 text-base font-sans-medium text-primary"
          accessibilityLabel="Search subscriptions"
        />
        <SubscriptionDataNotice />
        <View className="subscription-list__body">
          {status === "ready" && subscriptions.length === 0 ? (
            <View className="subscription-empty__viewport" testID="subscriptions-empty-state">
              <View className="subscription-empty__image subscription-empty__image-frame">
                <Image
                  source={images.emptyState}
                  className="absolute inset-0 size-full"
                  resizeMode="contain"
                  accessibilityLabel={
                    normalizedQuery ? "No subscriptions found" : "No subscriptions yet"
                  }
                />
              </View>
            </View>
          ) : (
            <FlatList
              key={`${normalizedQuery}:${page}`}
              data={pageSubscriptions}
              initialNumToRender={SUBSCRIPTIONS_PER_PAGE}
              scrollEnabled={canScroll}
              bounces={false}
              alwaysBounceVertical={false}
              overScrollMode="never"
              onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
              onContentSizeChange={(_width, height) => setContentHeight(height)}
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
              ItemSeparatorComponent={() => <View className="h-4" />}
              className="flex-1"
            />
          )}
          {status === "ready" && pageCount > 1 && (
            <View className="subscription-pagination__controls">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous subscriptions page"
                accessibilityState={{ disabled: page === 1 }}
                disabled={page === 1}
                className={
                  page === 1
                    ? "subscription-pagination__button subscription-pagination__button--disabled"
                    : "subscription-pagination__button"
                }
                onPress={() => changePage(page - 1)}
              >
                <Text className="subscription-pagination__button-text">Previous</Text>
              </Pressable>
              <Text
                className="subscription-pagination__label"
                accessibilityLiveRegion="polite"
              >
                Page {page} of {pageCount}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next subscriptions page"
                accessibilityState={{ disabled: page === pageCount }}
                disabled={page === pageCount}
                className={
                  page === pageCount
                    ? "subscription-pagination__button subscription-pagination__button--disabled"
                    : "subscription-pagination__button"
                }
                onPress={() => changePage(page + 1)}
              >
                <Text className="subscription-pagination__button-text">Next</Text>
              </Pressable>
            </View>
          )}
        </View>
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
