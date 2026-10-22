import { createApiClient } from "@/lib/api-client";
import { resolveApiBaseUrl } from "@/lib/api-config";
import {
  configurationFailure,
  SubscriptionController,
  type AuthSnapshot,
  type SubscriptionState,
} from "@/lib/subscription-controller";
import { toDisplaySubscription } from "@/lib/subscription-display";
import { useAuth } from "@clerk/expo";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

interface SubscriptionContextValue {
  state: SubscriptionState;
  subscriptions: Subscription[];
  provision: () => Promise<void>;
  retry: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);
const noopSubscribe = () => () => undefined;
const noopAction = async () => undefined;

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn, sessionId, userId } = useAuth();
  const getTokenRef = useRef(getToken);

  // Clerk can return a new getter on every render. Keep it current without
  // recreating the controller or restarting session-scoped requests.
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const [setup] = useState(() => {
    try {
      const baseUrl = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
      const api = baseUrl
        ? createApiClient({
            baseUrl,
            getToken: (options) => getTokenRef.current(options),
          })
        : null;
      return { controller: new SubscriptionController(api), error: null };
    } catch (error) {
      return {
        controller: null,
        error: configurationFailure(
          error instanceof Error ? error.message : "API configuration is invalid.",
        ),
      };
    }
  });

  const state = useSyncExternalStore(
    setup.controller?.subscribe ?? noopSubscribe,
    setup.controller?.getState ?? (() => setup.error!),
    setup.controller?.getState ?? (() => setup.error!),
  );

  useEffect(() => {
    const controller = setup.controller;
    if (!controller) return;

    let snapshot: AuthSnapshot;
    if (!isLoaded) {
      snapshot = { status: "loading" };
    } else if (!isSignedIn) {
      snapshot = { status: "signed-out" };
    } else {
      snapshot = {
        status: "signed-in",
        userId,
        sessionId,
      };
    }
    controller.updateAuth(snapshot);
  }, [
    isLoaded,
    isSignedIn,
    sessionId,
    userId,
    setup.controller,
  ]);

  useEffect(() => {
    const controller = setup.controller;
    return () => controller?.dispose();
  }, [setup.controller]);

  const subscriptions = useMemo(
    () =>
      state.status === "ready"
        ? state.subscriptions.map(toDisplaySubscription)
        : [],
    [state],
  );

  return (
    <SubscriptionContext.Provider
      value={{
        state,
        subscriptions,
        provision: setup.controller?.provision ?? noopAction,
        retry: setup.controller?.retry ?? noopAction,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptions(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscriptions must be used within SubscriptionProvider");
  }
  return context;
}
