# API-03 Identity Index Rollout

API-03 requires the `unique_provider_subject` partial index declared by the
`User` schema:

```js
{
  key: { identityProvider: 1, providerSubject: 1 },
  unique: true,
  partialFilterExpression: {
    identityProvider: { $type: 'string' },
    providerSubject: { $type: 'string' }
  }
}
```

Identity deletion also relies on the `unique_deleted_provider_subject` index
declared by the `IdentityDeletion` schema:

```js
{
  key: { identityProvider: 1, providerSubject: 1 },
  unique: true
}
```

Do not use `syncIndexes()`, drop indexes, or modify user documents as part of
this rollout.

Application startup explicitly uses Mongoose with `autoIndex: false`. Runtime
startup therefore does not create or reconcile this index automatically.

Before enabling live provisioning:

1. Back up the target database according to the deployment runbook.
2. Confirm every association has both fields, `identityProvider` is exactly
   `clerk`, and `providerSubject` is a non-empty string.
3. Confirm no `(identityProvider, providerSubject)` pair occurs more than once.
4. Confirm the existing unique email index is present and healthy.
5. Create `unique_provider_subject` explicitly in a maintenance window using
   the definition above.
6. Create `unique_deleted_provider_subject` on the `identitydeletions`
   collection using the definition above.
7. Inspect both created indexes and verify duplicate inserts fail in a
   disposable database before enabling the provisioning route.

Deletion records are durable tombstones keyed by provider and subject. They
must be retained after the corresponding user document is removed; deleting a
tombstone permits that identity to be provisioned again.

Account deletion marks the user inactive and waits for active subscription
creation reservations to drain before looking up reminder workflows. Subscription
creation acquires that reservation atomically only while the user is active and
releases it after the workflow has been recorded or canceled.

Configure the profile adapter separately from the API-02 verifier:

- `CLERK_API_BASE_URL`: the approved credential-free HTTPS Clerk API origin
- `CLERK_SECRET_KEY`: the server-only Clerk secret
- `CLERK_PROFILE_TIMEOUT_MS`: a positive bounded request timeout

The Clerk verifier variables remain independently required. Live enablement
also requires the credential and profile configuration described by the
canonical [`CONTRACT-01`](../../../docs/contracts/CONTRACT-01.md#clerk-credential-policy).

The application does not delete, rewrite, link, or repair existing users during
index rollout. Any invalid or duplicate association requires a separately
approved, backed-up operator migration.

## Provisioning availability gate

The provisioning route is not registered unless all of these conditions hold:

- `IDENTITY_PROVISIONING_ENABLED` is exactly `true`.
- `DB_RESOURCE_ID` identifies the database resource used by the application.
- `IDENTITY_PROVISIONING_RESOURCE_ID` exactly matches `DB_RESOURCE_ID`.
- `IDENTITY_PROVISIONING_RESOURCE_CONFIRMATION` is exactly
  `ENABLE_PROVISIONING:<IDENTITY_PROVISIONING_RESOURCE_ID>`.

Identity resolution remains available when provisioning is disabled. A missing,
partial, or mismatched enabled configuration fails closed during route creation.

## Acceptance environment

The MongoDB acceptance harness reads only `INTEGRATION_MONGODB_URI`; it never
falls back to `DB_URI`. It additionally requires an explicit resource ID,
database name, run ID, resource-bound disposable confirmation, and run-scoped
cleanup confirmation. Live API acceptance separately requires two dedicated
Clerk session tokens and run-scoped subscription seed approval.

The harness creates missing required indexes explicitly and inspects their
definitions. It does not call `syncIndexes()`, drop indexes or collections, or
repair data. Cleanup is limited to document IDs created and recorded by that
acceptance run.
