import type { TokenOptions } from "@subhog/api-client";

export type ClerkTokenConfig = {
  template?: string;
};

export function resolveClerkTokenConfig(
  env?: Partial<Record<string, string | undefined>>,
): ClerkTokenConfig {
  const template = (
    env ? env.EXPO_PUBLIC_CLERK_TOKEN_TEMPLATE : process.env.EXPO_PUBLIC_CLERK_TOKEN_TEMPLATE
  )?.trim() || undefined;
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
