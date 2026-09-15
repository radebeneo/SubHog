import { useSignUp } from "@clerk/expo";
import { AuthButton, AuthField, AuthNotice, AuthScreen } from "@/components/AuthUI";
import { getAuthErrorMessage, validateEmail, validatePassword } from "@/lib/auth";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

export default function SignUp() {
  const { signUp } = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendDelay, setResendDelay] = useState(0);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!resendDelay) return;
    const timeout = setTimeout(() => setResendDelay((value) => value - 1), 1000);
    return () => clearTimeout(timeout);
  }, [resendDelay]);

  const handleSignUp = async () => {
    const nextEmailError = validateEmail(email);
    const nextPasswordError = validatePassword(password, true);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setFormError("");

    if (nextEmailError || nextPasswordError || !signUp) return;

    setIsSubmitting(true);
    try {
      const { error } = await signUp.password({
        emailAddress: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        setFormError(getAuthErrorMessage(error));
        return;
      }

      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) {
        setFormError(getAuthErrorMessage(sendError));
        return;
      }

      setIsVerifying(true);
      setResendDelay(30);
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!code.trim()) {
      setCodeError("Enter the verification code.");
      return;
    }
    if (!signUp) return;

    setCodeError("");
    setFormError("");
    setIsSubmitting(true);
    try {
      const { error } = await signUp.verifications.verifyEmailCode({
        code: code.trim(),
      });
      if (error) {
        setCodeError(getAuthErrorMessage(error));
        return;
      }

      const { error: finalizeError } = await signUp.finalize();
      if (finalizeError) setFormError(getAuthErrorMessage(finalizeError));
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!signUp || resendDelay) return;
    setFormError("");
    setIsSubmitting(true);
    try {
      const { error } = await signUp.verifications.sendEmailCode();
      if (error) {
        setFormError(getAuthErrorMessage(error));
        return;
      }
      setResendDelay(30);
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerifying) {
    return (
      <AuthScreen
        title="Check your inbox"
        subtitle={`We sent a verification code to ${email.trim()}.`}
      >
        <View className="auth-card">
          <View className="auth-form">
            {formError ? <AuthNotice>{formError}</AuthNotice> : null}
            <AuthField
              label="Verification code"
              value={code}
              error={codeError}
              placeholder="Enter your code"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              keyboardType="number-pad"
              returnKeyType="done"
              maxLength={6}
              onSubmitEditing={handleVerify}
              onChangeText={(value) => {
                setCode(value.replace(/\D/g, ""));
                if (codeError) setCodeError("");
              }}
            />
            <AuthButton
              label="Verify account"
              loading={isSubmitting}
              disabled={!signUp}
              onPress={handleVerify}
            />
            <AuthButton
              label={resendDelay ? `Resend in ${resendDelay}s` : "Resend code"}
              disabled={Boolean(resendDelay)}
              secondary
              onPress={handleResend}
            />
          </View>
          <View className="auth-link-row">
            <Text className="auth-link-copy">Wrong email?</Text>
            <Text className="auth-link" onPress={() => setIsVerifying(false)}>
              Go back
            </Text>
          </View>
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Start tracking smarter"
      subtitle="Create your account and make recurring costs easier to manage."
    >
      <View className="auth-card">
        <View className="auth-form">
          {formError ? <AuthNotice>{formError}</AuthNotice> : null}
          <AuthField
            label="Email"
            value={email}
            error={emailError}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            onChangeText={(value) => {
              setEmail(value);
              if (emailError) setEmailError("");
            }}
          />
          <AuthField
            label="Password"
            value={password}
            error={passwordError}
            placeholder="At least 8 characters"
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            isPassword
            isPasswordVisible={showPassword}
            onTogglePassword={() => setShowPassword((visible) => !visible)}
            onSubmitEditing={handleSignUp}
            onChangeText={(value) => {
              setPassword(value);
              if (passwordError) setPasswordError("");
            }}
          />
          <Text className="auth-helper">
            Use 8 or more characters. A verification code will be sent by email.
          </Text>
          <AuthButton
            label="Create account"
            loading={isSubmitting}
            disabled={!signUp}
            onPress={handleSignUp}
          />
          <View nativeID="clerk-captcha" />
        </View>
        <View className="auth-link-row">
          <Text className="auth-link-copy">Already have an account?</Text>
          <Link href="/(auth)/sign-in" className="auth-link">
            Sign in
          </Link>
        </View>
      </View>
      <Text className="auth-trust-copy">
        No payment details required. Your data stays private.
      </Text>
    </AuthScreen>
  );
}
