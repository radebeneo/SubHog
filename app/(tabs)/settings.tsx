import { useAuth, useUser } from "@clerk/expo";
import { AuthButton } from "@/components/AuthUI";
import { styled } from "nativewind";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

export default function Settings() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const email = user?.primaryEmailAddress?.emailAddress ?? "Signed-in account";

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <SafeAreaView className="settings-safe-area">
      <Text className="settings-title">Settings</Text>
      <Text className="settings-subtitle">
        Manage your SubHog account and preferences.
      </Text>
      <View className="settings-account-card">
        <View className="settings-avatar">
          <Text className="settings-avatar-text">
            {email.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View className="settings-account-copy">
          <Text className="settings-account-label">Your account</Text>
          <Text className="settings-account-email" numberOfLines={1}>
            {email}
          </Text>
        </View>
      </View>
      <View className="settings-sign-out">
        <AuthButton
          label="Sign out"
          loading={isSigningOut}
          secondary
          onPress={handleSignOut}
        />
      </View>
    </SafeAreaView>
  );
}
