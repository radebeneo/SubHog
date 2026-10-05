import { createApiClient } from "@subhog/api-client";
import { resolveApiBaseUrl } from "@/config/api-config";
import {
  configurationFailure,
  SubscriptionController,
  type AuthSnapshot,
  type SubscriptionActionResult,
  type SubscriptionActionState,
  type SubscriptionState,
} from "@/features/subscriptions/subscription-controller";
import { toDisplaySubscription } from "@/features/subscriptions/subscription-display";
import { useAuth } from "@clerk/expo";
import type {
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
} from "@subhog/contracts";
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
  actionState: SubscriptionActionState;
  subscriptions: Subscription[];
  provision: () => Promise<void>;
  retry: () => Promise<void>;
  clearAction: () => void;
  getSubscription: (id: string) => Promise<SubscriptionActionResult>;
  createSubscription: (
    payload: CreateSubscriptionRequest,
  ) => Promise<SubscriptionActionResult>;
  updateSubscription: (
    id: string,
    payload: UpdateSubscriptionRequest,
  ) => Promise<SubscriptionActionResult>;
  cancelSubscription: (id: string) => Promise<SubscriptionActionResult>;
  deleteSubscription: (id: string) => Promise<SubscriptionActionResult>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);
const noopSubscribe = () => () => undefined;
const noopAction = async () => undefined;
const idleActionState: SubscriptionActionState = { status: "idle" };

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
  const actionState = useSyncExternalStore(
    setup.controller?.subscribe ?? noopSubscribe,
    setup.controller?.getActionState ?? (() => idleActionState),
    setup.controller?.getActionState ?? (() => idleActionState),
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
        actionState,
        subscriptions,
        provision: setup.controller?.provision ?? noopAction,
        retry: setup.controller?.retry ?? noopAction,
        clearAction: setup.controller?.clearAction ?? (() => undefined),
        getSubscription: setup.controller?.getSubscription ?? unavailableAction,
        createSubscription:
          setup.controller?.createSubscription ?? unavailableAction,
        updateSubscription:
          setup.controller?.updateSubscription ?? unavailableAction,
        cancelSubscription:
          setup.controller?.cancelSubscription ?? unavailableAction,
        deleteSubscription:
          setup.controller?.deleteSubscription ?? unavailableAction,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

async function unavailableAction(): Promise<SubscriptionActionResult> {
  return { status: "stale", operation: "get" };
}

export function useSubscriptions(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscriptions must be used within SubscriptionProvider");
  }
  return context;
}
