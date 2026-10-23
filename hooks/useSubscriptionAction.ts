import { subscriptionOperationMessage } from "@/lib/subscription-operation-error";
import { useLayoutEffect, useRef, useState } from "react";

// One mounted form owns one pending submission. No retries or offline queue.
export function useSubscriptionAction(): {
  pending: boolean;
  error: string | null;
  isPending: () => boolean;
  run: (action: (isCurrent: () => boolean) => Promise<void>, onSuccess: () => void) => Promise<void>;
} {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const lifetime = useRef(0);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    const current = ++lifetime.current;
    return () => {
      mounted.current = false;
      if (lifetime.current === current) ++lifetime.current;
    };
  }, []);

  const run = async (
    action: (isCurrent: () => boolean) => Promise<void>,
    onSuccess: () => void,
  ): Promise<void> => {
    if (!mounted.current || inFlight.current) return;
    inFlight.current = true;
    const current = lifetime.current;
    const isCurrent = () => mounted.current && current === lifetime.current;
    setPending(true);
    setError(null);
    try {
      await action(isCurrent);
      if (isCurrent()) onSuccess();
    } catch (cause) {
      if (isCurrent()) setError(subscriptionOperationMessage(cause));
    } finally {
      inFlight.current = false;
      if (isCurrent()) setPending(false);
    }
  };
  return { pending, error, isPending: () => inFlight.current, run };
}
