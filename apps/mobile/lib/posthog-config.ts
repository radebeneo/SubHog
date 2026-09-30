export type PostHogConfig = {
  projectToken?: string;
  host?: string;
};

export function resolvePostHogConfig(
  env: Partial<Record<string, string | undefined>> = process.env,
): PostHogConfig {
  const projectToken =
    env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() || undefined;
  const host = env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || undefined;

  return { projectToken, host };
}

export function isPostHogConfigured(
  config: PostHogConfig = resolvePostHogConfig(),
) {
  return Boolean(config.projectToken && config.host);
}

export function sanitizePostHogProperties<T extends Record<string, unknown>>(
  properties: T,
): Partial<T> {
  const sanitizedEntries = Object.entries(properties).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );

  return Object.fromEntries(sanitizedEntries) as Partial<T>;
}

export function warnMissingOptionalAnalytics(
  config: PostHogConfig = resolvePostHogConfig(),
  isDev: boolean = typeof __DEV__ !== "undefined" ? __DEV__ : false,
) {
  if (!isDev || isPostHogConfigured(config)) {
    return;
  }

  const missing = [
    !config.projectToken ? "EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN" : null,
    !config.host ? "EXPO_PUBLIC_POSTHOG_HOST" : null,
  ].filter(Boolean);

  if (missing.length === 0) {
    return;
  }

  console.warn(
    `[PostHog] Analytics disabled: missing ${missing.join(", ")}. Configure the optional PostHog env vars to enable analytics.`,
  );
}
