import { posthog, sanitizePostHogProperties } from "@/adapters/posthog";
import type { SubscriptionActionResult } from "@/features/subscriptions/subscription-controller";
import {
  SUBSCRIPTION_CATEGORIES,
  SUBSCRIPTION_FREQUENCIES,
  type CreateSubscriptionRequest,
  type SubscriptionCategory,
  type SubscriptionFrequency,
} from "@subhog/contracts";
import {
  calculateNextRenewalDate,
  isPositiveMoneyAmount,
} from "@subhog/domain";
import { clsx } from "clsx";
import dayjs from "dayjs";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

interface CreateSubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (
    payload: CreateSubscriptionRequest,
  ) => Promise<SubscriptionActionResult>;
  initialSubscription?: Subscription;
}

const formatOption = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export default function CreateSubscriptionModal({
  ...props
}: CreateSubscriptionModalProps) {
  return (
    <SubscriptionModalContent
      key={`${props.visible}-${props.initialSubscription?.id ?? "new"}`}
      {...props}
    />
  );
}

function SubscriptionModalContent({
  visible,
  onClose,
  onSubmit,
  initialSubscription,
}: CreateSubscriptionModalProps) {
  const [name, setName] = useState(initialSubscription?.name ?? "");
  const [price, setPrice] = useState(
    initialSubscription ? String(initialSubscription.price) : "",
  );
  const [frequency, setFrequency] =
    useState<SubscriptionFrequency>(
      initialSubscription?.frequency ?? "monthly",
    );
  const [category, setCategory] =
    useState<SubscriptionCategory>(
      (initialSubscription?.category as SubscriptionCategory | undefined) ??
        "others",
    );
  const [paymentMethod, setPaymentMethod] = useState(
    initialSubscription?.paymentMethod ?? "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericPrice = Number(price);
  const isValid =
    name.trim().length > 0 &&
    paymentMethod.trim().length > 0 &&
    isPositiveMoneyAmount(numericPrice);

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    const startDate = initialSubscription?.startDate
      ? dayjs(initialSubscription.startDate)
      : dayjs();
    const payload: CreateSubscriptionRequest = {
      name: name.trim(),
      price: numericPrice,
      currency: "ZAR",
      frequency,
      category,
      paymentMethod: paymentMethod.trim(),
      startDate: startDate.toISOString(),
      renewalDate: calculateNextRenewalDate(startDate.toDate(), frequency),
    };

    try {
      const result = await onSubmit(payload);
      if (result.status !== "success") {
        if (result.status !== "stale") {
          setError(
            result.status === "ambiguous"
              ? "The result could not be confirmed after rechecking your subscriptions. Review the list before trying again."
              : result.failure.message,
          );
        }
        return;
      }

      posthog?.capture(
        initialSubscription
          ? "subscription_updated"
          : "subscription_created",
        sanitizePostHogProperties({
          subscription_name: payload.name,
          subscription_price: payload.price,
          subscription_frequency: payload.frequency,
          subscription_category: payload.category,
          currency: payload.currency,
        }),
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="modal-overlay"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="modal-container">
          <View className="modal-header">
            <Text className="modal-title">
              {initialSubscription
                ? "Edit Subscription"
                : "New Subscription"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close subscription form"
              className="modal-close"
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text className="modal-close-text">x</Text>
            </Pressable>
          </View>

          <ScrollView
            className="max-h-full"
            contentContainerClassName="modal-body"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <FormField label="Name">
              <TextInput
                className="auth-input"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Netflix"
                placeholderTextColor="rgba(0, 0, 0, 0.4)"
                autoCapitalize="words"
                accessibilityLabel="Subscription name"
                editable={!isSubmitting}
              />
            </FormField>

            <FormField label="Price">
              <TextInput
                className="auth-input"
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                placeholderTextColor="rgba(0, 0, 0, 0.4)"
                keyboardType="decimal-pad"
                accessibilityLabel="Subscription price"
                editable={!isSubmitting}
              />
            </FormField>

            <FormField label="Payment method">
              <TextInput
                className="auth-input"
                value={paymentMethod}
                onChangeText={setPaymentMethod}
                placeholder="e.g. Visa ending 1234"
                placeholderTextColor="rgba(0, 0, 0, 0.4)"
                accessibilityLabel="Payment method"
                editable={!isSubmitting}
              />
            </FormField>

            <FormField label="Frequency">
              <View className="flex-row flex-wrap gap-2">
                {SUBSCRIPTION_FREQUENCIES.map((option) => (
                  <Pressable
                    key={option}
                    className={clsx(
                      "picker-option",
                      frequency === option && "picker-option-active",
                    )}
                    onPress={() => setFrequency(option)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: frequency === option }}
                    disabled={isSubmitting}
                  >
                    <Text
                      className={clsx(
                        "picker-option-text",
                        frequency === option && "picker-option-text-active",
                      )}
                    >
                      {formatOption(option)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </FormField>

            <FormField label="Category">
              <View className="category-scroll">
                {SUBSCRIPTION_CATEGORIES.map((option) => (
                  <Pressable
                    key={option}
                    className={clsx(
                      "category-chip",
                      category === option && "category-chip-active",
                    )}
                    onPress={() => setCategory(option)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: category === option }}
                    disabled={isSubmitting}
                  >
                    <Text
                      className={clsx(
                        "category-chip-text",
                        category === option && "category-chip-text-active",
                      )}
                    >
                      {formatOption(option)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </FormField>

            {error && <Text className="auth-error">{error}</Text>}
            <Pressable
              className={clsx(
                "auth-button",
                (!isValid || isSubmitting) && "auth-button-disabled",
              )}
              onPress={() => void handleSubmit()}
              disabled={!isValid || isSubmitting}
              accessibilityRole="button"
            >
              <Text className="auth-button-text">
                {isSubmitting
                  ? "Saving..."
                  : initialSubscription
                    ? "Save Changes"
                    : "Create Subscription"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="auth-field">
      <Text className="auth-label">{label}</Text>
      {children}
    </View>
  );
}
