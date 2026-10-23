import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc } from "../convex/_generated/dataModel";
import type { SubscriptionFields } from "../types/subscription-record";

// Deterministic hook simulation, not a DOM/native renderer or live backend.
// Exercise actual provider/bridge/action code with controlled committed effects.
const mocks = vi.hoisted(() => ({
  active: null as null | {
    state: (initial: unknown) => [unknown, (value: unknown) => void];
    ref: (initial: unknown) => { current: unknown };
    effect: (callback: () => void | (() => void), dependencies?: readonly unknown[]) => void;
    callback: (value: unknown) => unknown;
  },
  auth: { isLoading: false, isAuthenticated: true },
  connection: { isWebSocketConnected: true },
  pagination: { results: [] as unknown[], status: "LoadingFirstPage", loadMore: vi.fn() },
  mutation: vi.fn(),
  config: { status: "configured" },
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const hooks = () => {
    if (!mocks.active) throw new Error("No active hook simulation");
    return mocks.active;
  };
  return {
    ...actual,
    useState: (initial: unknown) => hooks().state(initial),
    useRef: (initial: unknown) => hooks().ref(initial),
    useEffect: (callback: () => void | (() => void), deps?: readonly unknown[]) => hooks().effect(callback, deps),
    useLayoutEffect: (callback: () => void | (() => void), deps?: readonly unknown[]) => hooks().effect(callback, deps),
    useCallback: (value: unknown) => hooks().callback(value),
  };
});
vi.mock("../context/AppBackendProvider", () => ({ convexConfig: mocks.config }));
vi.mock("../lib/convex-subscription-display", () => ({
  displayConvexSubscription: (record: Doc<"subscriptions">) => ({
    id: record._id, name: record.name, price: record.amountCents / 100,
  }),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => mocks.auth,
  useConvexConnectionState: () => mocks.connection,
  useMutation: () => mocks.mutation,
  usePaginatedQuery: vi.fn(() => mocks.pagination),
}));

import { SubscriptionProvider } from "../context/SubscriptionContext";
import { useSubscriptionAction } from "../hooks/useSubscriptionAction";
import { usePaginatedQuery } from "convex/react";

class HookSimulation {
  private slots: unknown[] = [];
  private cursor = 0;
  private effects: (() => void)[] = [];
  private cleanups: (() => void)[] = [];
  state = (initial: unknown): [unknown, (value: unknown) => void] => {
    const index = this.cursor++;
    if (!(index in this.slots)) {
      this.slots[index] = typeof initial === "function" ? initial() : initial;
    }
    return [this.slots[index], (value: unknown) => {
      this.slots[index] = typeof value === "function" ? value(this.slots[index]) : value;
    }];
  };
  ref = (initial: unknown): { current: unknown } => {
    const index = this.cursor++;
    if (!(index in this.slots)) this.slots[index] = { current: initial };
    return this.slots[index] as { current: unknown };
  };
  callback = (value: unknown): unknown => {
    const index = this.cursor++;
    if (!(index in this.slots)) this.slots[index] = value;
    return this.slots[index];
  };
  effect = (callback: () => void | (() => void), deps?: readonly unknown[]): void => {
    const index = this.cursor++;
    const previous = this.slots[index] as readonly unknown[] | undefined;
    if (deps && previous && deps.length === previous.length &&
      deps.every((value, i) => Object.is(value, previous[i]))) return;
    this.slots[index] = deps;
    this.effects.push(() => {
      this.cleanups[index]?.();
      const cleanup = callback();
      this.cleanups[index] = typeof cleanup === "function" ? cleanup : () => {};
    });
  };
  render<T>(render: () => T): T {
    this.cursor = 0;
    mocks.active = this;
    try { return render(); } finally { mocks.active = null; }
  }
  commit(): void { this.effects.splice(0).forEach((effect) => effect()); }
  unmount(): void { this.cleanups.forEach((cleanup) => cleanup()); }
}

function deferred() {
  let resolve!: () => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

interface ContextValue {
  subscriptions: { id: string; name: string; price: number }[];
  status: string;
  canWrite: boolean;
  retry: () => void;
  addSubscription: (fields: SubscriptionFields, icon: { kind: "wallet" }) => Promise<void>;
  updateSubscription: (id: string, fields: SubscriptionFields) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
}
interface Snapshot { records: Doc<"subscriptions">[]; ready: boolean; failed: boolean }
interface BridgeProps { report: (snapshot: Snapshot) => void }
interface BoundaryProps { children: ReactElement<BridgeProps>; onFailure: () => void }
interface ProviderTree {
  value: ContextValue;
  children: [ReactElement<BoundaryProps>, ReactNode];
}
function providerHarness() {
  const hooks = new HookSimulation();
  const outer = SubscriptionProvider({ children: "retained-route-draft" });
  const Connected = outer.type as (props: { children: ReactNode }) => ReactElement<ProviderTree>;
  const render = () => hooks.render(() => Connected({ children: "retained-route-draft" }));
  let tree = render();
  hooks.commit();
  return {
    hooks,
    render: () => { tree = render(); hooks.commit(); return tree; },
    get tree() { return tree; },
  };
}
function report(harness: ReturnType<typeof providerHarness>, snapshot: Snapshot): void {
  harness.tree.props.children[0].props.children.props.report(snapshot);
  harness.render();
}
const fields: SubscriptionFields = {
  name: "Service", amountCents: 12000, billingCycle: "monthly", startDate: "2026-10-23",
};
const record = { _id: "owned-id", name: "Service", amountCents: 12000 } as Doc<"subscriptions">;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth = { isLoading: false, isAuthenticated: true };
  mocks.connection = { isWebSocketConnected: true };
  mocks.pagination = { results: [], status: "LoadingFirstPage", loadMore: vi.fn() };
  mocks.mutation.mockResolvedValue(null);
  mocks.config.status = "configured";
});

describe("submission lifecycle (simulated hooks)", () => {
  it("locks immediately, suppresses duplicate taps and only succeeds after acknowledgement", async () => {
    const hooks = new HookSimulation();
    const action = hooks.render(useSubscriptionAction);
    hooks.commit();
    const backend = deferred();
    const write = vi.fn(() => backend.promise);
    const success = vi.fn();
    const first = action.run(write, success);
    expect(action.isPending()).toBe(true);
    await action.run(write, success);
    expect(write).toHaveBeenCalledTimes(1);
    expect(success).not.toHaveBeenCalled();
    expect(hooks.render(useSubscriptionAction).pending).toBe(true);
    backend.resolve();
    await first;
    expect(success).toHaveBeenCalledTimes(1);
    expect(hooks.render(useSubscriptionAction).pending).toBe(false);
  });

  it("failure preserves caller-owned draft, sanitizes errors and permits explicit retry", async () => {
    const hooks = new HookSimulation();
    const action = hooks.render(useSubscriptionAction);
    hooks.commit();
    const draft = { name: "unsaved-draft" };
    const success = vi.fn(() => { draft.name = ""; });
    await action.run(async () => { throw new Error("private-token"); }, success);
    expect(draft.name).toBe("unsaved-draft");
    expect(success).not.toHaveBeenCalled();
    expect(hooks.render(useSubscriptionAction).error).not.toContain("private-token");
    await action.run(async () => {}, success);
    expect(success).toHaveBeenCalledTimes(1);
    expect(hooks.render(useSubscriptionAction).error).toBeNull();
  });

  it("delayed icon lookup cannot start a write or success after unmount", async () => {
    const hooks = new HookSimulation();
    const action = hooks.render(useSubscriptionAction);
    hooks.commit();
    const lookup = deferred();
    const write = vi.fn();
    const success = vi.fn();
    const pending = action.run(async (isCurrent) => {
      await lookup.promise;
      if (isCurrent()) write();
    }, success);
    hooks.unmount();
    lookup.resolve();
    await pending;
    expect(write).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    await action.run(async () => { write(); }, success);
    expect(write).not.toHaveBeenCalled();
  });

  it.each(["resolve", "reject"] as const)("ignores stale mutation %s after unmount", async (outcome) => {
    const hooks = new HookSimulation();
    const action = hooks.render(useSubscriptionAction);
    hooks.commit();
    const backend = deferred();
    const success = vi.fn();
    const pending = action.run(() => backend.promise, success);
    hooks.unmount();
    if (outcome === "resolve") backend.resolve(); else backend.reject(new Error("stale"));
    await pending;
    expect(success).not.toHaveBeenCalled();
    expect(hooks.render(useSubscriptionAction).error).toBeNull();
  });
});

describe("server source and pagination (simulated hooks/backend)", () => {
  it("unconfigured storage disables writes rather than offering a local fallback", async () => {
    mocks.config.status = "unconfigured";
    const tree = SubscriptionProvider({ children: "draft" }) as ReactElement<ProviderTree>;
    expect(tree.props.value.status).toBe("unconfigured");
    expect(tree.props.value.subscriptions).toEqual([]);
    await expect(tree.props.value.addSubscription(fields, { kind: "wallet" })).rejects.toThrow();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("holds partial pages and retains only the last complete snapshot through failure/retry", () => {
    const harness = providerHarness();
    report(harness, { records: [record], ready: false, failed: false });
    expect(harness.tree.props.value.subscriptions).toEqual([]);
    expect(harness.tree.props.value.canWrite).toBe(false);
    report(harness, { records: [record], ready: true, failed: false });
    expect(harness.tree.props.value.subscriptions).toHaveLength(1);
    const key = harness.tree.props.children[0].key;
    harness.tree.props.children[0].props.onFailure();
    harness.render();
    expect(harness.tree.props.value.status).toBe("error");
    expect(harness.tree.props.value.subscriptions).toHaveLength(1);
    harness.tree.props.value.retry();
    harness.render();
    expect(harness.tree.props.value.status).toBe("loading");
    expect(harness.tree.props.children[0].key).not.toBe(key);
    expect(harness.tree.props.children[1]).toBe("retained-route-draft");
    report(harness, { records: [], ready: false, failed: false });
    expect(harness.tree.props.value.subscriptions).toHaveLength(1);
    report(harness, { records: [], ready: true, failed: false });
    expect(harness.tree.props.value.subscriptions).toEqual([]);
  });

  it.each([
    [true, true, "auth-loading"], [false, false, "auth-required"],
  ] as const)("gates writes during auth state %s/%s", async (isLoading, isAuthenticated, status) => {
    const harness = providerHarness();
    report(harness, { records: [record], ready: true, failed: false });
    mocks.auth = { isLoading, isAuthenticated };
    harness.render();
    expect(harness.tree.props.value.status).toBe(status);
    await expect(harness.tree.props.value.addSubscription(fields, { kind: "wallet" })).rejects.toThrow();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("guards stale callbacks after disconnect/auth loss/unmount and awaits all mutations", async () => {
    const harness = providerHarness();
    report(harness, { records: [record], ready: true, failed: false });
    const old = harness.tree.props.value;
    const backend = deferred();
    mocks.mutation.mockReturnValue(backend.promise);
    let confirmed = false;
    const pending = old.addSubscription(fields, { kind: "wallet" }).then(() => { confirmed = true; });
    expect(confirmed).toBe(false);
    backend.resolve();
    await pending;
    expect(confirmed).toBe(true);
    mocks.mutation.mockResolvedValue(null);
    await old.updateSubscription("owned-id", fields);
    await old.deleteSubscription("owned-id");
    expect(mocks.mutation.mock.calls[1]).toEqual([{ id: "owned-id", fields }]);
    expect(mocks.mutation.mock.calls[2]).toEqual([{ id: "owned-id" }]);
    await expect(old.deleteSubscription("missing")).rejects.toThrow();
    mocks.connection.isWebSocketConnected = false;
    harness.render();
    await expect(old.addSubscription(fields, { kind: "wallet" })).rejects.toThrow();
    mocks.connection.isWebSocketConnected = true;
    mocks.auth.isAuthenticated = false;
    harness.render();
    expect(harness.tree.props.value.subscriptions).toEqual([]);
    await expect(old.deleteSubscription("owned-id")).rejects.toThrow();
    harness.hooks.unmount();
    await expect(old.addSubscription(fields, { kind: "wallet" })).rejects.toThrow();
    expect(mocks.mutation).toHaveBeenCalledTimes(3);
  });

  it("bridge fetches successive pages of 100 and reports completeness only at Exhausted", () => {
    const harness = providerHarness();
    const bridge = harness.tree.props.children[0].props.children;
    const Bridge = bridge.type as (props: BridgeProps) => null;
    const spy = vi.fn();
    const hooks = new HookSimulation();
    const render = () => { hooks.render(() => Bridge({ report: spy })); hooks.commit(); };
    mocks.pagination.status = "CanLoadMore";
    mocks.pagination.results = [record];
    render();
    expect(mocks.pagination.loadMore).toHaveBeenCalledWith(100);
    expect(spy).toHaveBeenLastCalledWith({ records: [record], ready: false, failed: false });
    mocks.pagination.status = "LoadingMore";
    render();
    expect(mocks.pagination.loadMore).toHaveBeenCalledTimes(1);
    mocks.pagination.status = "CanLoadMore";
    mocks.pagination.results = [record, { ...record, _id: "second" }];
    render();
    expect(mocks.pagination.loadMore).toHaveBeenCalledTimes(2);
    mocks.pagination.status = "Exhausted";
    render();
    expect(spy).toHaveBeenLastCalledWith({ records: mocks.pagination.results, ready: true, failed: false });
    expect(vi.mocked(usePaginatedQuery).mock.calls[0]?.slice(1)).toEqual([{}, { initialNumItems: 100 }]);
    mocks.auth.isAuthenticated = false;
    render();
    expect(vi.mocked(usePaginatedQuery).mock.calls.at(-1)?.[1]).toBe("skip");
  });
});
