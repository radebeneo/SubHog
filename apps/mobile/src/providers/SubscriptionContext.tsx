import { createApiClient } from "@subhog/api-client";
import { resolveApiBaseUrl } from "@/config/api-config";
import {
  configurationFailure,
  SubscriptionController,
  type AuthSnapshot,
  type SubscriptionState,
} from "@/features/subscriptions/subscription-controller";
import { toDisplaySubscription } from "@/features/subscriptions/subscription-display";
import { useAuth } from "@clerk/expo";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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
  const setup = useMemo(() => {
    try {
      const baseUrl = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
      const api = createApiClient({
        baseUrl,
        getToken: (options) => getToken(options),
      });
      return { controller: new SubscriptionController(api), error: null };
    } catch (error) {
      return {
        controller: null,
        error: configurationFailure(
          error instanceof Error ? error.message : "API configuration is invalid.",
        ),
      };
    }
  }, [getToken]);

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
