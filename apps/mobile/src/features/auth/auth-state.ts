export type SupportedMfaStrategy =
  | "email_code"
  | "phone_code"
  | "totp"
  | "backup_code";

const supportedMfaStrategies = new Set<string>([
  "email_code",
  "phone_code",
  "totp",
  "backup_code",
]);

export function getSupportedMfaStrategies(
  factors: readonly { strategy: string }[],
): SupportedMfaStrategy[] {
  return factors
    .map((factor) => factor.strategy)
    .filter(
      (strategy): strategy is SupportedMfaStrategy =>
        supportedMfaStrategies.has(strategy),
    )
    .filter((strategy, index, strategies) => strategies.indexOf(strategy) === index);
}

export function getMfaStrategyLabel(strategy: SupportedMfaStrategy): string {
  switch (strategy) {
    case "email_code":
      return "Email code";
    case "phone_code":
      return "Text message";
    case "totp":
      return "Authenticator app";
    case "backup_code":
      return "Backup code";
  }
}

export function getSessionTaskCopy(taskKey: string): {
  title: string;
  description: string;
} {
  switch (taskKey) {
    case "reset-password":
      return {
        title: "Password update required",
        description:
          "Your account requires a password update before SubHog can continue.",
      };
    case "setup-mfa":
      return {
        title: "Security setup required",
        description:
          "Your account requires multi-factor authentication setup before SubHog can continue.",
      };
    case "choose-organization":
      return {
        title: "Account setup required",
        description:
          "Your account requires an organization choice before SubHog can continue.",
      };
    default:
      return {
        title: "Account action required",
        description:
          "Clerk requires an additional account step before SubHog can continue.",
      };
  }
}

export function getAuthErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!error || typeof error !== "object") return fallback;

  const candidate = error as { longMessage?: unknown; message?: unknown };
  if (
    typeof candidate.longMessage === "string" &&
    candidate.longMessage.trim()
  ) {
    return candidate.longMessage;
  }
  if (typeof candidate.message === "string" && candidate.message.trim()) {
    return candidate.message;
  }

  return fallback;
}
