import "@/global.css";
import { posthog } from "@/lib/posthog";
import { ClerkProvider, useAuth, useUser } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { useFonts } from "expo-font";
import { SplashScreen, Stack, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { PostHogProvider } from "posthog-react-native";

SplashScreen.preventAutoHideAsync();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey || publishableKey === "pk_live_REPLACE_ME") {
  throw new Error(
    "Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in the local environment or CI/EAS build environment",
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey!} tokenCache={tokenCache}>
      <RootLayoutContent />
    </ClerkProvider>
  );
}

function RootLayoutContent() {
  const [fontsLoaded] = useFonts({
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

  useEffect(() => {
    if (fontsLoaded && isLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoaded]);

  useEffect(() => {
    if (!posthog || previousPathname.current === pathname) return;

    posthog.screen(pathname, {
      previous_screen: previousPathname.current,
    });
    previousPathname.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!posthog || !isUserLoaded) return;

    if (isSignedIn && user) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
      });
    } else {
      posthog.reset();
    }
  }, [isSignedIn, isUserLoaded, user]);

  if (!fontsLoaded || !isLoaded) return null;

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
