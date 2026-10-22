import { useSubscriptions } from "@/context/SubscriptionContext";
import {
  getSubscriptionSummary,
  type SubscriptionSummary,
} from "@/lib/subscription-summary";
import dayjs from "dayjs";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { AppState } from "react-native";

export function useSubscriptionSummary(): SubscriptionSummary {
  const { subscriptions } = useSubscriptions();
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const refresh = () => {
        if (timeout) clearTimeout(timeout);
        const current = new Date();
        setNow(current);
        const midnight = dayjs(current).add(1, "day").startOf("day");
        timeout = setTimeout(refresh, midnight.valueOf() - current.getTime());
      };
      refresh();
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") refresh();
      });
      return () => {
        if (timeout) clearTimeout(timeout);
        listener.remove();
      };
    }, []),
  );

  return getSubscriptionSummary(subscriptions, now);
}
