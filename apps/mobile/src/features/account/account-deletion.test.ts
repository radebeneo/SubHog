import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@subhog/api-client";
import type { IdentityDto } from "@subhog/contracts";
import {
  ACCOUNT_DELETE_RETRY_MESSAGE,
  deleteAccount,
} from "./account-deletion.ts";

const unprovisionedIdentity: IdentityDto = {
  provider: "clerk",
  clerkUserId: "user_subject",
  userId: null,
  provisioned: false,
};

test("deletes the provider user only after backend deletion succeeds", async () => {
  const calls: string[] = [];
  await deleteAccount({
    api: {
      deleteIdentity: async () => {
        calls.push("backend");
      },
      getIdentity: async () => {
        throw new Error("read must not run");
      },
    },
    deleteProviderUser: async () => {
      calls.push("provider");
    },
  });

  assert.deepEqual(calls, ["backend", "provider"]);
});

test("continues after an ambiguous delete only when identity is absent", async () => {
  const calls: string[] = [];
  await deleteAccount({
    api: {
      deleteIdentity: async () => {
        calls.push("backend");
        throw new ApiError("network", {
          code: "NETWORK_ERROR",
          kind: "transport",
          retryable: true,
        });
      },
      getIdentity: async () => {
        calls.push("verify");
        return unprovisionedIdentity;
      },
    },
    deleteProviderUser: async () => {
      calls.push("provider");
    },
  });

  assert.deepEqual(calls, ["backend", "verify", "provider"]);
});

test("keeps the provider user when deletion cannot be confirmed", async () => {
  let providerDeletes = 0;
  const stillProvisioned: IdentityDto = {
    ...unprovisionedIdentity,
    userId: "665f000000000000000001",
    provisioned: true,
  };
  const reads: (() => Promise<IdentityDto>)[] = [
    async () => stillProvisioned,
    async () => {
      throw new Error("offline");
    },
  ];

  for (const getIdentity of reads) {
    await assert.rejects(
      deleteAccount({
        api: {
          deleteIdentity: async () => {
            throw new ApiError("timeout", {
              code: "TIMEOUT",
              kind: "transport",
              retryable: true,
            });
          },
          getIdentity,
        },
        deleteProviderUser: async () => {
          providerDeletes += 1;
        },
      }),
      new RegExp(ACCOUNT_DELETE_RETRY_MESSAGE),
    );
  }

  assert.equal(providerDeletes, 0);
});

test("does not verify after a confirmed backend failure", async () => {
  let reads = 0;
  let providerDeletes = 0;

  await assert.rejects(
    deleteAccount({
      api: {
        deleteIdentity: async () => {
          throw new ApiError("failed", {
            code: "ACCOUNT_DELETE_FAILED",
            kind: "server",
            status: 500,
          });
        },
        getIdentity: async () => {
          reads += 1;
          return unprovisionedIdentity;
        },
      },
      deleteProviderUser: async () => {
        providerDeletes += 1;
      },
    }),
    (error: ApiError) => error.code === "ACCOUNT_DELETE_FAILED",
  );

  assert.equal(reads, 0);
  assert.equal(providerDeletes, 0);
});
