import "@/global.css";
import { useAuth, useSession } from "@clerk/expo";
import { Redirect, Stack, usePathname } from "expo-router";

export default function RootLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { isLoaded: isSessionLoaded, session } = useSession();
  const pathname = usePathname();

  // Wait for auth to load before rendering anything
  if (!isLoaded || !isSessionLoaded) {
    return null;
  }

  if (session?.currentTask && pathname !== "/session-task") {
    return <Redirect href="/(auth)/session-task" />;
  }

  // Redirect to home if user is already signed in.
  if (isSignedIn && !session?.currentTask) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
