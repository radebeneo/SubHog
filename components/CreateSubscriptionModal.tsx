import { findSubscriptionIcon } from "@/lib/subscription-icons";
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

const categories = [
  "Entertainment",
  "Gaming",
  "AI Tools",
  "Developer Tools",
  "Design",
  "Productivity",
  "Cloud",
  "Music",
  "Other",
] as const;

const categoryColors: Record<(typeof categories)[number], string> = {
  Entertainment: "#f5c542",
  Gaming: "#f2cc8f",
  "AI Tools": "#b8d4e3",
  "Developer Tools": "#e8def8",
  Design: "#b8e8d0",
  Productivity: "#f4c7ab",
  Cloud: "#c7d9f5",
  Music: "#f0c4d8",
  Other: "#d8d4c8",
};

type Frequency = "Monthly" | "Yearly";

interface CreateSubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (subscription: Subscription) => void;
}

const CreateSubscriptionModal = ({
  visible,
  onClose,
  onCreate,
}: CreateSubscriptionModalProps) => {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("Monthly");
  const [category, setCategory] =
    useState<(typeof categories)[number]>("Other");
  const [isResolvingIcon, setIsResolvingIcon] = useState(false);

  const numericPrice = Number(price);
  const isValid =
    name.trim().length > 0 && Number.isFinite(numericPrice) && numericPrice > 0;

  const resetForm = () => {
    setName("");
    setPrice("");
    setFrequency("Monthly");
    setCategory("Other");
    setIsResolvingIcon(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!isValid) return;

    setIsResolvingIcon(true);
    try {
      const startDate = dayjs();
      const subscription: Subscription = {
        id: `subscription-${startDate.valueOf()}`,
        name: name.trim(),
        price: numericPrice,
        currency: "ZAR",
        frequency,
        billing: frequency,
        category,
        status: "active",
        startDate: startDate.toISOString(),
        renewalDate: startDate
          .add(1, frequency === "Monthly" ? "month" : "year")
          .toISOString(),
        icon: await findSubscriptionIcon(name),
        color: categoryColors[category],
      };

      onCreate(subscription);
      resetForm();
      onClose();
    } finally {
      setIsResolvingIcon(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        className="modal-overlay"
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
            <View className="auth-field">
              <Text className="auth-label">Name</Text>
              <TextInput
                className="auth-input"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Netflix"
                placeholderTextColor="rgba(0, 0, 0, 0.4)"
                autoCapitalize="words"
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
              />
            </View>

            <View className="auth-field">
              <Text className="auth-label">Frequency</Text>
              <View className="picker-row">
                {(["Monthly", "Yearly"] as Frequency[]).map((option) => (
                  <Pressable
                    key={option}
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

            <Pressable
              className={clsx(
                "auth-button",
                (!isValid || isResolvingIcon) && "auth-button-disabled",
              )}
              onPress={handleSubmit}
              disabled={!isValid || isResolvingIcon}
            >
              <Text className="auth-button-text">
                {isResolvingIcon ? "Finding icon..." : "Create Subscription"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default CreateSubscriptionModal;
