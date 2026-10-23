import SubscriptionDataNotice from "@/components/SubscriptionDataNotice";
import { SUBSCRIPTION_CATEGORIES } from "@/constants/subscriptions";
import { useSubscriptionAction } from "@/hooks/useSubscriptionAction";
import { posthog, sanitizePostHogProperties } from "@/lib/posthog";
import { parseSubscriptionForm } from "@/lib/subscription-form";
import { findSubscriptionIconRecord } from "@/lib/subscription-icons";
import type { SubscriptionFields, SubscriptionIcon } from "@/types/subscription-record";
import clsx from "clsx";
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

const categories = SUBSCRIPTION_CATEGORIES;

type Frequency = "Monthly" | "Yearly";

interface CreateSubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (fields: SubscriptionFields, icon: SubscriptionIcon) => Promise<void>;
  canWrite: boolean;
}

const CreateSubscriptionModal = ({
  visible,
  onClose,
  onCreate,
  canWrite,
}: CreateSubscriptionModalProps) => {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("Monthly");
  const [category, setCategory] = useState<(typeof categories)[number]>("Other");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const { pending, error, isPending, run } = useSubscriptionAction();
  const [startDate] = useState(() => dayjs());
  const parsed = parseSubscriptionForm({
    name, price, frequency, category,
    startDate: startDate.format("YYYY-MM-DD"),
    renewalDate: startDate.add(1, frequency === "Monthly" ? "month" : "year").format("YYYY-MM-DD"),
    plan: "", paymentMethod: "", reminderEmail: "",
  });
  const errors = parsed.ok ? {} : parsed.errors;

  const handleClose = (): void => {
    if (!isPending()) onClose();
  };
  const handleSubmit = async (): Promise<void> => {
    setHasSubmitted(true);
    if (!parsed.ok || !canWrite) return;
    await run(async (isCurrent) => {
      const icon = await findSubscriptionIconRecord(parsed.fields.name);
      if (!isCurrent()) return;
      await onCreate(parsed.fields, icon);
    }, () => {
      // Analytics is best-effort and only follows a confirmed write.
      try {
        posthog?.capture("subscription_created", sanitizePostHogProperties({
          subscription_name: parsed.fields.name,
          subscription_price: parsed.fields.amountCents / 100,
          subscription_frequency: frequency,
          subscription_category: category,
          currency: "ZAR",
        }));
      } catch {
        // Analytics must not turn a successful backend write into a form failure.
      }
      onClose();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View className="modal-overlay">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="modal-container">
          <View className="modal-header">
            <Text className="modal-title">New Subscription</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="modal-close"
              onPress={handleClose}
              disabled={pending}
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
            <SubscriptionDataNotice />
            <View className="auth-field">
              <Text className="auth-label">Name</Text>
              <TextInput
                className="auth-input"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Netflix"
                placeholderTextColor="rgba(0, 0, 0, 0.4)"
                autoCapitalize="words"
                editable={!pending}
                accessibilityLabel="Subscription name"
              />
            </View>

            <View className="auth-field">
              <Text className="auth-label">Price</Text>
              <TextInput
                className="auth-input"
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                placeholderTextColor="rgba(0, 0, 0, 0.4)"
                keyboardType="decimal-pad"
                editable={!pending}
                accessibilityLabel="Price in ZAR"
              />
            </View>

            <View className="auth-field">
              <Text className="auth-label">Frequency</Text>
              <View className="picker-row">
                {(["Monthly", "Yearly"] as Frequency[]).map((option) => (
                  <Pressable
                    key={option}
                    disabled={pending}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: option === frequency, disabled: pending }}
                    className={clsx(
                      "picker-option",
                      frequency === option && "picker-option-active",
                    )}
                    onPress={() => setFrequency(option)}
                  >
                    <Text
                      className={clsx(
                        "picker-option-text",
                        frequency === option && "picker-option-text-active",
                      )}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="auth-field">
              <Text className="auth-label">Category</Text>
              <View className="category-scroll">
                {categories.map((option) => (
                  <Pressable
                    key={option}
                    disabled={pending}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: option === category, disabled: pending }}
                    className={clsx(
                      "category-chip",
                      category === option && "category-chip-active",
                    )}
                    onPress={() => setCategory(option)}
                  >
                    <Text
                      className={clsx(
                        "category-chip-text",
                        category === option && "category-chip-text-active",
                      )}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {hasSubmitted && !parsed.ok && (
              <Text className="auth-error" accessibilityLiveRegion="polite">
                {Object.values(errors).join("\n")}
              </Text>
            )}
            {error && <Text className="auth-error" accessibilityLiveRegion="polite">{error}</Text>}
            <Pressable
              className={clsx(
                "auth-button",
                (!canWrite || pending) && "auth-button-disabled",
              )}
              onPress={handleSubmit}
              disabled={!canWrite || pending}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canWrite || pending, busy: pending }}
            >
              <Text className="auth-button-text">
                {pending ? "Creating…" : "Create Subscription"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default CreateSubscriptionModal;
