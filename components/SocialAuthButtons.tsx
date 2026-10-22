import { posthog, sanitizePostHogProperties } from "@/lib/posthog";
import { useSSO } from "@clerk/expo/experimental";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

// Completes the OAuth popup when it returns to an auth screen on web.
WebBrowser.maybeCompleteAuthSession();

type SocialProvider = "google" | "apple";

type SocialAuthButtonsProps = {
  mode: "sign_in" | "sign_up";
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
};

export default function SocialAuthButtons({
  mode,
  disabled = false,
  onBusyChange,
}: SocialAuthButtonsProps) {
  const { startSSOFlow } = useSSO();
  const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");
  const inProgress = useRef(false);
  const busy = pendingProvider !== null;
  const buttonsDisabled = disabled || busy;

  const handleSocialLogin = async (provider: SocialProvider) => {
    if (disabled || inProgress.current) return;

    inProgress.current = true;
    setPendingProvider(provider);
    setErrorMessage("");
    onBusyChange(true);

    try {
      const result = await startSSOFlow({
        strategy: provider === "google" ? "oauth_google" : "oauth_apple",
        redirectUrl: makeRedirectUri({ scheme: "subhog", path: "sign-in" }),
      });

      // Closing or cancelling the provider window is not an error.
      if (
        result.authSessionResult?.type === "cancel" ||
        result.authSessionResult?.type === "dismiss"
      ) {
        return;
      }

      if (result.createdSessionId || result.signIn?.existingSession) {
        posthog?.capture(
          result.signUp?.status === "complete"
            ? "user_signed_up"
            : "user_signed_in",
          sanitizePostHogProperties({ auth_method: provider }),
        );
        // Clerk activates the session; the auth layout redirects to the tabs.
        return;
      }

      setErrorMessage(
        "Social login wasn't completed. Please try again or use email and password.",
      );
    } catch (error) {
      posthog?.captureException(error, {
        auth_flow: mode,
        auth_method: provider,
      });
      setErrorMessage(
        `Unable to continue with ${provider === "google" ? "Google" : "Apple"}. Please try again or use email and password.`,
      );
    } finally {
      inProgress.current = false;
      setPendingProvider(null);
      onBusyChange(false);
    }
  };

  return (
    <View className="auth-social">
      <View className="auth-divider-row">
        <View className="auth-divider-line" />
        <Text className="auth-divider-text">or continue with</Text>
        <View className="auth-divider-line" />
      </View>

      <View className="auth-social__buttons">
        <Pressable
          className={`auth-social__button ${buttonsDisabled ? "auth-social__button--disabled" : ""}`}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          accessibilityState={{
            disabled: buttonsDisabled,
            busy: pendingProvider === "google",
          }}
          disabled={buttonsDisabled}
          onPress={() => void handleSocialLogin("google")}
        >
          {pendingProvider === "google" ? (
            <ActivityIndicator color="#081126" />
          ) : (
            <Svg width={28} height={28} viewBox="0 0 24 24" accessible={false}>
              <Path
                fill="#4285F4"
                d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z"
              />
              <Path
                fill="#34A853"
                d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
              />
              <Path
                fill="#FBBC05"
                d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z"
              />
              <Path
                fill="#EA4335"
                d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"
              />
            </Svg>
          )}
        </Pressable>

        <Pressable
          className={`auth-social__button ${buttonsDisabled ? "auth-social__button--disabled" : ""}`}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
          accessibilityState={{
            disabled: buttonsDisabled,
            busy: pendingProvider === "apple",
          }}
          disabled={buttonsDisabled}
          onPress={() => void handleSocialLogin("apple")}
        >
          {pendingProvider === "apple" ? (
            <ActivityIndicator color="#081126" />
          ) : (
            <FontAwesome
              name="apple"
              size={28}
              color="#081126"
              accessible={false}
            />
          )}
        </Pressable>
      </View>

      {!!errorMessage && (
        <Text className="auth-social__error" accessibilityRole="alert">
          {errorMessage}
        </Text>
      )}
    </View>
  );
}
