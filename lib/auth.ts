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

  return (
    detail?.longMessage ||
    detail?.message ||
    authError.message ||
    "Something went wrong. Please try again."
  );
}

export function validateEmail(email: string) {
  if (!email.trim()) return "Enter your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Enter a valid email address.";
  }
  return "";
}

export function validatePassword(password: string, requireStrength = false) {
  if (!password) return "Enter your password.";
  if (requireStrength && password.length < 8) {
    return "Use at least 8 characters.";
  }
  return "";
}
