import images from "@/config/images";
import { posthog, sanitizePostHogProperties } from "@/adapters/posthog";
import {
  getAuthErrorMessage,
  getMfaStrategyLabel,
  getSupportedMfaStrategies,
  type SupportedMfaStrategy,
} from "@/features/auth/auth-state";
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

const SignIn = () => {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaStrategy, setMfaStrategy] =
    useState<SupportedMfaStrategy | null>(null);
  const [flowMessage, setFlowMessage] = useState<string | null>(null);

  // Validation states
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Client-side validation
  const emailValid =
    emailAddress.length === 0 ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress);
  const passwordValid = password.length > 0;
  const formValid =
    emailAddress.length > 0 && password.length > 0 && emailValid;

  const finalizeSignIn = async (requiredVerification: boolean) => {
    posthog?.capture(
      "user_signed_in",
      sanitizePostHogProperties({
        auth_method: "password",
        required_verification: requiredVerification,
      }),
    );
    const result = await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        const destination = session?.currentTask
          ? "/(auth)/session-task"
          : "/(app)/(tabs)";
        const url = decorateUrl(destination);
        if (url.startsWith("http")) {
          if (typeof window !== "undefined" && window.location) {
            window.location.href = url;
          } else {
            router.replace(destination as Href);
          }
        } else {
          router.replace(url as Href);
        }
      },
    });
    if (result.error) {
      setFlowMessage(getAuthErrorMessage(result.error));
    }
  };

  const prepareMfa = async (strategy: SupportedMfaStrategy) => {
    setFlowMessage(null);
    setCode("");
    setMfaStrategy(strategy);

    try {
      const result =
        strategy === "email_code"
          ? await signIn.mfa.sendEmailCode()
          : strategy === "phone_code"
            ? await signIn.mfa.sendPhoneCode()
            : null;
      if (result?.error) {
        setFlowMessage(getAuthErrorMessage(result.error));
      }
    } catch (error) {
      posthog?.captureException(error, { auth_flow: "mfa_prepare" });
      setFlowMessage(getAuthErrorMessage(error));
    }
  };

  const handleSubmit = async () => {
    if (!formValid) return;
    setFlowMessage(null);

    try {
      const { error } = await signIn.password({
        emailAddress,
        password,
      });

      if (error) {
        posthog?.captureException(error, { auth_flow: "sign_in" });
        setFlowMessage(getAuthErrorMessage(error));
        return;
      }

      if (signIn.status === "complete") {
        await finalizeSignIn(false);
      } else if (
        signIn.status === "needs_second_factor" ||
        signIn.status === "needs_client_trust"
      ) {
        const supported = getSupportedMfaStrategies(
          signIn.supportedSecondFactors,
        );
        if (supported.length > 0) {
          await prepareMfa(supported[0]);
        } else {
          setFlowMessage(
            "This account requires a verification method that this version of SubHog cannot complete. Use another Clerk-enabled client or start over.",
          );
        }
      } else {
        setFlowMessage(
          "Sign-in needs an additional step that is not available in this screen. Start over or reset your password.",
        );
      }
    } catch (error) {
      posthog?.captureException(error, { auth_flow: "sign_in" });
      setFlowMessage(getAuthErrorMessage(error));
    }
  };

  const handleVerify = async () => {
    if (!mfaStrategy) return;

    setFlowMessage(null);
    try {
      const result =
        mfaStrategy === "email_code"
          ? await signIn.mfa.verifyEmailCode({ code: code.trim() })
          : mfaStrategy === "phone_code"
            ? await signIn.mfa.verifyPhoneCode({ code: code.trim() })
            : mfaStrategy === "totp"
              ? await signIn.mfa.verifyTOTP({ code: code.trim() })
              : await signIn.mfa.verifyBackupCode({ code: code.trim() });

      if (result.error) {
        setFlowMessage(getAuthErrorMessage(result.error));
        return;
      }

      if (signIn.status === "complete") {
        await finalizeSignIn(true);
      } else {
        setFlowMessage(
          "Verification is not complete. Try another available method or start over.",
        );
      }
    } catch (error) {
      posthog?.captureException(error, { auth_flow: "mfa_verify" });
      setFlowMessage(getAuthErrorMessage(error));
    }
  };

  // Show verification screen for MFA and device trust challenges.
  if (
    signIn.status === "needs_client_trust" ||
    signIn.status === "needs_second_factor"
  ) {
    const supportedStrategies = getSupportedMfaStrategies(
      signIn.supportedSecondFactors,
    );
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
              {/* Branding */}
              <View className="auth-brand-block">
                <View className="auth-logo-wrap">
                  <View>
                    <Image className="home-avatar" source={images.favicon} />
                  </View>
                  <View>
                    <Text className="auth-wordmark">SubHog</Text>
                    <Text className="auth-wordmark-sub">SUBSCRIPTIONS</Text>
                  </View>
                </View>
                <Text className="auth-title">Verify your identity</Text>
                <Text className="auth-subtitle">
                  {mfaStrategy
                    ? `Use ${getMfaStrategyLabel(mfaStrategy).toLowerCase()} to continue`
                    : "Choose an available verification method to continue"}
                </Text>
              </View>

              {/* Verification Form */}
              <View className="auth-card">
                <View className="auth-form">
                  <View className="auth-field">
                    <Text className="auth-label">
                      {mfaStrategy === "backup_code"
                        ? "Backup Code"
                        : "Verification Code"}
                    </Text>
                    <TextInput
                      className="auth-input"
                      value={code}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor="rgba(0, 0, 0, 0.4)"
                      onChangeText={setCode}
                      keyboardType={
                        mfaStrategy === "backup_code" ? "default" : "number-pad"
                      }
                      autoComplete="one-time-code"
                      maxLength={mfaStrategy === "backup_code" ? undefined : 6}
                    />
                    {errors.fields.code && (
                      <Text className="auth-error">
                        {errors.fields.code.message}
                      </Text>
                    )}
                  </View>

                  {flowMessage && (
                    <Text className="auth-error">{flowMessage}</Text>
                  )}
                  {!flowMessage && supportedStrategies.length === 0 && (
                    <Text className="auth-error">
                      No supported verification method is available in this
                      version of SubHog. Start over or use another Clerk-enabled
                      client.
                    </Text>
                  )}

                  <Pressable
                    className={`auth-button ${(!code || !mfaStrategy || fetchStatus === "fetching") && "auth-button-disabled"}`}
                    onPress={handleVerify}
                    disabled={
                      !code || !mfaStrategy || fetchStatus === "fetching"
                    }
                  >
                    <Text className="auth-button-text">
                      {fetchStatus === "fetching" ? "Verifying..." : "Verify"}
                    </Text>
                  </Pressable>

                  {supportedStrategies.map((strategy) => (
                    <Pressable
                      key={strategy}
                      className="auth-secondary-button"
                      onPress={() => prepareMfa(strategy)}
                      disabled={fetchStatus === "fetching"}
                    >
                      <Text className="auth-secondary-button-text">
                        {strategy === mfaStrategy &&
                        (strategy === "email_code" ||
                          strategy === "phone_code")
                          ? "Resend "
                          : "Use "}
                        {getMfaStrategyLabel(strategy)}
                      </Text>
                    </Pressable>
                  ))}

                  <Pressable
                    className="auth-secondary-button"
                    onPress={() => {
                      setMfaStrategy(null);
                      setFlowMessage(null);
                      void signIn.reset();
                    }}
                    disabled={fetchStatus === "fetching"}
                  >
                    <Text className="auth-secondary-button-text">
                      Start Over
                    </Text>
                  </Pressable>
                  <Link href="/(auth)/reset-password" asChild>
                    <Pressable className="auth-secondary-button">
                      <Text className="auth-secondary-button-text">
                        Reset Password
                      </Text>
                    </Pressable>
                  </Link>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Main sign-in form
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
            {/* Branding */}
            <View className="auth-brand-block">
              <View className="auth-logo-wrap">
                <View>
                  <Image className="home-avatar" source={images.favicon} />
                </View>
                <View>
                  <Text className="auth-wordmark">SubHog</Text>
                  <Text className="auth-wordmark-sub">SUBSCRIPTIONS</Text>
                </View>
              </View>
              <Text className="auth-title">Welcome back</Text>
              <Text className="auth-subtitle">
                Sign in to continue managing your subscriptions
              </Text>
            </View>

            {/* Sign-In Form */}
            <View className="auth-card">
              <View className="auth-form">
                <View className="auth-field">
                  <Text className="auth-label">Email Address</Text>
                  <TextInput
                    className={`auth-input ${emailTouched && !emailValid && "auth-input-error"}`}
                    autoCapitalize="none"
                    value={emailAddress}
                    placeholder="name@example.com"
                    placeholderTextColor="rgba(0, 0, 0, 0.4)"
                    onChangeText={setEmailAddress}
                    onBlur={() => setEmailTouched(true)}
                    keyboardType="email-address"
                    autoComplete="email"
                  />
                  {emailTouched && !emailValid && (
                    <Text className="auth-error">
                      Please enter a valid email address
                    </Text>
                  )}
                  {errors.fields.identifier && (
                    <Text className="auth-error">
                      {errors.fields.identifier.message}
                    </Text>
                  )}
                </View>

                <View className="auth-field">
                  <Text className="auth-label">Password</Text>
                  <TextInput
                    className={`auth-input ${passwordTouched && !passwordValid && "auth-input-error"}`}
                    value={password}
                    placeholder="Enter your password"
                    placeholderTextColor="rgba(0, 0, 0, 0.4)"
                    secureTextEntry
                    onChangeText={setPassword}
                    onBlur={() => setPasswordTouched(true)}
                    autoComplete="password"
                  />
                  {passwordTouched && !passwordValid && (
                    <Text className="auth-error">Password is required</Text>
                  )}
                  {errors.fields.password && (
                    <Text className="auth-error">
                      {errors.fields.password.message}
                    </Text>
                  )}
                </View>

                <Pressable
                  className={`auth-button ${(!formValid || fetchStatus === "fetching") && "auth-button-disabled"}`}
                  onPress={handleSubmit}
                  disabled={!formValid || fetchStatus === "fetching"}
                >
                  <Text className="auth-button-text">
                    {fetchStatus === "fetching" ? "Signing In..." : "Sign In"}
                  </Text>
                </Pressable>
                <Link href="/(auth)/reset-password" asChild>
                  <Pressable className="auth-secondary-button">
                    <Text className="auth-secondary-button-text">
                      Forgot Password?
                    </Text>
                  </Pressable>
                </Link>
                {flowMessage && (
                  <Text className="auth-error">{flowMessage}</Text>
                )}
              </View>
            </View>

            {/* Sign-Up Link */}
            <View className="auth-link-row">
              <Text className="auth-link-copy">{"Don't have an account?"}</Text>
              <Link href="/(auth)/sign-up" asChild>
                <Pressable>
                  <Text className="auth-link">Create Account</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignIn;
