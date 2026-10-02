import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, transportError } from "@subhog/api-client";
import {
  identityFixture,
  provisionedIdentityFixture,
  subscriptionFixture,
} from "@subhog/api-client/testing";
import {
  SubscriptionController,
  type SubscriptionApi,
} from "./subscription-controller.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function mockApi(overrides: Partial<SubscriptionApi> = {}) {
  const calls = { identity: 0, provision: 0, list: [] as string[] };
  const api: SubscriptionApi = {
    async getIdentity() {
      calls.identity += 1;
      return identityFixture;
    },
    async provisionIdentity() {
      calls.provision += 1;
      return provisionedIdentityFixture;
    },
    async listSubscriptions(userId) {
      calls.list.push(userId);
      return [{ ...subscriptionFixture, user: userId }];
    },
    ...overrides,
  };
  return { api, calls };
}

test("does not request before auth readiness or while signed out", async () => {
  const { api, calls } = mockApi();
  const controller = new SubscriptionController(api);
  assert.equal(controller.getState().status, "authentication-loading");
  controller.updateAuth({ status: "loading" });
  controller.updateAuth({ status: "signed-out" });
  await tick();
  assert.deepEqual(calls, { identity: 0, provision: 0, list: [] });
  assert.equal(controller.getState().status, "signed-out");
});

test("uses the resolved API user ID for the owned list", async () => {
  const { api, calls } = mockApi();
  const controller = new SubscriptionController(api);
  controller.updateAuth({
    status: "signed-in",
    userId: identityFixture.clerkUserId,
    sessionId: "session-one",
  });
  await tick();
  assert.deepEqual(calls.list, [identityFixture.userId]);
  assert.equal(controller.getState().status, "ready");
});

test("keeps unprovisioned identity distinct without automatic POST or list", async () => {
  const unprovisioned = {
    ...identityFixture,
    userId: null,
    provisioned: false,
  } as const;
  const { api, calls } = mockApi({ getIdentity: async () => unprovisioned });
  const controller = new SubscriptionController(api);
  controller.updateAuth({
    status: "signed-in",
    userId: unprovisioned.clerkUserId,
    sessionId: "session-one",
  });
  await tick();
  assert.equal(controller.getState().status, "unprovisioned");
  assert.equal(calls.provision, 0);
  assert.deepEqual(calls.list, []);
});

test("explicit provisioning suppresses duplicates and continues to list", async () => {
  const unprovisioned = {
    ...identityFixture,
    userId: null,
    provisioned: false,
  } as const;
  const submitted = deferred<typeof provisionedIdentityFixture>();
  const { api, calls } = mockApi({
    getIdentity: async () => unprovisioned,
    provisionIdentity: async () => {
      calls.provision += 1;
      return submitted.promise;
    },
  });
  const controller = new SubscriptionController(api);
  controller.updateAuth({
    status: "signed-in",
    userId: unprovisioned.clerkUserId,
    sessionId: "session-one",
  });
  await tick();
  const first = controller.provision();
  const second = controller.provision();
  assert.strictEqual(first, second);
  assert.equal(calls.provision, 1);
  submitted.resolve(provisionedIdentityFixture);
  await first;
  assert.deepEqual(calls.list, [provisionedIdentityFixture.userId]);
  assert.equal(controller.getState().status, "ready");
});

test("unchanged auth notifications do not restart identity or provisioning", async () => {
  const unprovisioned = {
    ...identityFixture,
    userId: null,
    provisioned: false,
  } as const;
  const submitted = deferred<typeof provisionedIdentityFixture>();
  const { api, calls } = mockApi({
    getIdentity: async () => {
      calls.identity += 1;
      return unprovisioned;
    },
    provisionIdentity: async () => {
      calls.provision += 1;
      return submitted.promise;
    },
  });
  const controller = new SubscriptionController(api);
  const auth = {
    status: "signed-in",
    userId: unprovisioned.clerkUserId,
    sessionId: "session-one",
  } as const;

  controller.updateAuth(auth);
  await tick();
  controller.updateAuth(auth);
  await tick();
  assert.equal(calls.identity, 1);

  const first = controller.provision();
  controller.updateAuth(auth);
  const second = controller.provision();
  assert.strictEqual(first, second);
  assert.equal(calls.identity, 1);
  assert.equal(calls.provision, 1);

  submitted.resolve(provisionedIdentityFixture);
  await first;
  controller.updateAuth(auth);
  await tick();
  assert.deepEqual(calls, {
    identity: 1,
    provision: 1,
    list: [provisionedIdentityFixture.userId],
  });
});

test("a provisioning failure is not replayed and retry rechecks identity", async () => {
  const unprovisioned = {
    ...identityFixture,
    userId: null,
    provisioned: false,
  } as const;
  const { api, calls } = mockApi({
    getIdentity: async () => {
      calls.identity += 1;
      return unprovisioned;
    },
    provisionIdentity: async () => {
      calls.provision += 1;
      throw new ApiError("The request timed out.", {
        code: "TIMEOUT",
        kind: "transport",
        retryable: true,
      });
    },
  });
  const controller = new SubscriptionController(api);
  controller.updateAuth({
    status: "signed-in",
    userId: unprovisioned.clerkUserId,
    sessionId: "session-one",
  });
  await tick();
  await controller.provision();
  assert.equal(calls.provision, 1);
  const failed = controller.getState();
  assert.equal(failed.status, "error");
  if (failed.status === "error") {
    assert.equal(failed.failure.operation, "provision");
    assert.equal(failed.failure.mutationMayHaveCompleted, true);
  }
  await controller.retry();
  assert.equal(calls.identity, 2);
  assert.equal(calls.provision, 1);
});

test("surfaces current-session provisioning cancellation as ambiguous", async () => {
  const unprovisioned = {
    ...identityFixture,
    userId: null,
    provisioned: false,
  } as const;
  const { api } = mockApi({
    getIdentity: async () => unprovisioned,
    provisionIdentity: async () => {
      throw new ApiError("The request was cancelled.", {
        code: "REQUEST_CANCELLED",
        kind: "cancelled",
        retryable: true,
      });
    },
  });
  const controller = new SubscriptionController(api);
  controller.updateAuth({
    status: "signed-in",
    userId: unprovisioned.clerkUserId,
    sessionId: "session-one",
  });
  await tick();
  await controller.provision();

  const state = controller.getState();
  assert.equal(state.status, "error");
  if (state.status === "error") {
    assert.equal(state.failure.operation, "provision");
    assert.equal(state.failure.kind, "cancelled");
    assert.equal(state.failure.mutationMayHaveCompleted, true);
    assert.equal(state.failure.retryable, true);
  }
});

for (const code of [
  "LEGACY_EMAIL_CONFLICT",
  "IDENTITY_CONFLICT",
  "PROFILE_EMAIL_UNVERIFIED",
  "PROFILE_INCOMPLETE",
] as const) {
  test(`keeps ${code} as a non-ambiguous provisioning failure`, async () => {
    const unprovisioned = {
      ...identityFixture,
      userId: null,
      provisioned: false,
    } as const;
    const { api, calls } = mockApi({
      getIdentity: async () => {
        calls.identity += 1;
        return unprovisioned;
      },
      provisionIdentity: async () => {
        calls.provision += 1;
        throw new ApiError("Stable client-safe message", {
          code,
          kind: code.includes("CONFLICT") ? "conflict" : "validation",
        });
      },
    });
    const controller = new SubscriptionController(api);
    controller.updateAuth({
      status: "signed-in",
      userId: unprovisioned.clerkUserId,
      sessionId: "session-one",
    });
    await tick();
    await controller.provision();
    const state = controller.getState();
    assert.equal(state.status, "error");
    if (state.status === "error") {
      assert.equal(state.failure.code, code);
      assert.equal(state.failure.mutationMayHaveCompleted, false);
      assert.equal(state.failure.retryable, false);
    }
    await controller.retry();
    assert.equal(calls.identity, 2);
    assert.equal(calls.provision, 1);
  });
}

test("allows provisioning again after a recoverable profile-name correction", async () => {
  const unprovisioned = {
    ...identityFixture,
    userId: null,
    provisioned: false,
  } as const;
  let attempts = 0;
  const { api, calls } = mockApi({
    getIdentity: async () => unprovisioned,
    provisionIdentity: async () => {
      calls.provision += 1;
      attempts += 1;
      if (attempts === 1) {
        throw new ApiError("Complete your profile", {
          code: "PROFILE_INCOMPLETE",
          kind: "validation",
        });
      }
      return provisionedIdentityFixture;
    },
  });
  const controller = new SubscriptionController(api);
  controller.updateAuth({
    status: "signed-in",
    userId: unprovisioned.clerkUserId,
    sessionId: "session-one",
  });
  await tick();

  await controller.provision();
  assert.equal(controller.getState().status, "error");
  await controller.provision();

  assert.equal(calls.provision, 2);
  assert.equal(controller.getState().status, "ready");
});

for (const stage of ["identity", "provision", "list"] as const) {
  test(`clears and ignores stale ${stage} completion on sign-out`, async () => {
    const pendingIdentity = deferred<typeof identityFixture>();
    const pendingProvision = deferred<typeof provisionedIdentityFixture>();
    const pendingList = deferred<typeof subscriptionFixture[]>();
    const unprovisioned = { ...identityFixture, userId: null, provisioned: false } as const;
    const listCalls: string[] = [];
    const { api } = mockApi({
      getIdentity: async () =>
        stage === "identity" ? pendingIdentity.promise : stage === "provision" ? unprovisioned : identityFixture,
      provisionIdentity: async () => pendingProvision.promise,
      listSubscriptions: async (userId) => {
        listCalls.push(userId);
        return pendingList.promise;
      },
    });
    const controller = new SubscriptionController(api);
    controller.updateAuth({
      status: "signed-in",
      userId: identityFixture.clerkUserId,
      sessionId: "session-one",
    });
    await tick();
    if (stage === "provision") void controller.provision();
    await tick();
    controller.updateAuth({ status: "signed-out" });
    assert.equal(controller.getState().status, "signed-out");
    const callsBeforeStaleCompletion = [...listCalls];
    pendingIdentity.resolve(identityFixture);
    pendingProvision.resolve(provisionedIdentityFixture);
    pendingList.resolve([subscriptionFixture]);
    await tick();
    assert.deepEqual(listCalls, callsBeforeStaleCompletion);
    assert.equal(controller.getState().status, "signed-out");
  });
}

for (const stage of ["identity", "provision", "list"] as const) {
  test(`clears and ignores stale ${stage} completion on account change`, async () => {
    const oldIdentity = {
      ...identityFixture,
      clerkUserId: "clerk-old",
      userId: "api-old",
    };
    const oldUnprovisioned = {
      ...oldIdentity,
      userId: null,
      provisioned: false,
    } as const;
    const newIdentity = {
      ...identityFixture,
      clerkUserId: "clerk-new",
      userId: "api-new",
    };
    const pendingIdentity = deferred<typeof oldIdentity>();
    const pendingProvision = deferred<typeof provisionedIdentityFixture>();
    const pendingList = deferred<typeof subscriptionFixture[]>();
    let identityCalls = 0;
    const listCalls: string[] = [];
    const { api } = mockApi({
      getIdentity: async () => {
        identityCalls += 1;
        if (identityCalls > 1) return newIdentity;
        if (stage === "identity") return pendingIdentity.promise;
        return stage === "provision" ? oldUnprovisioned : oldIdentity;
      },
      provisionIdentity: async () => pendingProvision.promise,
      listSubscriptions: async (userId) => {
        listCalls.push(userId);
        if (stage === "list" && userId === "api-old") {
          return pendingList.promise;
        }
        return [{ ...subscriptionFixture, user: userId }];
      },
    });
    const controller = new SubscriptionController(api);
    controller.updateAuth({
      status: "signed-in",
      userId: "clerk-old",
      sessionId: "old-session",
    });
    await tick();
    if (stage === "provision") void controller.provision();
    await tick();
    controller.updateAuth({
      status: "signed-in",
      userId: "clerk-new",
      sessionId: "new-session",
    });
    const changedState = controller.getState();
    assert.equal(changedState.status, "resolving-identity");
    assert.doesNotMatch(JSON.stringify(changedState), /clerk-old|api-old/);
    await tick();
    const callsBeforeStaleCompletion = [...listCalls];
    pendingIdentity.resolve(oldIdentity);
    pendingProvision.resolve({
      ...provisionedIdentityFixture,
      clerkUserId: "clerk-old",
      userId: "api-old",
    });
    pendingList.resolve([{ ...subscriptionFixture, user: "api-old" }]);
    await tick();
    assert.deepEqual(listCalls, callsBeforeStaleCompletion);
    const state = controller.getState();
    assert.equal(state.status, "ready");
    if (state.status === "ready") {
      assert.equal(state.identity.clerkUserId, "clerk-new");
      assert.equal(state.identity.userId, "api-new");
      assert.deepEqual(
        state.subscriptions.map((subscription) => subscription.user),
        ["api-new"],
      );
    }
  });
}

for (const stage of ["identity", "provision", "list"] as const) {
  test(`rejects stale ${stage} completion after same-user session replacement`, async () => {
    const oldIdentity = {
      ...identityFixture,
      userId: "api-old-session",
    };
    const oldUnprovisioned = {
      ...oldIdentity,
      userId: null,
      provisioned: false,
    } as const;
    const newIdentity = {
      ...identityFixture,
      userId: "api-new-session",
    };
    const pendingIdentity = deferred<typeof oldIdentity>();
    const pendingProvision = deferred<typeof provisionedIdentityFixture>();
    const pendingList = deferred<typeof subscriptionFixture[]>();
    let identityCalls = 0;
    const listCalls: string[] = [];
    const { api } = mockApi({
      getIdentity: async () => {
        identityCalls += 1;
        if (identityCalls > 1) return newIdentity;
        if (stage === "identity") return pendingIdentity.promise;
        return stage === "provision" ? oldUnprovisioned : oldIdentity;
      },
      provisionIdentity: async () => pendingProvision.promise,
      listSubscriptions: async (userId) => {
        listCalls.push(userId);
        if (stage === "list" && userId === "api-old-session") {
          return pendingList.promise;
        }
        return [{ ...subscriptionFixture, user: userId }];
      },
    });
    const controller = new SubscriptionController(api);
    controller.updateAuth({
      status: "signed-in",
      userId: identityFixture.clerkUserId,
      sessionId: "session-one",
    });
    await tick();
    if (stage === "provision") void controller.provision();
    await tick();
    controller.updateAuth({
      status: "signed-in",
      userId: identityFixture.clerkUserId,
      sessionId: "session-two",
    });
    const changedState = controller.getState();
    assert.equal(changedState.status, "resolving-identity");
    assert.doesNotMatch(JSON.stringify(changedState), /api-old-session/);
    await tick();
    const callsBeforeStaleCompletion = [...listCalls];
    pendingIdentity.resolve(oldIdentity);
    pendingProvision.resolve({
      ...provisionedIdentityFixture,
      userId: "api-old-session",
    });
    pendingList.resolve([{ ...subscriptionFixture, user: "api-old-session" }]);
    await tick();
    assert.deepEqual(listCalls, callsBeforeStaleCompletion);
    const state = controller.getState();
    assert.equal(state.status, "ready");
    if (state.status === "ready") {
      assert.equal(state.identity.userId, "api-new-session");
      assert.deepEqual(
        state.subscriptions.map((subscription) => subscription.user),
        ["api-new-session"],
      );
    }
  });
}

for (const stage of ["identity", "provision", "list"] as const) {
  test(`ignores a stale ${stage} rejection after session replacement`, async () => {
    const oldIdentity = {
      ...identityFixture,
      userId: "api-old-session",
    };
    const oldUnprovisioned = {
      ...oldIdentity,
      userId: null,
      provisioned: false,
    } as const;
    const newIdentity = {
      ...identityFixture,
      userId: "api-new-session",
    };
    const pendingIdentity = deferred<typeof oldIdentity>();
    const pendingProvision = deferred<typeof provisionedIdentityFixture>();
    const pendingList = deferred<typeof subscriptionFixture[]>();
    let identityCalls = 0;
    const { api } = mockApi({
      getIdentity: async () => {
        identityCalls += 1;
        if (identityCalls > 1) return newIdentity;
        if (stage === "identity") return pendingIdentity.promise;
        return stage === "provision" ? oldUnprovisioned : oldIdentity;
      },
      provisionIdentity: async () => pendingProvision.promise,
      listSubscriptions: async (userId) => {
        if (stage === "list" && userId === "api-old-session") {
          return pendingList.promise;
        }
        return [{ ...subscriptionFixture, user: userId }];
      },
    });
    const controller = new SubscriptionController(api);
    controller.updateAuth({
      status: "signed-in",
      userId: identityFixture.clerkUserId,
      sessionId: "session-one",
    });
    await tick();
    if (stage === "provision") void controller.provision();
    await tick();

    controller.updateAuth({
      status: "signed-in",
      userId: identityFixture.clerkUserId,
      sessionId: "session-two",
    });
    await tick();
    assert.equal(controller.getState().status, "ready");

    const staleFailure = new ApiError("Old request failed.", {
      code: "SUBSCRIPTIONS_READ_FAILED",
      kind: "server",
      retryable: true,
    });
    if (stage === "identity") pendingIdentity.reject(staleFailure);
    if (stage === "provision") pendingProvision.reject(staleFailure);
    if (stage === "list") pendingList.reject(staleFailure);
    await tick();

    const state = controller.getState();
    assert.equal(state.status, "ready");
    if (state.status === "ready") {
      assert.equal(state.identity.userId, "api-new-session");
      assert.deepEqual(
        state.subscriptions.map((subscription) => subscription.user),
        ["api-new-session"],
      );
    }
  });
}

test("preserves empty lists and surfaces contracted read failure contexts", async () => {
  const empty = mockApi({ listSubscriptions: async () => [] });
  const emptyController = new SubscriptionController(empty.api);
  emptyController.updateAuth({
    status: "signed-in",
    userId: identityFixture.clerkUserId,
    sessionId: "session-one",
  });
  await tick();
  const emptyState = emptyController.getState();
  assert.equal(emptyState.status, "ready");
  if (emptyState.status === "ready") assert.deepEqual(emptyState.subscriptions, []);

  for (const [code, kind] of [
    ["NETWORK_ERROR", "transport"],
    ["AUTH_PROVIDER_UNAVAILABLE", "provider"],
    ["SUBSCRIPTIONS_READ_FAILED", "server"],
    ["NOT_OWNER", "authorization"],
    ["DATA_INTEGRITY_ERROR", "server"],
  ] as const) {
    const { api } = mockApi({
      listSubscriptions: async () => {
        if (code === "NETWORK_ERROR") {
          throw transportError("Safe failure");
        }
        throw new ApiError("Safe failure", {
          code,
          kind,
        });
      },
    });
    const controller = new SubscriptionController(api);
    controller.updateAuth({
      status: "signed-in",
      userId: identityFixture.clerkUserId,
      sessionId: `session-${code}`,
    });
    await tick();
    const state = controller.getState();
    assert.equal(state.status, "error");
    if (state.status === "error") {
      assert.equal(state.failure.operation, "subscriptions");
      assert.equal(state.failure.code, code);
      assert.equal(state.failure.kind, kind);
    }
  }
});

test("excludes ownership-invalid response data from controller state", async () => {
  const responseOnlyValue = "response-only-payment-method";
  const { api } = mockApi({
    listSubscriptions: async () => [
      {
        ...subscriptionFixture,
        user: "another-api-user",
        paymentMethod: responseOnlyValue,
      },
    ],
  });
  const controller = new SubscriptionController(api);
  controller.updateAuth({
    status: "signed-in",
    userId: identityFixture.clerkUserId,
    sessionId: "session-one",
  });
  await tick();
  const state = controller.getState();
  assert.equal(state.status, "error");
  assert.doesNotMatch(JSON.stringify(state), new RegExp(responseOnlyValue));
});
