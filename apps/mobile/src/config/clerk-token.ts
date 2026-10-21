import type { TokenOptions } from "@subhog/api-client";

export type ClerkTokenConfig = {
  template?: string;
};

export function resolveClerkTokenConfig(
  env: Partial<Record<string, string | undefined>> = process.env,
): ClerkTokenConfig {
  const template = env.EXPO_PUBLIC_CLERK_TOKEN_TEMPLATE?.trim() || undefined;
  return { template };
}

export function withClerkTokenTemplate(
  options: TokenOptions | undefined,
  config: ClerkTokenConfig = resolveClerkTokenConfig(),
): TokenOptions | undefined {
  if (!config.template) {
    return options;
  }

  return {
    ...(options ?? {}),
    template: config.template,
  };
}
