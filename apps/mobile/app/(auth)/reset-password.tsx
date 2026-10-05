import { posthog } from "@/adapters/posthog";
import images from "@/config/images";
import { getAuthErrorMessage } from "@/features/auth/auth-state";
import { useSignIn } from "@clerk/expo";
import { Link, useRouter, type Href } from "expo-router";
import { styled } from "nativewind";
import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

type RecoveryStep = "email" | "code" | "password";

export default function ResetPassword() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const [step, setStep] = useState<RecoveryStep>("email");
  const [emailAddress, setEmailAddress] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const isFetching = fetchStatus === "fetching";
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.trim());
  const passwordValid =
    password.length >= 8 && password === confirmPassword;

  const reportError = (error: unknown, fallback?: string) => {
    setMessage(getAuthErrorMessage(error, fallback));
    if (error) {
      posthog?.captureException(error, { auth_flow: "password_recovery" });
    }
  };

  const sendCode = async () => {
    if (!emailValid) return;
    setMessage(null);

    try {
      const resetResult = await signIn.reset();
      if (resetResult.error) {
        reportError(resetResult.error);
        return;
      }

      const createResult = await signIn.create({
        identifier: emailAddress.trim(),
      });
      if (createResult.error) {
        reportError(createResult.error);
        return;
      }

      const result = await signIn.resetPasswordEmailCode.sendCode();
      if (result.error) {
        reportError(result.error);
        return;
      }

      setCode("");
      setStep("code");
      setMessage(`We sent a recovery code to ${emailAddress.trim()}.`);
    } catch (error) {
      reportError(error);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) return;
    setMessage(null);

    try {
      const result = await signIn.resetPasswordEmailCode.verifyCode({
        code: code.trim(),
      });
      if (result.error) {
        reportError(result.error);
        return;
      }

      if (signIn.status !== "needs_new_password") {
        reportError(null, "The code could not be verified. Request a new code.");
        return;
      }

      setStep("password");
    } catch (error) {
      reportError(error);
    }
  };

  const submitPassword = async () => {
    if (!passwordValid) return;
    setMessage(null);

    try {
      const result = await signIn.resetPasswordEmailCode.submitPassword({
        password,
        signOutOfOtherSessions: true,
      });
      if (result.error) {
        reportError(result.error);
        return;
      }

      if (signIn.status !== "complete") {
        reportError(
          null,
          "Your password was updated, but sign-in still needs attention.",
        );
        return;
      }

      const finalizeResult = await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          const destination = session?.currentTask
            ? "/(auth)/session-task"
            : "/(app)/(tabs)";
          const url = decorateUrl(destination);
          if (
            url.startsWith("http") &&
            typeof window !== "undefined" &&
            window.location
          ) {
            window.location.href = url;
            return;
          }
          router.replace(destination as Href);
        },
      });
      if (finalizeResult.error) {
        reportError(finalizeResult.error);
      }
    } catch (error) {
      reportError(error);
    }
  };

  const restart = async () => {
    try {
      const result = await signIn.reset();
      if (result.error) {
        reportError(result.error);
        return;
      }
      setCode("");
      setPassword("");
      setConfirmPassword("");
      setMessage(null);
      setStep("email");
    } catch (error) {
      reportError(error);
    }
  };

  const title =
    step === "email"
      ? "Reset your password"
      : step === "code"
        ? "Check your email"
        : "Choose a new password";
  const subtitle =
    step === "email"
      ? "Enter your account email to receive a recovery code"
      : step === "code"
        ? "Enter the code Clerk sent to your email"
        : "Your new password will sign out your other sessions";
  const disabled =
    isFetching ||
    (step === "email" && !emailValid) ||
    (step === "code" && !code.trim()) ||
    (step === "password" && !passwordValid);
  const buttonLabel =
    step === "email"
      ? "Send Recovery Code"
      : step === "code"
        ? "Verify Code"
        : "Update Password";
  const fieldError =
    errors.fields.identifier?.message ??
    errors.fields.code?.message ??
    errors.fields.password?.message;

  const handleContinue =
    step === "email"
      ? sendCode
      : step === "code"
        ? verifyCode
        : submitPassword;

  return (
    <SafeAreaView className="auth-safe-area">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="auth-screen"
      >
        <ScrollView
          className="auth-scroll"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="auth-content">
            <View className="auth-brand-block">
              <View className="auth-logo-wrap">
                <Image className="home-avatar" source={images.favicon} />
                <View>
                  <Text className="auth-wordmark">SubHog</Text>
                  <Text className="auth-wordmark-sub">SUBSCRIPTIONS</Text>
                </View>
              </View>
              <Text className="auth-title">{title}</Text>
              <Text className="auth-subtitle">{subtitle}</Text>
            </View>

            <View className="auth-card">
              <View className="auth-form">
                {step === "email" ? (
                  <View className="auth-field">
                    <Text className="auth-label">Email Address</Text>
                    <TextInput
                      className="auth-input"
                      value={emailAddress}
                      onChangeText={setEmailAddress}
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      placeholder="name@example.com"
                      placeholderTextColor="rgba(0, 0, 0, 0.4)"
                    />
                  </View>
                ) : null}

                {step === "code" ? (
                  <View className="auth-field">
                    <Text className="auth-label">Recovery Code</Text>
                    <TextInput
                      className="auth-input"
                      value={code}
                      onChangeText={setCode}
                      autoComplete="one-time-code"
                      keyboardType="number-pad"
                      placeholder="Enter recovery code"
                      placeholderTextColor="rgba(0, 0, 0, 0.4)"
                    />
                  </View>
                ) : null}

                {step === "password" ? (
                  <View>
                    <View className="auth-field">
                      <Text className="auth-label">New Password</Text>
                      <TextInput
                        className="auth-input"
                        value={password}
                        onChangeText={setPassword}
                        autoComplete="password-new"
                        secureTextEntry
                        placeholder="Minimum 8 characters"
                        placeholderTextColor="rgba(0, 0, 0, 0.4)"
                      />
                    </View>
                    <View className="auth-field">
                      <Text className="auth-label">Confirm Password</Text>
                      <TextInput
                        className="auth-input"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        autoComplete="password-new"
                        secureTextEntry
                        placeholder="Repeat your new password"
                        placeholderTextColor="rgba(0, 0, 0, 0.4)"
                      />
                      {confirmPassword.length > 0 &&
                      password !== confirmPassword ? (
                        <Text className="auth-error">
                          Passwords do not match
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ) : null}

                {message || fieldError ? (
                  <Text className="auth-error">{message ?? fieldError}</Text>
                ) : null}

                <Pressable
                  className={`auth-button ${
                    disabled ? "auth-button-disabled" : ""
                  }`}
                  disabled={disabled}
                  onPress={handleContinue}
                >
                  <Text className="auth-button-text">
                    {isFetching ? "Please wait..." : buttonLabel}
                  </Text>
                </Pressable>

                {step !== "email" ? (
                  <Pressable
                    className="auth-secondary-button"
                    disabled={isFetching}
                    onPress={restart}
                  >
                    <Text className="auth-secondary-button-text">
                      Start Over
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View className="auth-link-row">
              <Text className="auth-link-copy">
                Remembered your password?
              </Text>
              <Link href="/(auth)/sign-in" asChild>
                <Pressable>
                  <Text className="auth-link">Sign In</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
