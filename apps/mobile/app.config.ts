import type { ConfigContext, ExpoConfig } from "expo/config";

import {
  isPostHogConfigured,
  resolvePostHogConfig,
} from "./src/adapters/posthog-config.ts";

if (!isPostHogConfigured(resolvePostHogConfig())) {
  console.warn(
    "[PostHog] EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN or EXPO_PUBLIC_POSTHOG_HOST is not set. This build will send no analytics. Set both in apps/mobile/.env or in the EAS environment.",
  );
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "SubHog",
  slug: config.slug ?? "SubHog",
});
