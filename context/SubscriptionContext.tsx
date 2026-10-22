import { HOME_SUBSCRIPTIONS } from "@/constants/data";
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
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [subscriptions, setSubscriptions] =
    useState<Subscription[]>(HOME_SUBSCRIPTIONS);

  const addSubscription = (subscription: Subscription): void => {
    setSubscriptions((currentSubscriptions) => [
      subscription,
      ...currentSubscriptions,
    ]);
  };

  return (
    <SubscriptionContext.Provider value={{ subscriptions, addSubscription }}>
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
