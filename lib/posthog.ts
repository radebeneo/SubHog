import {
    isPostHogConfigured,
    resolvePostHogConfig,
    warnMissingOptionalAnalytics
} from "@/lib/posthog-config";
import PostHog from "posthog-react-native";

export {
    isPostHogConfigured,
    resolvePostHogConfig,
    sanitizePostHogProperties,
    warnMissingOptionalAnalytics
} from "@/lib/posthog-config";
export type { PostHogConfig } from "@/lib/posthog-config";

const resolvedConfig = resolvePostHogConfig();

if (__DEV__) {
  warnMissingOptionalAnalytics(resolvedConfig);
}

export const posthog: PostHog | null = isPostHogConfigured(resolvedConfig)
  ? new PostHog(resolvedConfig.projectToken!, {
      host: resolvedConfig.host!,
    })
  : null;
