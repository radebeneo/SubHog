export interface ClerkTokenOptions {
  skipCache?: boolean;
}

export type ClerkTokenGetter = (
  options?: ClerkTokenOptions,
) => Promise<string | null>;
