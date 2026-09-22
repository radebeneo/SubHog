import assert from "node:assert/strict";
import test from "node:test";

import { ApiClient, RequestSessionScope } from "./api-client.ts";
import { ApiError } from "./api-errors.ts";
import {
    errorFixture,
    identityFixture,
    provisionedIdentityFixture,
    subscriptionFixture,
    successFixture,
} from "./api-fixtures.test.ts";

type FetchResponse = Response | (() => Promise<Response>);

function createFetch(responses: FetchResponse[]) {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error("Unexpected fetch call");
    return typeof next === "function" ? next() : next;
  };
  return { fetchMock: fetchMock as typeof fetch, requests };
}

function createClient(
  responses: FetchResponse[],
  tokens: Array<string | null | Error> = ["token"],
  timeoutMs = 50,
) {
  const { fetchMock, requests } = createFetch(responses);
  const getToken = async (options?: { skipCache?: boolean }) => {
    const next = tokens.shift();
    if (next instanceof Error) throw next;
    return next ?? null;
  };
  return {
    client: new ApiClient({
      baseUrl: "https://api.example.test/api/v1/",
      getToken,
      fetchImpl: fetchMock,
      timeoutMs,
    }),
    requests,
  };
}

test("uses an injected ordinary Clerk token and centralized URL", async () => {
  const { client, requests } = createClient([successFixture(identityFixture)]);
  assert.deepEqual(await client.getIdentity(), identityFixture);
  assert.equal(requests[0].url, "https://api.example.test/api/v1/identity");
  assert.equal(requests[0].init.headers instanceof Object, true);
  assert.equal(
    (requests[0].init.headers as Record<string, string>).Authorization,
    "Bearer token",
  );
});

test("distinguishes null tokens from rejected token acquisition", async () => {
  const missing = createClient([], [null]);
  await assert.rejects(missing.client.getIdentity(), (error: ApiError) => {
    assert.equal(error.code, "AUTH_TOKEN_MISSING");
    return true;
  });

  const rejected = createClient([], [new Error("secret token details")]);
  await assert.rejects(rejected.client.getIdentity(), (error: ApiError) => {
    assert.equal(error.code, "AUTH_TOKEN_ACQUISITION_FAILED");
    assert.doesNotMatch(error.message, /secret token details|token/i);
    return true;
  });
});

test("validates identity, provisioning, and complete subscription list DTOs", async () => {
  const identity = createClient([successFixture(identityFixture)]);
  assert.deepEqual(await identity.client.getIdentity(), identityFixture);

  const provision = createClient([successFixture(provisionedIdentityFixture)]);
  assert.deepEqual(
    await provision.client.provisionIdentity(),
    provisionedIdentityFixture,
  );

  const list = createClient([successFixture([subscriptionFixture])]);
  assert.deepEqual(
    await list.client.listSubscriptions(subscriptionFixture.user),
    [subscriptionFixture],
  );
});

test("rejects malformed JSON, unexpected envelopes, unknown enums, and no empty-list fallback", async () => {
  const malformed = createClient([new Response("not json", { status: 200 })]);
  await assert.rejects(malformed.client.getIdentity(), /malformed JSON/);

  const shape = createClient([
    Response.json({ success: true, data: { nope: true } }),
  ]);
  await assert.rejects(shape.client.getIdentity(), /unexpected response shape/);

  const unknownEnum = { ...subscriptionFixture, frequency: "quarterly" };
  const invalidList = createClient([successFixture([unknownEnum])]);
  await assert.rejects(
    invalidList.client.listSubscriptions("user"),
    /unexpected response shape/,
  );

  const failedList = createClient([errorFixture(500, "PROVISIONING_FAILED")]);
  await assert.rejects(
    failedList.client.listSubscriptions("user"),
    (error: ApiError) => {
      assert.equal(error.code, "PROVISIONING_FAILED");
      return true;
    },
  );
});

test("refreshes and replays one eligible read after AUTH_INVALID", async () => {
  const { client, requests } = createClient(
    [errorFixture(401, "AUTH_INVALID"), successFixture(identityFixture)],
    ["stale-token", "fresh-token"],
  );
  assert.deepEqual(await client.getIdentity(), identityFixture);
  assert.equal(requests.length, 2);
  assert.equal(
    (requests[1].init.headers as Record<string, string>).Authorization,
    "Bearer fresh-token",
  );
});

test("coordinates concurrent eligible reads through one scoped refresh", async () => {
  const { client, requests } = createClient(
    [
      errorFixture(401, "AUTH_INVALID"),
      errorFixture(401, "AUTH_INVALID"),
      successFixture(identityFixture),
      successFixture(identityFixture),
    ],
    ["stale-token", "stale-token", "fresh-token"],
  );
  const results = await Promise.all([
    client.getIdentity(),
    client.getIdentity(),
  ]);

  assert.deepEqual(results, [identityFixture, identityFixture]);
  assert.equal(requests.length, 4);
  assert.equal(
    (requests[2].init.headers as Record<string, string>).Authorization,
    "Bearer fresh-token",
  );
  assert.equal(
    (requests[3].init.headers as Record<string, string>).Authorization,
    "Bearer fresh-token",
  );
});

test("bounds repeated 401 recovery to one replay", async () => {
  const { client, requests } = createClient(
    [errorFixture(401, "AUTH_INVALID"), errorFixture(401, "AUTH_INVALID")],
    ["stale-token", "fresh-token"],
  );
  await assert.rejects(client.getIdentity(), (error: ApiError) => {
    assert.equal(error.code, "AUTH_INVALID");
    return true;
  });
  assert.equal(requests.length, 2);
});

test("classifies backend errors without treating them as logout", async () => {
  const cases: Array<[number, string, string]> = [
    [403, "IDENTITY_NOT_PROVISIONED", "authorization"],
    [409, "IDENTITY_CONFLICT", "conflict"],
    [422, "PROFILE_INCOMPLETE", "validation"],
    [500, "PROVISIONING_FAILED", "server"],
    [503, "AUTH_PROVIDER_UNAVAILABLE", "provider"],
  ];
  for (const [status, code, kind] of cases) {
    const { client } = createClient([errorFixture(status, code)]);
    await assert.rejects(client.getIdentity(), (error: ApiError) => {
      assert.equal(error.code, code);
      assert.equal(error.kind, kind);
      assert.equal(error.retryable, status >= 500);
      return true;
    });
  }
});

test("supports timeout and caller cancellation", async () => {
  const timeout = createClient(
    [
      () =>
        new Promise<Response>((_, reject) =>
          setTimeout(
            () => reject(new DOMException("aborted", "AbortError")),
            10,
          ),
        ),
    ],
    ["token"],
    1,
  );
  await assert.rejects(
    timeout.client.getIdentity(),
    (error: ApiError) => error.code === "TIMEOUT",
  );

  const controller = new AbortController();
  controller.abort();
  const cancelled = createClient([successFixture(identityFixture)]);
  await assert.rejects(
    cancelled.client.getIdentity({ signal: controller.signal }),
    (error: ApiError) => {
      assert.equal(error.code, "REQUEST_CANCELLED");
      return true;
    },
  );
});

test("cancels recovery while waiting for a refreshed token", async () => {
  let resolveRefresh!: (token: string) => void;
  const refresh = new Promise<string>((resolve) => {
    resolveRefresh = resolve;
  });
  let tokenCalls = 0;
  const { fetchMock } = createFetch([errorFixture(401, "AUTH_INVALID")]);
  const client = new ApiClient({
    baseUrl: "https://api.example.test/api/v1",
    fetchImpl: fetchMock,
    getToken: async () => {
      tokenCalls += 1;
      return tokenCalls === 1 ? "stale-token" : refresh;
    },
  });
  const controller = new AbortController();
  const request = client.getIdentity({ signal: controller.signal });
  await Promise.resolve();
  await Promise.resolve();
  controller.abort();

  await assert.rejects(request, (error: ApiError) => {
    assert.equal(error.code, "REQUEST_CANCELLED");
    return true;
  });
  resolveRefresh("fresh-token");
});

test("rejects a response that arrives after the request scope changes", async () => {
  let resolveResponse!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });
  const { fetchMock } = createFetch([() => response]);
  const client = new ApiClient({
    baseUrl: "https://api.example.test/api/v1",
    fetchImpl: fetchMock,
    getToken: async () => "token",
  });
  const scope = new RequestSessionScope();
  const request = client.getIdentity({ scope });
  resolveResponse(successFixture(identityFixture));
  scope.invalidate();

  await assert.rejects(request, (error: ApiError) => {
    assert.equal(error.code, "REQUEST_SCOPE_CHANGED");
    return true;
  });
});

test("does not replay after account scope changes and never replays mutations", async () => {
  const scope = new RequestSessionScope();
  const scoped = createClient(
    [errorFixture(401, "AUTH_INVALID")],
    ["stale-token", "fresh-token"],
  );
  scope.invalidate();
  await assert.rejects(
    scoped.client.getIdentity({ scope }),
    (error: ApiError) => {
      assert.equal(error.code, "REQUEST_SCOPE_CHANGED");
      return true;
    },
  );

  const mutation = createClient(
    [errorFixture(401, "AUTH_INVALID")],
    ["mutation-token", "must-not-be-used"],
  );
  await assert.rejects(
    mutation.client.provisionIdentity(),
    (error: ApiError) => {
      assert.equal(error.code, "AUTH_INVALID");
      return true;
    },
  );
});

test("never includes bearer credentials in normalized errors", async () => {
  const secret = "secret-token-value";
  const { client } = createClient(
    [errorFixture(500, "PROVISIONING_FAILED", secret)],
    [secret],
  );
  await assert.rejects(client.getIdentity(), (error: ApiError) => {
    assert.doesNotMatch(error.message, new RegExp(secret));
    assert.doesNotMatch(error.stack ?? "", new RegExp(secret));
    return true;
  });
});

test("redacts either credential from a replay error", async () => {
  const oldToken = "old-secret-token";
  const newToken = "new-secret-token";
  const { client } = createClient(
    [
      errorFixture(401, "AUTH_INVALID"),
      errorFixture(401, "AUTH_INVALID", oldToken),
    ],
    [oldToken, newToken],
  );

  await assert.rejects(client.getIdentity(), (error: ApiError) => {
    assert.equal(error.code, "AUTH_INVALID");
    assert.doesNotMatch(error.message, new RegExp(oldToken));
    assert.doesNotMatch(error.message, new RegExp(newToken));
    assert.doesNotMatch(error.stack ?? "", new RegExp(oldToken));
    assert.doesNotMatch(error.stack ?? "", new RegExp(newToken));
    return true;
  });
});
