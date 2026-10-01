import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import {
    createClerkProfileConfig,
    MAX_CLERK_PROFILE_TIMEOUT_MS,
} from '../src/config/clerk-profile.js';
import { createIdentityController } from '../src/controllers/identity.controller.js';
import errorMiddleware from '../src/middlewares/error.middleware.js';
import { createClerkAuthorize } from '../src/middlewares/clerk-auth.middleware.js';
import User, { serializeUser } from '../src/models/user.model.js';
import { createIdentityRouter } from '../src/routes/identity.routes.js';
import {
    createClerkProfileClient,
    IdentityApiError,
    MAX_CLERK_PROFILE_BODY_BYTES,
} from '../src/services/clerk-profile.js';
import { createIdentityService } from '../src/services/identity-service.js';

const identity = { provider: 'clerk', subject: 'user_subject' };
const storedUser = {
    _id: '665f000000000000000001',
    name: 'Owner Example',
    email: 'owner@example.test',
    identityProvider: 'clerk',
    providerSubject: 'user_subject',
};

const expectApiError = async (promise, statusCode, code) => {
    await assert.rejects(promise, (error) => {
        assert.equal(error.statusCode, statusCode);
        assert.equal(error.code, code);
        return true;
    });
};

const makeProfile = (overrides = {}) => ({
    id: 'user_subject',
    first_name: ' Owner ',
    last_name: ' Example ',
    primary_email_address_id: 'primary',
    email_addresses: [
        {
            id: 'secondary',
            email_address: 'secondary@example.test',
            verification: { status: 'verified' },
        },
        {
            id: 'primary',
            email_address: ' OWNER@EXAMPLE.TEST ',
            verification: { status: 'verified' },
        },
    ],
    ...overrides,
});

const profileConfig = {
    apiBaseUrl: new URL('https://api.clerk.test'),
    secretKey: 'server-secret',
    timeoutMs: 1000,
};

const makeProfileClient = (profile, inspectRequest = () => {}) => (
    createClerkProfileClient(profileConfig, {
        fetchImpl: async (url, options) => {
            inspectRequest(url, options);
            return new Response(JSON.stringify(profile), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        },
    })
);

const startIdentityServer = async ({ service, verify = async () => identity }) => {
    const app = express();
    app.use(express.json());
    app.use(
        '/api/v1/identity',
        createIdentityRouter({
            authorize: createClerkAuthorize(verify),
            controller: createIdentityController(service),
            provisioningEnabled: true,
        }),
    );
    app.use(errorMiddleware);

    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));

    return {
        server,
        url: `http://127.0.0.1:${server.address().port}/api/v1/identity`,
    };
};

test('User schema requires legacy passwords and permits passwordless paired Clerk associations', async () => {
    const legacy = new User({ name: 'Legacy User', email: 'legacy@example.test' });
    const legacyError = legacy.validateSync();
    assert.equal(legacyError.errors.password.message, 'Password is required');

    const providerUser = new User({
        name: 'Clerk User',
        email: 'clerk@example.test',
        identityProvider: 'clerk',
        providerSubject: 'user_clerk',
    });
    assert.equal(providerUser.validateSync(), undefined);
    assert.equal(providerUser.password, undefined);

    const unpaired = new User({
        name: 'Clerk User',
        email: 'unpaired@example.test',
        providerSubject: 'user_unpaired',
    });
    assert.ok(unpaired.validateSync().errors.identityProvider);

    const fakePassword = new User({
        name: 'Clerk User',
        email: 'fake@example.test',
        password: 'not-allowed',
        identityProvider: 'clerk',
        providerSubject: 'user_fake',
    });
    assert.equal(
        fakePassword.validateSync().errors.password.message,
        'Provider-associated users cannot have a password',
    );
});

test('User association fields are immutable and use the contracted unique partial index', () => {
    assert.equal(User.schema.path('identityProvider').options.immutable, true);
    assert.equal(User.schema.path('providerSubject').options.immutable, true);

    const [, options] = User.schema.indexes().find(
        ([keys]) => keys.identityProvider === 1 && keys.providerSubject === 1,
    );
    assert.equal(options.unique, true);
    assert.deepEqual(options.partialFilterExpression, {
        identityProvider: { $type: 'string' },
        providerSubject: { $type: 'string' },
    });

    const existing = new User(storedUser);
    existing.$isNew = false;
    existing.identityProvider = 'other';
    existing.providerSubject = 'replacement_subject';
    assert.equal(existing.identityProvider, 'clerk');
    assert.equal(existing.providerSubject, 'user_subject');
});

test('general user serialization excludes passwords and provider association fields', () => {
    assert.deepEqual(serializeUser({
        ...storedUser,
        password: 'secret-hash',
        createdAt: 'created',
        updatedAt: 'updated',
    }), {
        _id: storedUser._id,
        name: storedUser.name,
        email: storedUser.email,
        createdAt: 'created',
        updatedAt: 'updated',
    });
});

test('Clerk profile configuration is separate, pinned to an HTTPS origin, and bounded', () => {
    const config = createClerkProfileConfig({
        CLERK_API_BASE_URL: 'https://api.clerk.test',
        CLERK_SECRET_KEY: 'secret',
        CLERK_PROFILE_TIMEOUT_MS: '1500',
    });
    assert.equal(config.apiBaseUrl.origin, 'https://api.clerk.test');
    assert.equal(config.timeoutMs, 1500);

    assert.throws(() => createClerkProfileConfig({
        CLERK_API_BASE_URL: 'https://api.clerk.test/request-controlled/path',
        CLERK_SECRET_KEY: 'secret',
        CLERK_PROFILE_TIMEOUT_MS: '1500',
    }), /HTTPS origin/);
    assert.throws(() => createClerkProfileConfig({
        CLERK_API_BASE_URL: 'https://api.clerk.test',
        CLERK_SECRET_KEY: 'secret',
        CLERK_PROFILE_TIMEOUT_MS: String(MAX_CLERK_PROFILE_TIMEOUT_MS + 1),
    }), /must be an integer/);
});

test('profile adapter builds the subject path, blocks redirects, and selects verified primary email', async () => {
    let request;
    const client = makeProfileClient(makeProfile(), (url, options) => {
        request = { url, options };
    });

    assert.deepEqual(await client('user_subject'), {
        name: 'Owner Example',
        email: 'owner@example.test',
    });
    assert.equal(request.url.href, 'https://api.clerk.test/v1/users/user_subject');
    assert.equal(request.options.redirect, 'error');
    assert.equal(request.options.headers.authorization, 'Bearer server-secret');
    assert.ok(request.options.signal);
});

test('profile adapter rejects URL dot-segment subjects before making a request', async () => {
    let requests = 0;
    const client = createClerkProfileClient(profileConfig, {
        fetchImpl: async () => {
            requests += 1;
        },
    });

    for (const subject of ['', '.', '..']) {
        await expectApiError(client(subject), 503, 'AUTH_PROVIDER_UNAVAILABLE');
    }
    assert.equal(requests, 0);
});

test('profile adapter rejects subject mismatch, malformed responses, invalid names, and unverified primary email', async () => {
    await expectApiError(
        makeProfileClient(makeProfile({ id: 'different_subject' }))('user_subject'),
        503,
        'AUTH_PROVIDER_UNAVAILABLE',
    );
    await expectApiError(
        makeProfileClient({ id: 'user_subject' })('user_subject'),
        503,
        'AUTH_PROVIDER_UNAVAILABLE',
    );
    await expectApiError(
        makeProfileClient(makeProfile({ first_name: 'A', last_name: null }))('user_subject'),
        422,
        'PROFILE_INCOMPLETE',
    );
    await expectApiError(
        makeProfileClient(makeProfile({
            email_addresses: [{
                id: 'primary',
                email_address: 'owner@example.test',
                verification: { status: 'unverified' },
            }],
        }))('user_subject'),
        422,
        'PROFILE_EMAIL_UNVERIFIED',
    );
});

test('profile adapter maps network, provider, invalid JSON, and bounded-body failures safely', async () => {
    const clients = [
        createClerkProfileClient(profileConfig, {
            fetchImpl: async () => { throw new Error('network secret'); },
        }),
        createClerkProfileClient(profileConfig, {
            fetchImpl: async () => new Response('rate limit details', { status: 429 }),
        }),
        createClerkProfileClient(profileConfig, {
            fetchImpl: async () => new Response('{invalid json', { status: 200 }),
        }),
        createClerkProfileClient(profileConfig, {
            fetchImpl: async () => new Response('{}', {
                status: 200,
                headers: {
                    'content-length': String(MAX_CLERK_PROFILE_BODY_BYTES + 1),
                },
            }),
        }),
        createClerkProfileClient(profileConfig, {
            fetchImpl: async () => new Response(
                JSON.stringify({ padding: 'x'.repeat(MAX_CLERK_PROFILE_BODY_BYTES) }),
                { status: 200 },
            ),
        }),
    ];

    for (const client of clients) {
        await assert.rejects(client('user_subject'), (error) => {
            assert.equal(error.statusCode, 503);
            assert.equal(error.code, 'AUTH_PROVIDER_UNAVAILABLE');
            assert.equal(error.message, 'Authentication provider is temporarily unavailable');
            assert.equal(error.message.includes('secret'), false);
            assert.equal(error.message.includes('rate'), false);
            return true;
        });
    }
});

test('profile adapter rejects an oversized timeout when constructed directly', () => {
    assert.throws(() => createClerkProfileClient({
        ...profileConfig,
        timeoutMs: MAX_CLERK_PROFILE_TIMEOUT_MS + 1,
    }), /Complete Clerk profile configuration/);
});

test('profile adapter aborts a bounded request and returns a safe provider error', async () => {
    const client = createClerkProfileClient({
        ...profileConfig,
        timeoutMs: 1,
    }, {
        fetchImpl: async (url, { signal }) => {
            assert.equal(url.href, 'https://api.clerk.test/v1/users/user_subject');
            await new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => reject(signal.reason), { once: true });
            });
        },
    });

    await assert.rejects(client('user_subject'), (error) => {
        assert.equal(error.statusCode, 503);
        assert.equal(error.code, 'AUTH_PROVIDER_UNAVAILABLE');
        assert.equal(error.message, 'Authentication provider is temporarily unavailable');
        return true;
    });
});

test('identity reads return provisioned and unprovisioned projections without profile calls or writes', async () => {
    let profileCalls = 0;
    let writes = 0;
    let found = storedUser;
    const service = createIdentityService({
        UserModel: {
            findOne: async () => found,
        },
        profileLookup: async () => {
            profileCalls += 1;
        },
        createUser: async () => {
            writes += 1;
        },
    });

    assert.deepEqual(await service.resolveIdentity(identity), {
        provider: 'clerk',
        clerkUserId: 'user_subject',
        userId: storedUser._id,
        provisioned: true,
    });

    found = null;
    assert.deepEqual(await service.resolveIdentity(identity), {
        provider: 'clerk',
        clerkUserId: 'user_subject',
        userId: null,
        provisioned: false,
    });
    assert.equal(profileCalls, 0);
    assert.equal(writes, 0);
});

test('identity database read failures use the exact safe envelope', async () => {
    const service = createIdentityService({
        UserModel: { findOne: async () => { throw new Error('database details'); } },
    });
    const { server, url } = await startIdentityServer({ service });

    try {
        const response = await fetch(url, {
            headers: { authorization: 'Bearer test' },
        });
        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), {
            success: false,
            code: 'IDENTITY_RESOLUTION_FAILED',
            message: 'Identity resolution failed',
        });
    } finally {
        server.close();
    }
});

test('authentication errors remain distinct from database failures', async () => {
    let databaseCalls = 0;
    const service = {
        resolveIdentity: async () => {
            databaseCalls += 1;
        },
    };
    const authError = new IdentityApiError(
        503,
        'AUTH_PROVIDER_UNAVAILABLE',
        'Authentication verification is temporarily unavailable',
    );
    const { server, url } = await startIdentityServer({
        service,
        verify: async () => { throw authError; },
    });

    try {
        const response = await fetch(url);
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), {
            success: false,
            code: 'AUTH_PROVIDER_UNAVAILABLE',
            message: 'Authentication verification is temporarily unavailable',
        });
        assert.equal(databaseCalls, 0);
    } finally {
        server.close();
    }
});

test('invalid authentication retains the exact 401 envelope and prevents identity reads', async () => {
    let databaseCalls = 0;
    const service = {
        resolveIdentity: async () => {
            databaseCalls += 1;
        },
    };
    const authError = new IdentityApiError(
        401,
        'AUTH_INVALID',
        'The authentication credential is invalid',
    );
    const { server, url } = await startIdentityServer({
        service,
        verify: async () => { throw authError; },
    });

    try {
        const response = await fetch(url);
        assert.equal(response.status, 401);
        assert.deepEqual(await response.json(), {
            success: false,
            code: 'AUTH_INVALID',
            message: 'The authentication credential is invalid',
        });
        assert.equal(databaseCalls, 0);
    } finally {
        server.close();
    }
});

test('provisioning accepts absent and empty bodies and rejects unexpected, non-object, and malformed JSON', async () => {
    let calls = 0;
    const service = {
        provisionIdentity: async () => {
            calls += 1;
            return {
                created: calls === 1,
                data: {
                    provider: 'clerk',
                    clerkUserId: 'user_subject',
                    userId: storedUser._id,
                    email: storedUser.email,
                    name: storedUser.name,
                },
            };
        },
    };
    const { server, url } = await startIdentityServer({ service });

    try {
        const absent = await fetch(`${url}/provision`, {
            method: 'POST',
            headers: { authorization: 'Bearer test' },
        });
        assert.equal(absent.status, 201);
        assert.deepEqual(await absent.json(), {
            success: true,
            data: {
                provider: 'clerk',
                clerkUserId: 'user_subject',
                userId: storedUser._id,
                email: storedUser.email,
                name: storedUser.name,
            },
        });

        const empty = await fetch(`${url}/provision`, {
            method: 'POST',
            headers: {
                authorization: 'Bearer test',
                'content-type': 'application/json',
            },
            body: '{}',
        });
        assert.equal(empty.status, 200);

        for (const body of ['{"name":"Injected"}', '[]', '"value"', 'null', '{']) {
            const response = await fetch(`${url}/provision`, {
                method: 'POST',
                headers: {
                    authorization: 'Bearer test',
                    'content-type': 'application/json',
                },
                body,
            });
            assert.equal(response.status, 400);
            assert.deepEqual(await response.json(), {
                success: false,
                code: 'REQUEST_INVALID',
                message: 'The request body must be an empty JSON object',
            });
        }

        const nonJson = await fetch(`${url}/provision`, {
            method: 'POST',
            headers: {
                authorization: 'Bearer test',
                'content-type': 'text/plain',
            },
            body: '{}',
        });
        assert.equal(nonJson.status, 400);
        assert.deepEqual(await nonJson.json(), {
            success: false,
            code: 'REQUEST_INVALID',
            message: 'The request body must be an empty JSON object',
        });

        assert.equal(calls, 2);
    } finally {
        server.close();
    }
});

test('first provisioning creates only trusted profile and association fields without a password', async () => {
    const queries = [];
    let createdDocument;
    const service = createIdentityService({
        UserModel: {
            findOne: async (query) => {
                queries.push(query);
                return null;
            },
        },
        profileLookup: async (subject) => {
            assert.equal(subject, identity.subject);
            return { name: storedUser.name, email: storedUser.email };
        },
        createUser: async (document) => {
            createdDocument = document;
            return { ...storedUser, ...document };
        },
    });

    const result = await service.provisionIdentity(identity);
    assert.equal(result.created, true);
    assert.deepEqual(createdDocument, {
        name: storedUser.name,
        email: storedUser.email,
        identityProvider: 'clerk',
        providerSubject: 'user_subject',
    });
    assert.equal(createdDocument.password, undefined);
    assert.deepEqual(queries, [
        { identityProvider: 'clerk', providerSubject: 'user_subject' },
        { email: 'owner@example.test' },
    ]);
});

test('idempotent repeat preserves stored profile and performs no profile lookup or write', async () => {
    let profileCalls = 0;
    let writes = 0;
    const service = createIdentityService({
        UserModel: { findOne: async () => storedUser },
        profileLookup: async () => {
            profileCalls += 1;
        },
        createUser: async () => {
            writes += 1;
        },
    });

    const result = await service.provisionIdentity(identity);
    assert.equal(result.created, false);
    assert.equal(result.data.name, storedUser.name);
    assert.equal(result.data.email, storedUser.email);
    assert.equal(profileCalls, 0);
    assert.equal(writes, 0);
});

test('legacy email and mismatched association conflicts do not write', async () => {
    for (const existing of [
        { _id: 'legacy', email: storedUser.email, password: 'hash' },
        {
            _id: 'other',
            email: storedUser.email,
            identityProvider: 'clerk',
            providerSubject: 'other_subject',
        },
    ]) {
        let lookup = 0;
        let writes = 0;
        const service = createIdentityService({
            UserModel: {
                findOne: async () => {
                    lookup += 1;
                    return lookup === 1 ? null : existing;
                },
            },
            profileLookup: async () => ({
                name: storedUser.name,
                email: storedUser.email,
            }),
            createUser: async () => {
                writes += 1;
            },
        });

        await expectApiError(
            service.provisionIdentity(identity),
            409,
            existing.providerSubject ? 'IDENTITY_CONFLICT' : 'LEGACY_EMAIL_CONFLICT',
        );
        assert.equal(writes, 0);
    }
});

test('concurrent pre-create observation returns the matching association unchanged', async () => {
    let lookup = 0;
    let writes = 0;
    const service = createIdentityService({
        UserModel: {
            findOne: async () => {
                lookup += 1;
                return lookup === 1 ? null : storedUser;
            },
        },
        profileLookup: async () => ({
            name: 'New Provider Name',
            email: storedUser.email,
        }),
        createUser: async () => {
            writes += 1;
        },
    });

    const result = await service.provisionIdentity(identity);
    assert.equal(result.created, false);
    assert.equal(result.data.name, storedUser.name);
    assert.equal(writes, 0);
});

test('duplicate-key recovery succeeds only when provider, subject, and email invariants match', async () => {
    const duplicate = Object.assign(new Error('duplicate details'), { code: 11000 });

    const matchingService = createIdentityService({
        UserModel: {
            findOne: async () => null,
        },
        profileLookup: async () => ({
            name: storedUser.name,
            email: storedUser.email,
        }),
        createUser: async () => { throw duplicate; },
    });
    let recoveryLookup = 0;
    matchingService.provisionIdentity = createIdentityService({
        UserModel: {
            findOne: async () => {
                recoveryLookup += 1;
                if (recoveryLookup <= 2) return null;
                return storedUser;
            },
        },
        profileLookup: async () => ({
            name: storedUser.name,
            email: storedUser.email,
        }),
        createUser: async () => { throw duplicate; },
    }).provisionIdentity;

    const recovered = await matchingService.provisionIdentity(identity);
    assert.equal(recovered.created, false);
    assert.equal(recovered.data.userId, storedUser._id);

    let conflictLookup = 0;
    const conflictingService = createIdentityService({
        UserModel: {
            findOne: async () => {
                conflictLookup += 1;
                if (conflictLookup <= 2) return null;
                return {
                    ...storedUser,
                    providerSubject: 'different_subject',
                };
            },
        },
        profileLookup: async () => ({
            name: storedUser.name,
            email: storedUser.email,
        }),
        createUser: async () => { throw duplicate; },
    });
    await expectApiError(
        conflictingService.provisionIdentity(identity),
        409,
        'IDENTITY_CONFLICT',
    );
});

test('provisioning database failures map to PROVISIONING_FAILED without details', async () => {
    const service = createIdentityService({
        UserModel: { findOne: async () => { throw new Error('database secret'); } },
    });
    await expectApiError(
        service.provisionIdentity(identity),
        500,
        'PROVISIONING_FAILED',
    );
});
