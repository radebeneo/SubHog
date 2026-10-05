import { posthog, sanitizePostHogProperties } from "@/adapters/posthog";
import { resolveApiBaseUrl } from "@/config/api-config";
import {
  ACCOUNT_DELETE_RETRY_MESSAGE,
  deleteAccount,
} from "@/features/account/account-deletion";
import { createApiClient } from "@subhog/api-client";
import { useAuth, useSessionList, useUser } from "@clerk/expo";
import { styled } from "nativewind";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

const Settings = () => {
  const { getToken, signOut, sessionId } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();
  const sessionList = useSessionList();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const accountApi = useMemo(() => {
    try {
      return createApiClient({
        baseUrl: resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL),
        getToken: (options) => getToken(options),
      });
    } catch {
      return null;
    }
  }, [getToken]);
  const otherSessions = sessionList.isLoaded && sessionId
    ? sessionList.sessions.filter((session) => session.id !== sessionId)
    : [];

  const handleSignOut = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await signOut();
      posthog?.capture(
        "user_signed_out",
        sanitizePostHogProperties({ source: "settings" }),
      );
      await posthog?.flush().catch(() => undefined);
      posthog?.reset();
    } catch (error) {
      posthog?.captureException(error, { auth_flow: "sign_out" });
      setMessage("We could not sign you out. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const removeOtherSessions = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await Promise.all(otherSessions.map((session) => session.remove()));
      setMessage("Other sessions registered on this device were signed out.");
    } catch (error) {
      posthog?.captureException(error, {
        auth_flow: "remove_other_sessions",
      });
      setMessage("Some sessions could not be removed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!accountApi || !isUserLoaded || !user) {
      setMessage("Account deletion is unavailable right now. Please try again.");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await deleteAccount({
        api: accountApi,
        deleteProviderUser: () => user.delete(),
      });
      posthog?.reset();
    } catch (error) {
      posthog?.captureException(error, { auth_flow: "delete_account" });
      setMessage(
        error instanceof Error && error.message === ACCOUNT_DELETE_RETRY_MESSAGE
          ? ACCOUNT_DELETE_RETRY_MESSAGE
          : "We could not finish deleting your account. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Delete SubHog account?",
      "This permanently removes your SubHog account and subscription tracking data. It does not cancel subscriptions with merchants.",
      [
        { text: "Keep Account", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            void handleDeleteAccount();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 p-5">
        <Text className="text-3xl font-sans-bold text-primary">Settings</Text>
        <View className="mt-8 rounded-3xl bg-white p-5">
          <Text className="text-xl font-sans-bold text-primary">
            Account Security
          </Text>
          <Text className="mt-2 text-sm font-sans-medium text-muted-foreground">
            {sessionList.isLoaded
              ? `${otherSessions.length} other session${otherSessions.length === 1 ? "" : "s"} registered on this device`
              : "Checking sessions..."}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out other sessions"
            className={`mt-5 rounded-2xl border border-accent px-5 py-4 ${
              (busy || otherSessions.length === 0) && "opacity-50"
            }`}
            disabled={busy || !sessionList.isLoaded || otherSessions.length === 0}
            onPress={removeOtherSessions}
          >
            <Text className="text-center text-base font-sans-bold text-primary">
              Sign Out Other Sessions
            </Text>
          </Pressable>
        </View>
        {message && (
          <Text className="mt-4 text-sm font-sans-medium text-primary">
            {message}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log out"
          className={`mt-5 rounded-2xl bg-accent px-5 py-4 ${
            busy && "opacity-50"
          }`}
          disabled={busy}
          onPress={handleSignOut}
        >
          <Text className="text-center text-base font-sans-bold text-primary">
            Sign Out
          </Text>
        </Pressable>
        <View className="mb-8 mt-8 rounded-3xl border border-red-200 bg-white p-5">
          <Text className="text-xl font-sans-bold text-red-700">
            Delete Account
          </Text>
          <Text className="mt-2 text-sm font-sans-medium text-muted-foreground">
            Permanently removes your SubHog account and tracking data. This
            does not cancel subscriptions with merchants.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            className={`mt-5 rounded-2xl bg-red-600 px-5 py-4 ${
              busy && "opacity-50"
            }`}
            disabled={busy}
            onPress={confirmDeleteAccount}
          >
            <Text className="text-center text-base font-sans-bold text-white">
              Delete Account
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Settings;
