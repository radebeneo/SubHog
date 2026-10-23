import { resolveConvexConfig } from "@/lib/convex-config";
import { useAuth } from "@clerk/expo";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

export const convexConfig = resolveConvexConfig(process.env.EXPO_PUBLIC_CONVEX_URL);

interface ProviderProps {
  children: ReactNode;
}

export function AppBackendProvider({ children }: ProviderProps) {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const sessionKey = JSON.stringify([isLoaded, isSignedIn, userId, sessionId]);

  // Reset all route-local drafts and in-memory records on account/session changes,
  // even while the backend is not configured.
  if (convexConfig.status !== "configured") {
    return <Fragment key={sessionKey}>{children}</Fragment>;
  }

  return (
    <SessionBackendProvider key={sessionKey} url={convexConfig.url}>
      {children}
    </SessionBackendProvider>
  );
}

function SessionBackendProvider({ children, url }: ProviderProps & { url: string }) {
  // The constructor is lazy about opening sockets. Keep navigation mounted on
  // the first render so Clerk's post-sign-in navigation can run immediately.
  const [client] = useState(
    () => new ConvexReactClient(url, { unsavedChangesWarning: false }),
  );
  const effectRevision = useRef(0);

  useEffect(() => {
    const revision = ++effectRevision.current;
    return () => {
      // Let descendant unsubscribe/clearAuth cleanup finish before closing.
      // Strict Mode replays setup immediately and must retain this client.
      queueMicrotask(() => {
        if (effectRevision.current === revision) void client.close();
      });
    };
  }, [client]);

  return (
    <ConvexProviderWithClerk client={client} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
