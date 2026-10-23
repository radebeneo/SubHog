import SubscriptionDataNotice from "@/components/SubscriptionDataNotice";
import { useSubscriptionAction } from "@/hooks/useSubscriptionAction";
import { clsx } from "clsx";
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface DeleteSubscriptionModalProps {
  name: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  canWrite: boolean;
}

export default function DeleteSubscriptionModal({
  name,
  onClose,
  onConfirm,
  canWrite,
}: DeleteSubscriptionModalProps) {
  const { pending, error, isPending, run } = useSubscriptionAction();
  const handleClose = (): void => { if (!isPending()) onClose(); };
  const handleConfirm = async (): Promise<void> => {
    if (!canWrite) return;
    await run(async () => { await onConfirm(); }, onClose);
  };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={handleClose}>
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
            <SubscriptionDataNotice />
            {error && <Text className="auth-error" accessibilityLiveRegion="polite">{error}</Text>}
            <View className="subscription-actions__row">
              <Pressable
                className="subscription-actions__delete"
                accessibilityRole="button"
                disabled={pending}
                onPress={handleClose}
              >
                <Text className="auth-label">Keep Subscription</Text>
              </Pressable>
              <Pressable
                className={clsx("subscription-delete__confirm", (!canWrite || pending) && "opacity-50")}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canWrite || pending, busy: pending }}
                accessibilityLabel={`Confirm deletion of ${name}`}
                disabled={!canWrite || pending}
                onPress={handleConfirm}
              >
                <Text className="sub-cancel-text">
                  {pending ? "Deleting…" : "Delete"}
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
