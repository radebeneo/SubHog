import { getSessionTaskCopy } from "@/features/auth/auth-state";
import { useAuth, useSession } from "@clerk/expo";
import { Redirect, useRouter, type Href } from "expo-router";
import { styled } from "nativewind";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

export default function SessionTask() {
  const { isLoaded, session } = useSession();
  const { signOut } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isLoaded) return null;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!session.currentTask) return <Redirect href="/(app)/(tabs)" />;

  const copy = getSessionTaskCopy(session.currentTask.key);

  const checkAgain = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const updatedSession = await session.touch();
      if (!updatedSession.currentTask) {
        router.replace("/(app)/(tabs)" as Href);
        return;
      }
      setMessage(
        "This account action is still required. Complete it in your Clerk account, then check again.",
      );
    } catch {
      setMessage(
        "We could not refresh your account state. Check your connection and try again.",
      );
    } finally {
      setChecking(false);
    }
  };

  const restart = async () => {
    setChecking(true);
    setMessage(null);
    try {
      await signOut();
      router.replace("/(auth)/sign-in" as Href);
    } catch {
      setMessage("We could not sign you out. Check your connection and try again.");
      setChecking(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background p-6">
      <View className="flex-1 justify-center">
        <View className="rounded-3xl bg-white p-6">
          <Text className="text-3xl font-sans-bold text-primary">
            {copy.title}
          </Text>
          <Text className="mt-3 text-base font-sans-medium text-muted-foreground">
            {copy.description}
          </Text>
          <Text className="mt-3 text-sm font-sans-medium text-muted-foreground">
            SubHog will keep your account protected until Clerk confirms this
            step is complete.
          </Text>
          {message && (
            <Text className="mt-4 text-sm font-sans-medium text-destructive">
              {message}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            className="mt-6 rounded-2xl bg-accent px-5 py-4"
            disabled={checking}
            onPress={checkAgain}
          >
            <Text className="text-center text-base font-sans-bold text-primary">
              {checking ? "Checking..." : "Check Again"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            className="mt-3 rounded-2xl border border-accent px-5 py-4"
            disabled={checking}
            onPress={restart}
          >
            <Text className="text-center text-base font-sans-bold text-primary">
              Sign Out and Restart
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
