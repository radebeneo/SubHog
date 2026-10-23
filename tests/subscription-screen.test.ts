import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Inspect the real screen's element tree with simulated state, not a native renderer.
const mocks = vi.hoisted(() => ({
  subscriptions: [] as Subscription[],
  status: "ready",
  state: null as null | ((initial: unknown) => [unknown, (value: unknown) => void]),
}));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    if (!mocks.state) throw new Error("No active screen simulation");
    return mocks.state(initial);
  },
}));
vi.mock("react-native", () => ({
  FlatList: "FlatList", Image: "Image", KeyboardAvoidingView: "KeyboardAvoidingView",
  Platform: { OS: "ios" }, Pressable: "Pressable", Text: "Text", TextInput: "TextInput", View: "View",
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("../components/DeleteSubscriptionModal", () => ({ default: "DeleteModal" }));
vi.mock("../components/EditSubscriptionModal", () => ({ default: "EditModal" }));
vi.mock("../components/SubscriptionCard", () => ({ default: "SubscriptionCard" }));
vi.mock("../components/SubscriptionDataNotice", () => ({ default: "DataNotice" }));
vi.mock("../constants/images", () => ({ default: { emptyState: 123 } }));
vi.mock("../context/SubscriptionContext", () => ({
  useSubscriptions: () => ({
    subscriptions: mocks.subscriptions, status: mocks.status, canWrite: true,
    updateSubscription: vi.fn(), deleteSubscription: vi.fn(),
  }),
}));
vi.mock("../lib/posthog", () => ({
  posthog: null, sanitizePostHogProperties: (value: unknown) => value,
}));

import Subscriptions from "../app/(tabs)/subscriptions";

type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
function find(tree: ReactNode, type: string, label?: string): Element | undefined {
  let result: Element | undefined;
  Children.forEach(tree, (node) => {
    if (result || !isValidElement<Element["props"]>(node)) return;
    if (node.type === type && (!label || node.props.accessibilityLabel === label)) {
      result = node;
    } else {
      result = find(node.props.children, type, label);
    }
  });
  return result;
}

interface ListProps {
  data: Subscription[];
  scrollEnabled: boolean;
  bounces: boolean;
  alwaysBounceVertical: boolean;
  overScrollMode: string;
  onLayout: (event: { nativeEvent: { layout: { height: number } } }) => void;
  onContentSizeChange: (width: number, height: number) => void;
  ListEmptyComponent: ReactNode;
}

function screenHarness() {
  const slots: unknown[] = [];
  let cursor = 0;
  let changed = false;
  const render = () => {
    mocks.state = (initial) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => {
        slots[index] = typeof value === "function" ? value(slots[index]) : value;
        changed = true;
      }];
    };
    let tree: ReactNode;
    let attempts = 0;
    try {
      do {
        changed = false;
        cursor = 0;
        tree = Subscriptions();
        if (++attempts > 10) throw new Error("Screen did not settle");
      } while (changed);
      return tree;
    } finally {
      mocks.state = null;
    }
  };
  let tree = render();
  return {
    render: () => { tree = render(); },
    list: () => find(tree, "FlatList")!.props as unknown as ListProps,
    key: () => find(tree, "FlatList")!.key,
    button: (label: string) => find(tree, "Pressable", label),
    press: (label: string) => {
      const button = find(tree, "Pressable", label)!;
      expect(button.props.disabled).toBe(false);
      (button.props.onPress as () => void)();
      tree = render();
    },
    search: (query: string) => {
      (find(tree, "TextInput")!.props.onChangeText as (query: string) => void)(query);
      tree = render();
    },
  };
}

beforeEach(() => {
  mocks.status = "ready";
  mocks.subscriptions = Array.from({ length: 21 }, (_, index) => ({
    id: String(index + 1), name: `Service ${index + 1}`, price: 10, billing: "Monthly", icon: 1,
  }));
});

describe("Subscriptions screen pagination and scroll wiring (simulated state)", () => {
  it("limits pages, disables boundary buttons and remounts the list on navigation", () => {
    const screen = screenHarness();
    expect(screen.list().data).toHaveLength(20);
    expect(screen.button("Previous subscriptions page")!.props.disabled).toBe(true);
    const firstKey = screen.key();
    screen.press("Next subscriptions page");
    expect(screen.list().data.map((item) => item.id)).toEqual(["21"]);
    expect(screen.key()).not.toBe(firstKey);
    expect(screen.button("Next subscriptions page")!.props.disabled).toBe(true);
    screen.press("Previous subscriptions page");
    expect(screen.list().data).toHaveLength(20);
  });

  it("resets search to page one and prevents scrolling unmatched searches", () => {
    const screen = screenHarness();
    screen.press("Next subscriptions page");
    screen.search("Service 1");
    expect(screen.list().data).toHaveLength(11);
    expect(screen.key()).toBe("service 1:1");
    expect(screen.button("Next subscriptions page")).toBeUndefined();
    screen.search("missing");
    expect(screen.list().data).toEqual([]);
    screen.list().onLayout({ nativeEvent: { layout: { height: 100 } } });
    screen.list().onContentSizeChange(300, 300);
    screen.render();
    expect(screen.list().scrollEnabled).toBe(false);
    expect(find(screen.list().ListEmptyComponent, "Image")!.props.source).toBe(123);
  });

  it("clamps after the last page is removed and does not restore a stale page", () => {
    const screen = screenHarness();
    screen.press("Next subscriptions page");
    mocks.subscriptions = mocks.subscriptions.slice(0, 20);
    screen.render();
    expect(screen.list().data).toHaveLength(20);
    expect(screen.key()).toBe(":1");
    mocks.subscriptions.push({ ...mocks.subscriptions[0], id: "new" });
    screen.render();
    expect(screen.key()).toBe(":1");
  });

  it("only scrolls overflowing cards and disables overscroll", () => {
    mocks.subscriptions = mocks.subscriptions.slice(0, 2);
    const screen = screenHarness();
    screen.list().onLayout({ nativeEvent: { layout: { height: 500 } } });
    screen.list().onContentSizeChange(300, 250);
    screen.render();
    expect(screen.list().scrollEnabled).toBe(false);
    screen.list().onContentSizeChange(300, 700);
    screen.render();
    expect(screen.list().scrollEnabled).toBe(true);
    screen.list().onContentSizeChange(300, 250);
    screen.render();
    expect(screen.list().scrollEnabled).toBe(false);
    expect(screen.list().bounces).toBe(false);
    expect(screen.list().alwaysBounceVertical).toBe(false);
    expect(screen.list().overScrollMode).toBe("never");
  });

  it("keeps empty states stationary and does not show them during loading", () => {
    mocks.subscriptions = [];
    const screen = screenHarness();
    expect(screen.list().scrollEnabled).toBe(false);
    expect(screen.button("Next subscriptions page")).toBeUndefined();
    expect(find(screen.list().ListEmptyComponent, "Image")!.props.source).toBe(123);
    mocks.status = "loading";
    screen.render();
    expect(screen.list().ListEmptyComponent).toBeNull();
  });
});
