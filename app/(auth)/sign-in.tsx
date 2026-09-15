import { AuthButton, AuthField, AuthNotice, AuthScreen } from '@/components/AuthUI';
import { getAuthErrorMessage, validateEmail, validatePassword } from '@/lib/auth';
import { useSignIn } from '@clerk/expo';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

export default function SignIn() {
  const { signIn } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async () => {
    if (isSubmitting) return;

    const nextEmailError = validateEmail(email);
    const nextPasswordError = validatePassword(password);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setFormError('');

    if (nextEmailError || nextPasswordError || !signIn) return;

    setIsSubmitting(true);
    try {
      const { error } = await signIn.password({
        identifier: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        setFormError(getAuthErrorMessage(error));
        return;
      }

      if (signIn.status !== 'complete') {
        setFormError(
          'This account needs an additional verification step. Please use another sign-in method or contact support.',
        );
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

  return (
    <AuthScreen
      title='Welcome back'
      subtitle='Sign in to keep every subscription under control.'
    >
      <View className='auth-card'>
        <View className='auth-form'>
          {formError ? <AuthNotice>{formError}</AuthNotice> : null}
          <AuthField
            label='Email'
            value={email}
            error={emailError}
            placeholder='you@example.com'
            autoCapitalize='none'
            autoCorrect={false}
            autoComplete='email'
            keyboardType='email-address'
            textContentType='emailAddress'
            returnKeyType='next'
            onChangeText={(value) => {
              setEmail(value);
              if (emailError) setEmailError('');
            }}
          />
          <AuthField
            label='Password'
            value={password}
            error={passwordError}
            placeholder='Enter your password'
            autoCapitalize='none'
            autoComplete='current-password'
            textContentType='password'
            returnKeyType='done'
            isPassword
            isPasswordVisible={showPassword}
            onTogglePassword={() => setShowPassword((visible) => !visible)}
            onSubmitEditing={handleSignIn}
            onChangeText={(value) => {
              setPassword(value);
              if (passwordError) setPasswordError('');
            }}
          />
          <View className='auth-inline-action'>
            <Link href='/(auth)/forgot-password' className='auth-link'>
              Forgot password?
            </Link>
          </View>
          <AuthButton
            label='Sign in'
            loading={isSubmitting}
            disabled={!signIn}
            onPress={handleSignIn}
          />
        </View>
        <View className='auth-link-row'>
          <Text className='auth-link-copy'>New to SubHog?</Text>
          <Link href='/(auth)/sign-up' className='auth-link'>
            Create an account
          </Link>
        </View>
      </View>
      <Text className='auth-trust-copy'>
        Your account is protected with encrypted session storage.
      </Text>
    </AuthScreen>
  );
}
