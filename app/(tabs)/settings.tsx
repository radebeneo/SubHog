import { posthog } from "@/lib/posthog";
import { useAuth } from "@clerk/expo";
import { styled } from "nativewind";
import { Pressable, Text } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

const Settings = () => {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      posthog?.capture("user_signed_out", { source: "settings" });
      await posthog?.flush();
      posthog?.reset();
    } catch (error) {
      posthog?.captureException(error, { auth_flow: "sign_out" });
      throw error;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background p-5">
      <Text className="text-3xl font-sans-bold text-primary">Settings</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log out"
        className="mt-8 rounded-2xl bg-accent px-5 py-4"
        onPress={handleSignOut}
      >
        <Text className="text-center text-base font-sans-bold text-primary">
          Sign Out
        </Text>
      </Pressable>
    </SafeAreaView>
  );
};

export default Settings;
