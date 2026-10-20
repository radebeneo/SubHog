import { posthog } from "@/adapters/posthog";
import { getAuthErrorMessage } from "@/features/auth/auth-state";
import { AntDesign } from "@expo/vector-icons";
import { useSSO } from "@clerk/expo/experimental";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

WebBrowser.maybeCompleteAuthSession();

const providers = [
  { name: "Google", strategy: "oauth_google", icon: "google" },
  { name: "Apple", strategy: "oauth_apple", icon: "apple" },
] as const;

type Strategy = (typeof providers)[number]["strategy"];

export function SocialAuthButtons({ onSignUp = false }: { onSignUp?: boolean }) {
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const [pending, setPending] = useState<Strategy | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePress = async (strategy: Strategy) => {
    if (pending) return;
    setPending(strategy);
    setErrorMessage(null);

    try {
      const { authSessionResult, createdSessionId, signIn } =
        await startSSOFlow({
          strategy,
          redirectUrl:
            Platform.OS === "web"
              ? undefined
              : AuthSession.makeRedirectUri({
                  scheme: "subhog",
                  path: "sso-callback",
                }),
        });

      if (
        authSessionResult?.type === "success" &&
        !createdSessionId &&
        !signIn?.existingSession
      ) {
        if (
          signIn?.status === "needs_second_factor" ||
          signIn?.status === "needs_client_trust"
        ) {
          if (onSignUp) {
            router.replace("/(auth)/sign-in");
          }
        } else {
          setErrorMessage(
            "More information is required to finish signing in. Try another method or contact support.",
          );
        }
      }
    } catch (error) {
      posthog?.captureException(error, { auth_flow: "social_auth", strategy });
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setPending(null);
    }
  };

  return (
    <View>
      <View className="auth-divider-row">
        <View className="auth-divider-line" />
        <Text className="auth-divider-text">Or continue with</Text>
        <View className="auth-divider-line" />
      </View>
      <View className="flex-row items-center justify-center gap-8">
        {providers.map(({ name, strategy, icon }) => (
          <Pressable
            key={strategy}
            hitSlop={12}
            style={{ opacity: pending === strategy ? 0.5 : 1 }}
            accessibilityRole="button"
            accessibilityLabel={`Continue with ${name}`}
            disabled={pending !== null}
            onPress={() => void handlePress(strategy)}
          >
            <AntDesign name={icon} size={32} color="#000" />
          </Pressable>
        ))}
      </View>
      {errorMessage && <Text className="auth-error mt-3">{errorMessage}</Text>}
    </View>
  );
}
