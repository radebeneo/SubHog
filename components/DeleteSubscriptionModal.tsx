import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface DeleteSubscriptionModalProps {
  name: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteSubscriptionModal({
  name,
  onClose,
  onConfirm,
}: DeleteSubscriptionModalProps) {
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View className="subscription-delete__overlay">
        <SafeAreaView style={{ width: "100%" }} edges={["left", "right"]}>
          <View className="subscription-delete__dialog" accessibilityViewIsModal>
            <Text className="modal-title" accessibilityRole="header">
              Delete subscription?
            </Text>
            <Text className="auth-helper">
              Remove {name} from SubHog? This cannot be undone. This does not
              cancel your subscription or stop payments with the provider.
            </Text>
            <View className="subscription-actions__row">
              <Pressable
                className="subscription-actions__delete"
                accessibilityRole="button"
                onPress={onClose}
              >
                <Text className="auth-label">Keep Subscription</Text>
              </Pressable>
              <Pressable
                className="subscription-delete__confirm"
                accessibilityRole="button"
                accessibilityLabel={`Confirm deletion of ${name}`}
                onPress={onConfirm}
              >
                <Text className="sub-cancel-text">
                  Delete
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
