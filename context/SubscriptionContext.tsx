import {
  deleteSubscriptionRecord,
  updateSubscriptionRecord,
} from "@/lib/subscription-state";
import type { SubscriptionEdits } from "@/types/subscription";
import {
  createContext,
  useContext,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

interface SubscriptionContextValue {
  subscriptions: Subscription[];
  addSubscription: (subscription: Subscription) => void;
  updateSubscription: (id: string, edits: SubscriptionEdits) => void;
  deleteSubscription: (id: string) => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  const addSubscription = (subscription: Subscription): void => {
    setSubscriptions((currentSubscriptions) => [
      subscription,
      ...currentSubscriptions,
    ]);
  };

  const updateSubscription = (id: string, edits: SubscriptionEdits): void => {
    setSubscriptions((current) => updateSubscriptionRecord(current, id, edits));
  };

  const deleteSubscription = (id: string): void => {
    setSubscriptions((current) => deleteSubscriptionRecord(current, id));
  };

  return (
    <SubscriptionContext.Provider
      value={{ subscriptions, addSubscription, updateSubscription, deleteSubscription }}
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
