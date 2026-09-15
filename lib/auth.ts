type AuthError = {
  errors?: Array<{
    code?: string;
    longMessage?: string;
    message?: string;
  }>;
  message?: string;
};

export function getAuthErrorMessage(error: unknown) {
  const authError = error as AuthError;
  const detail = authError.errors?.[0];
  const code = detail?.code;

  if (
    code === 'form_password_incorrect' ||
    code === 'form_identifier_not_found' ||
    code === 'identifier_not_found'
  ) {
    return 'The email or password is incorrect.';
  }

  if (code === 'form_identifier_exists') {
    return 'An account with this email already exists. Try signing in instead.';
  }

  if (code === 'form_param_format_invalid') {
    return 'Check the information you entered and try again.';
  }

  if (code === 'verification_expired') {
    return 'That code has expired. Request a new one and try again.';
  }

  if (code === 'form_code_incorrect' || code === 'verification_failed') {
    return 'That verification code is incorrect.';
  }

  if (code === 'too_many_requests') {
    return 'Too many attempts. Wait a moment, then try again.';
  }

  return (
    detail?.longMessage ||
    detail?.message ||
    authError.message ||
    'Something went wrong. Please try again.'
  );
}

export function validateEmail(email: string) {
  if (!email.trim()) return 'Enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return 'Enter a valid email address.';
  }
  return '';
}

export function validatePassword(password: string, requireStrength = false) {
  if (!password) return 'Enter your password.';
  if (requireStrength && password.length < 8) {
    return 'Use at least 8 characters.';
  }
  return '';
}

export function validateVerificationCode(code: string) {
  if (!code.trim()) return 'Enter the verification code.';
  if (!/^\d{6}$/.test(code.trim())) return 'Enter the 6-digit code.';
  return '';
}
