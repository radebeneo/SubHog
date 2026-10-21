export interface TokenOptions {
  skipCache?: boolean;
  template?: string;
}

export type TokenGetter = (
  options?: TokenOptions,
) => Promise<string | null>;