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
