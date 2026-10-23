import { colors, spacing } from "@/constants/theme";
import {
  createSubscriptionDraft,
  parseSubscriptionDraft,
  validateSubscriptionDraft,
} from "@/lib/subscription-edit";
import type { SubscriptionDraft, SubscriptionEdits } from "@/types/subscription";
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
  onSave: (edits: SubscriptionEdits) => void;
}

interface DraftField {
  key: Exclude<keyof SubscriptionDraft, "frequency">;
  label: string;
  placeholder: string;
  helper?: string;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
}

const fields: DraftField[] = [
  { key: "name", label: "Name", placeholder: "e.g. Netflix", autoCapitalize: "words" },
  { key: "plan", label: "Plan (optional)", placeholder: "e.g. Premium" },
  { key: "category", label: "Category (optional)", placeholder: "e.g. Entertainment" },
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
}: EditSubscriptionModalProps) {
  // The screen mounts a fresh editor for each edit session.
  const [draft, setDraft] = useState(() => createSubscriptionDraft(subscription));
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const errors = validateSubscriptionDraft(draft);

  const handleSave = (): void => {
    setHasSubmitted(true);
    const edits = parseSubscriptionDraft(draft, subscription);
    if (edits) onSave(edits);
  };

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
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
                  onPress={onClose}
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
                        accessibilityState={{ checked: draft.frequency === frequency }}
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
              </ScrollView>

              <View className="subscription-editor__footer">
                {hasSubmitted && Object.keys(errors).length > 0 && (
                  <Text className="auth-error" accessibilityLiveRegion="polite">
                    Please correct the highlighted fields above.
                  </Text>
                )}
                <Pressable className="auth-button" accessibilityRole="button" onPress={handleSave}>
                  <Text className="auth-button-text">Save Changes</Text>
                </Pressable>
                <Pressable
                  className="subscription-editor__cancel"
                  accessibilityRole="button"
                  onPress={onClose}
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
