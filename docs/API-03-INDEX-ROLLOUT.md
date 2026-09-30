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
6. Inspect the created index and verify duplicate inserts fail in a disposable
   database before enabling the provisioning route.

Configure the profile adapter separately from the API-02 verifier:

- `CLERK_API_BASE_URL`: the approved credential-free HTTPS Clerk API origin
- `CLERK_SECRET_KEY`: the server-only Clerk secret
- `CLERK_PROFILE_TIMEOUT_MS`: a positive bounded request timeout

The API-02 verifier variables remain independently required. Live enablement
also remains blocked until the credential and profile configuration facts in
section 9 of `CONTRACT-01.md` are confirmed.

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
