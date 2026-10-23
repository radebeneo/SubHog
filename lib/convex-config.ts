export type ConvexConfig =
  | { status: "unconfigured" }
  | { status: "invalid"; message: string }
  | { status: "configured"; url: string };

export function resolveConvexConfig(value: string | undefined): ConvexConfig {
  const url = value?.trim();
  if (!url) return { status: "unconfigured" };

  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname.endsWith(".convex.cloud") ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)?\.convex\.cloud$/.test(parsed.hostname) ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error("Invalid deployment URL");
    }
    return { status: "configured", url: parsed.origin };
  } catch {
    return {
      status: "invalid",
      message: "Set EXPO_PUBLIC_CONVEX_URL to the HTTPS .convex.cloud deployment URL.",
    };
  }
}
