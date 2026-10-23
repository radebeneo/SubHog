import SubscriptionDataNotice from "@/components/SubscriptionDataNotice";
import { colors, spacing } from "@/constants/theme";
import { SUBSCRIPTION_CATEGORIES } from "@/constants/subscriptions";
import { useSubscriptionAction } from "@/hooks/useSubscriptionAction";
import { createPersistedSubscriptionDraft, parseSubscriptionForm } from "@/lib/subscription-form";
import type { SubscriptionDraft } from "@/types/subscription";
import type { SubscriptionFields } from "@/types/subscription-record";
import { clsx } from "clsx";
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
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface EditSubscriptionModalProps {
  subscription: Subscription;
  onClose: () => void;
  onSave: (fields: SubscriptionFields) => Promise<void>;
  canWrite: boolean;
}

interface DraftField {
  key: Exclude<keyof SubscriptionDraft, "frequency" | "category">;
  label: string;
  placeholder: string;
  helper?: string;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
}

const fields: DraftField[] = [
  { key: "name", label: "Name", placeholder: "e.g. Netflix", autoCapitalize: "words" },
  { key: "plan", label: "Plan (optional)", placeholder: "e.g. Premium" },
  { key: "price", label: "Price", placeholder: "0.00", keyboardType: "decimal-pad" },
  { key: "startDate", label: "Start date", placeholder: "YYYY-MM-DD", helper: "Use YYYY-MM-DD, e.g. 2026-10-23." },
  { key: "renewalDate", label: "Renewal date (optional)", placeholder: "YYYY-MM-DD", helper: "Leave blank if unknown. Past dates roll forward by billing cycle on Home." },
  { key: "paymentMethod", label: "Payment method (optional)", placeholder: "e.g. Visa or PayPal", helper: "Use a label only. Do not enter card numbers or security codes." },
  { key: "reminderEmail", label: "Reminder email (optional)", placeholder: "you@example.com", keyboardType: "email-address", helper: "Stored only for now. No reminder emails are sent." },
];

export default function EditSubscriptionModal({
  subscription,
  onClose,
  onSave,
  canWrite,
}: EditSubscriptionModalProps) {
  // The screen mounts a fresh editor for each edit session; read retries retain it.
  const [draft, setDraft] = useState(() => createPersistedSubscriptionDraft(subscription));
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const { pending, error, isPending, run } = useSubscriptionAction();
  const parsed = parseSubscriptionForm(draft);
  const errors = parsed.ok ? {} : parsed.errors;
  const handleClose = (): void => { if (!isPending()) onClose(); };
  const handleSave = async (): Promise<void> => {
    setHasSubmitted(true);
    if (!parsed.ok || !canWrite) return;
    await run(async () => { await onSave(parsed.fields); }, onClose);
  };

  return (
    <Modal transparent visible animationType="slide" onRequestClose={handleClose}>
      <View className="modal-overlay">
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View className="modal-container subscription-editor__sheet">
            <SafeAreaView
              edges={["bottom", "left", "right"]}
              style={{ flex: 1, backgroundColor: colors.background }}
            >
              <View className="modal-header">
                <Text className="modal-title" accessibilityRole="header">
                  Edit Subscription
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close editor without saving"
                  className="modal-close subscription-editor__close"
                  onPress={handleClose}
                  disabled={pending}
                >
                  <Text className="modal-close-text">×</Text>
                </Pressable>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: spacing[5], gap: spacing[5] }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
              >
                <Text className="auth-helper">
                  Changes update your tracked subscription only.
                </Text>
                <SubscriptionDataNotice />
                {fields.map((field) => (
                  <View className="auth-field" key={field.key}>
                    <Text className="auth-label">
                      {field.label}{field.key === "price" ? ` (${subscription.currency ?? "ZAR"})` : ""}
                    </Text>
                    <TextInput
                      className={clsx(
                        "auth-input",
                        hasSubmitted && errors[field.key] && "auth-input-error",
                      )}
                      accessibilityLabel={field.label}
                      value={draft[field.key]}
                      onChangeText={(value) => setDraft((current) => ({
                        ...current,
                        [field.key]: value,
                      }))}
                      placeholder={field.placeholder}
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType={field.keyboardType}
                      autoCapitalize={field.autoCapitalize ?? "none"}
                      autoCorrect={false}
                      editable={!pending}
                    />
                    {field.helper && <Text className="auth-helper">{field.helper}</Text>}
                    {hasSubmitted && errors[field.key] && (
                      <Text className="auth-error" accessibilityLiveRegion="polite">
                        {errors[field.key]}
                      </Text>
                    )}
                  </View>
                ))}

                <View className="auth-field">
                  <Text className="auth-label">Billing cycle</Text>
                  <View className="picker-row">
                    {(["Monthly", "Yearly"] as const).map((frequency) => (
                      <Pressable
                        key={frequency}
                        accessibilityRole="radio"
                        accessibilityLabel={`${frequency} billing`}
                        disabled={pending}
                        accessibilityState={{ checked: draft.frequency === frequency, disabled: pending }}
                        className={clsx(
                          "picker-option",
                          draft.frequency === frequency && "picker-option-active",
                        )}
                        onPress={() => setDraft((current) => ({ ...current, frequency }))}
                      >
                        <Text className={clsx(
                          "picker-option-text",
                          draft.frequency === frequency && "picker-option-text-active",
                        )}>
                          {frequency}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View className="auth-field">
                  <Text className="auth-label">Category (optional)</Text>
                  <View className="category-scroll">
                    {["", ...SUBSCRIPTION_CATEGORIES].map((category) => (
                      <Pressable
                        key={category}
                        accessibilityRole="radio"
                        accessibilityLabel={category || "No category"}
                        accessibilityState={{ checked: draft.category === category, disabled: pending }}
                        disabled={pending}
                        className={clsx("category-chip", draft.category === category && "category-chip-active")}
                        onPress={() => setDraft((current) => ({ ...current, category }))}
                      >
                        <Text className={clsx("category-chip-text", draft.category === category && "category-chip-text-active")}>
                          {category || "None"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {hasSubmitted && errors.category && <Text className="auth-error">{errors.category}</Text>}
                </View>
              </ScrollView>

              <View className="subscription-editor__footer">
                {hasSubmitted && Object.keys(errors).length > 0 && (
                  <Text className="auth-error" accessibilityLiveRegion="polite">
                    Please correct the highlighted fields above.
                  </Text>
                )}
                {error && <Text className="auth-error" accessibilityLiveRegion="polite">{error}</Text>}
                <Pressable
                  className={clsx("auth-button", (!canWrite || pending) && "auth-button-disabled")}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canWrite || pending, busy: pending }}
                  disabled={!canWrite || pending}
                  onPress={handleSave}
                >
                  <Text className="auth-button-text">{pending ? "Saving…" : "Save Changes"}</Text>
                </Pressable>
                <Pressable
                  className="subscription-editor__cancel"
                  accessibilityRole="button"
                  onPress={handleClose}
                  disabled={pending}
                >
                  <Text className="auth-label">Cancel</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
