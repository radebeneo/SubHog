import "@/global.css";
import { posthog, sanitizePostHogProperties } from "@/lib/posthog";
import { ClerkProvider, useAuth, useUser } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { useFonts } from "expo-font";
import { SplashScreen, Stack, usePathname } from "expo-router";
import { styled } from "nativewind";
import { PostHogProvider } from "posthog-react-native";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Text } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

function getClerkPublishableKey(): string {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey || publishableKey === "pk_live_REPLACE_ME") {
    throw new Error(
      "Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in the local environment or CI/EAS build environment",
    );
  }

  return publishableKey;
}

const clerkPublishableKey = getClerkPublishableKey();

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <RootLayoutContent />
    </ClerkProvider>
  );
}

function RootLayoutContent() {
  const [fontsLoaded, fontError] = useFonts({
    "PlusJakartaSans-Regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "PlusJakartaSans-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    "PlusJakartaSans-SemiBold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    "PlusJakartaSans-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
    "PlusJakartaSans-Light": require("../assets/fonts/PlusJakartaSans-Light.ttf"),
  });
  const { isLoaded } = useAuth();
  const { isLoaded: isUserLoaded, isSignedIn, user } = useUser();
  const pathname = usePathname();
  const previousPathname = useRef<string | null>(null);

  useScreenTracking();

  useEffect(() => {
    void SplashScreen.preventAutoHideAsync().catch((error) => {
      console.warn(
        "Splash screen auto-hide guard failed:",
        error instanceof Error ? error.message : String(error),
      );
    });
  }, []);

  useEffect(() => {
    if (!fontsLoaded || !isLoaded) {
      return;
    }

    void SplashScreen.hideAsync().catch((error) => {
      console.warn(
        "Splash screen could not be dismissed:",
        error instanceof Error ? error.message : String(error),
      );
    });
  }, [fontsLoaded, isLoaded]);

  useEffect(() => {
    if (!posthog || previousPathname.current === pathname) return;

    const properties = sanitizePostHogProperties({
      previous_screen: previousPathname.current ?? undefined,
    });

    void posthog.screen(
      pathname,
      Object.keys(properties).length > 0 ? properties : undefined,
    );
    previousPathname.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!posthog || !isUserLoaded) return;

    if (isSignedIn && user) {
      const profileProperties = sanitizePostHogProperties({
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
      });

      posthog.identify(user.id, profileProperties);
    } else {
      posthog.reset();
    }
  }, [isSignedIn, isUserLoaded, user]);

  if (fontError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-2xl font-sans-bold text-primary">
          Unable to load SubHog
        </Text>
        <Text className="mt-3 text-center text-base font-sans-medium text-muted-foreground">
          The required app fonts could not be loaded. Please restart the app and
          try again.
        </Text>
      </SafeAreaView>
    );
  }

  if (!fontsLoaded || !isLoaded) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#ea7a53" />
        <Text className="mt-4 text-base font-sans-medium text-primary">
          Starting SubHog...
        </Text>
      </SafeAreaView>
    );
  }

  const navigation = <Stack screenOptions={{ headerShown: false }} />;

  if (!posthog) return navigation;

  return (
    <PostHogProvider
      client={posthog}
      autocapture={{ captureScreens: false, captureTouches: true }}
    >
      {navigation}
    </PostHogProvider>
  );
}

// Expo Router runs on React Navigation v7, which PostHog autocapture cannot track,
// so send a $screen event on each route change.
function useScreenTracking() {
  const posthog = usePostHog();
  const pathname = usePathname();
  const previousPathname = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      posthog.screen(pathname, {
        previous_screen: previousPathname.current ?? null,
      });
      previousPathname.current = pathname;
    }
  }, [posthog, pathname]);
}
