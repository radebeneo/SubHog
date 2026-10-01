export interface TokenOptions {
  skipCache?: boolean;
}

export type TokenGetter = (
  options?: TokenOptions,
) => Promise<string | null>;