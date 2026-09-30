export function resolveApiBaseUrl(value: string | undefined): string {
  const candidate = value?.trim();
  if (!candidate) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is required");
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("EXPO_PUBLIC_API_BASE_URL must be a valid HTTP(S) URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("EXPO_PUBLIC_API_BASE_URL must be a valid HTTP(S) URL");
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      "EXPO_PUBLIC_API_BASE_URL must not contain credentials, query parameters, or a fragment",
    );
  }

  const pathname = url.pathname.replace(/\/$/, "");
  if (pathname !== "/api/v1") {
    throw new Error("EXPO_PUBLIC_API_BASE_URL must end with /api/v1 exactly once");
  }

  return candidate.endsWith("/") ? candidate.slice(0, -1) : candidate;
}
