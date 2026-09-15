import { AuthButton, AuthField, AuthNotice, AuthScreen } from '@/components/AuthUI';
import {
  getAuthErrorMessage,
  validateEmail,
  validatePassword,
  validateVerificationCode,
} from '@/lib/auth';
import { useSignIn } from '@clerk/expo';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

type RecoveryStep = 'email' | 'code' | 'password';

export default function ForgotPassword() {
  const { signIn } = useSignIn();
  const [step, setStep] = useState<RecoveryStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sendCode = async (createAttempt: boolean) => {
    if (isSubmitting || !signIn) return;

    const nextError = validateEmail(email);
    setFieldError(nextError);
    setFormError('');
    if (nextError) return;

    setIsSubmitting(true);
    try {
      if (createAttempt) {
        const { error: createError } = await signIn.create({
          identifier: email.trim().toLowerCase(),
        });
        if (createError) {
          setFormError(getAuthErrorMessage(createError));
          return;
        }
      }

      const { error } = await signIn.resetPasswordEmailCode.sendCode();
      if (error) {
        setFormError(getAuthErrorMessage(error));
        return;
      }
      setStep('code');
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (isSubmitting) return;

    const nextError = validateVerificationCode(code);
    setFieldError(nextError);
    setFormError('');
    if (nextError || !signIn) return;

    setIsSubmitting(true);
    try {
      const { error } = await signIn.resetPasswordEmailCode.verifyCode({
        code: code.trim(),
      });
      if (error) {
        setFieldError(getAuthErrorMessage(error));
        return;
      }
      setStep('password');
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (isSubmitting) return;

    const nextError = validatePassword(password, true);
    setFieldError(nextError);
    setFormError('');
    if (nextError || !signIn) return;

    setIsSubmitting(true);
    try {
      const { error } = await signIn.resetPasswordEmailCode.submitPassword({
        password,
        signOutOfOtherSessions: true,
      });
      if (error) {
        setFieldError(getAuthErrorMessage(error));
        return;
      }
      if (signIn.status !== 'complete') {
        setFormError('We could not finish resetting your password. Please try again.');
        return;
      }
      const { error: finalizeError } = await signIn.finalize();
      if (finalizeError) setFormError(getAuthErrorMessage(finalizeError));
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const title =
    step === 'email'
      ? 'Reset your password'
      : step === 'code'
        ? 'Check your inbox'
        : 'Choose a new password';
  const subtitle =
    step === 'email'
      ? 'Enter your account email and we will send you a secure reset code.'
      : step === 'code'
        ? `Enter the 6-digit code sent to ${email.trim()}.`
        : 'Use at least 8 characters for your new password.';

  return (
    <AuthScreen title={title} subtitle={subtitle}>
      <View className='auth-card'>
        <View className='auth-form'>
          {formError ? <AuthNotice>{formError}</AuthNotice> : null}
          {step === 'email' ? (
            <>
              <AuthField
                label='Email'
                value={email}
                error={fieldError}
                placeholder='you@example.com'
                autoCapitalize='none'
                autoCorrect={false}
                autoComplete='email'
                keyboardType='email-address'
                textContentType='emailAddress'
                returnKeyType='done'
                onSubmitEditing={() => sendCode(true)}
                onChangeText={(value) => {
                  setEmail(value);
                  if (fieldError) setFieldError('');
                }}
              />
              <AuthButton
                label='Send reset code'
                loading={isSubmitting}
                disabled={!signIn}
                onPress={() => sendCode(true)}
              />
            </>
          ) : null}
          {step === 'code' ? (
            <>
              <AuthField
                label='Verification code'
                value={code}
                error={fieldError}
                placeholder='Enter your code'
                autoComplete='one-time-code'
                textContentType='oneTimeCode'
                keyboardType='number-pad'
                returnKeyType='done'
                maxLength={6}
                onSubmitEditing={handleVerifyCode}
                onChangeText={(value) => {
                  setCode(value.replace(/\D/g, ''));
                  if (fieldError) setFieldError('');
                }}
              />
              <AuthButton
                label='Verify code'
                loading={isSubmitting}
                disabled={!signIn}
                onPress={handleVerifyCode}
              />
              <AuthButton
                label='Send a new code'
                disabled={!signIn || isSubmitting}
                secondary
                onPress={() => sendCode(false)}
              />
            </>
          ) : null}
          {step === 'password' ? (
            <>
              <AuthField
                label='New password'
                value={password}
                error={fieldError}
                placeholder='At least 8 characters'
                autoCapitalize='none'
                autoComplete='new-password'
                textContentType='newPassword'
                returnKeyType='done'
                isPassword
                isPasswordVisible={showPassword}
                onTogglePassword={() => setShowPassword((visible) => !visible)}
                onSubmitEditing={handleResetPassword}
                onChangeText={(value) => {
                  setPassword(value);
                  if (fieldError) setFieldError('');
                }}
              />
              <AuthButton
                label='Save new password'
                loading={isSubmitting}
                disabled={!signIn}
                onPress={handleResetPassword}
              />
            </>
          ) : null}
        </View>
        <View className='auth-link-row'>
          <Text className='auth-link-copy'>Remembered your password?</Text>
          <Link href='/(auth)/sign-in' className='auth-link'>
            Sign in
          </Link>
        </View>
      </View>
      <Text className='auth-trust-copy'>
        Reset codes expire quickly to help keep your account secure.
      </Text>
    </AuthScreen>
  );
}
