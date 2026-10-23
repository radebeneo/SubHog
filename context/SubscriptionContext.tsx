import { convexConfig } from "@/context/AppBackendProvider";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { displayConvexSubscription } from "@/lib/convex-subscription-display";
import type { SubscriptionFields, SubscriptionIcon } from "@/types/subscription-record";
import { useConvexAuth, useConvexConnectionState, useMutation, usePaginatedQuery } from "convex/react";
import {
  Component, createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState,
  type ReactElement, type ReactNode,
} from "react";

interface SubscriptionContextValue {
  subscriptions: Subscription[];
  status: "unconfigured" | "auth-loading" | "auth-required" | "loading" | "error" | "ready";
  connected: boolean;
  canWrite: boolean;
  retry: () => void;
  addSubscription: (fields: SubscriptionFields, icon: SubscriptionIcon) => Promise<void>;
  updateSubscription: (id: string, fields: SubscriptionFields) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
}
interface ProviderProps { children: ReactNode }
interface QuerySnapshot { records: Doc<"subscriptions">[]; ready: boolean; failed: boolean }
const emptySnapshot: QuerySnapshot = { records: [], ready: false, failed: false };
const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);
const unavailable = async (): Promise<void> => { throw new Error("Subscription backend unavailable"); };

export function SubscriptionProvider({ children }: ProviderProps): ReactElement {
  if (convexConfig.status !== "configured") {
    return (
      <SubscriptionContext.Provider value={{
        subscriptions: [], status: "unconfigured", connected: false, canWrite: false,
        retry: () => {}, addSubscription: unavailable,
        updateSubscription: unavailable, deleteSubscription: unavailable,
      }}>
        {children}
      </SubscriptionContext.Provider>
    );
  }
  return <ConnectedSubscriptionProvider>{children}</ConnectedSubscriptionProvider>;
}

function ConnectedSubscriptionProvider({ children }: ProviderProps): ReactElement {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { isWebSocketConnected: connected } = useConvexConnectionState();
  const create = useMutation(api.subscriptions.create);
  const update = useMutation(api.subscriptions.update);
  const remove = useMutation(api.subscriptions.remove);
  const [snapshot, setSnapshot] = useState<QuerySnapshot>(emptySnapshot);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) setSnapshot(emptySnapshot);
  }, [isAuthenticated]);

  const report = useCallback((value: QuerySnapshot): void => {
    setSnapshot((current) => ({
      ...value, records: value.ready ? value.records : current.records,
    }));
  }, []);
  const retry = (): void => {
    setSnapshot((current) => ({ ...current, ready: false, failed: false }));
    setAttempt((current) => current + 1);
  };
  const status: SubscriptionContextValue["status"] = isLoading ? "auth-loading" :
    !isAuthenticated ? "auth-required" : snapshot.failed ? "error" :
      !snapshot.ready ? "loading" : "ready";
  const canWrite = status === "ready" && connected;
  const writePermission = useRef(false);
  useLayoutEffect(() => {
    writePermission.current = canWrite;
    return () => { writePermission.current = false; };
  }, [canWrite]);
  const requireWrite = (): void => {
    // Async icon lookup may hold an older callback after disconnect/unmount.
    if (!writePermission.current) throw new Error("A verified connected session is required");
  };
  const ownedId = (id: string): Doc<"subscriptions">["_id"] => {
    const record = snapshot.records.find((item) => item._id === id);
    if (!record) throw new Error("Subscription is unavailable");
    return record._id;
  };

  return (
    <SubscriptionContext.Provider value={{
      subscriptions: isAuthenticated ? snapshot.records.map(displayConvexSubscription) : [],
      status, connected, canWrite, retry,
      addSubscription: async (fields, icon): Promise<void> => {
        requireWrite();
        await create({ ...fields, icon });
      },
      updateSubscription: async (id, fields): Promise<void> => {
        requireWrite();
        await update({ id: ownedId(id), fields });
      },
      deleteSubscription: async (id): Promise<void> => {
        requireWrite();
        await remove({ id: ownedId(id) });
      },
    }}>
      {isAuthenticated && (
        <SubscriptionQueryBoundary key={attempt} onFailure={() => report({ ...emptySnapshot, failed: true })}>
          <SubscriptionQueryBridge report={report} />
        </SubscriptionQueryBoundary>
      )}
      {children}
    </SubscriptionContext.Provider>
  );
}

// Only the query bridge is inside this boundary. Read retries retain route/form state.
class SubscriptionQueryBoundary extends Component<{
  children: ReactNode; onFailure: () => void;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
  componentDidCatch(): void { this.props.onFailure(); }
  render(): ReactNode { return this.state.failed ? null : this.props.children; }
}

function SubscriptionQueryBridge({ report }: { report: (value: QuerySnapshot) => void }): null {
  const { isAuthenticated } = useConvexAuth();
  const { results, status, loadMore } = usePaginatedQuery(
    api.subscriptions.list, isAuthenticated ? {} : "skip", { initialNumItems: 100 },
  );
  useEffect(() => {
    report({ records: results, ready: status === "Exhausted", failed: false });
    if (isAuthenticated && status === "CanLoadMore") loadMore(100);
  }, [results, status, loadMore, report, isAuthenticated]);
  return null;
}

export function useSubscriptions(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error("useSubscriptions must be used within SubscriptionProvider");
  return context;
}
