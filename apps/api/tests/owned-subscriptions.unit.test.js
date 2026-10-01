import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import { createGetUserSubscriptions } from '../src/controllers/subscription.controller.js';
import { createClerkAuthorize } from '../src/middlewares/clerk-auth.middleware.js';
import errorMiddleware from '../src/middlewares/error.middleware.js';
import Subscription from '../src/models/subscription.model.js';
import User from '../src/models/user.model.js';
import { createSubscriptionRouter } from '../src/routes/subscription.routes.js';
import { IdentityApiError } from '../src/services/clerk-profile.js';
import {
    createOwnedSubscriptionService,
    OWNED_SUBSCRIPTION_FIELDS,
    serializeOwnedSubscription,
} from '../src/services/owned-subscription-service.js';

const ownerId = '665f00000000000000000001';
const otherId = '665f00000000000000000002';
const identity = { provider: 'clerk', subject: 'user_subject' };
const baseSubscription = {
    _id: '665f00000000000000000010',
    name: 'Example Plus',
    price: 12.5,
    currency: 'USD',
    frequency: 'monthly',
    category: 'entertainment',
    paymentMethod: 'card',
    status: 'active',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    renewalDate: new Date('2026-02-01T00:00:00.000Z'),
    user: ownerId,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const startServer = async ({ verify, service }) => {
    const app = express();
    app.use('/api/v1/subscriptions', createSubscriptionRouter({
        ownedSubscriptionsAuthorize: createClerkAuthorize(verify),
        ownedSubscriptionsHandler: createGetUserSubscriptions(service),
    }));
    app.use(errorMiddleware);

    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));

    return {
        server,
        url: `http://127.0.0.1:${server.address().port}/api/v1/subscriptions/user`,
    };
};

const request = (url, id = ownerId, token = 'clerk-session') => fetch(`${url}/${id}`, {
    headers: { authorization: `Bearer ${token}` },
});

const expectEnvelope = async (response, status, code, message) => {
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), {
        success: false,
        code,
        message,
    });
};

test('owned subscriptions accept Clerk credentials and reject legacy JWTs without fallback', async () => {
    let associationReads = 0;
    let subscriptionReads = 0;
    const service = createOwnedSubscriptionService({
        associationLookup: async () => {
            associationReads += 1;
            return { _id: ownerId };
        },
        subscriptionLookup: async () => {
            subscriptionReads += 1;
            return [];
        },
    });
    const verify = async (authorization) => {
        if (authorization === 'Bearer clerk-session') return identity;
        throw new IdentityApiError(401, 'AUTH_INVALID', 'The authentication credential is invalid');
    };
    const { server, url } = await startServer({ verify, service });

    try {
        const valid = await request(url);
        assert.equal(valid.status, 200);
        assert.deepEqual(await valid.json(), { success: true, data: [] });

        const legacy = await request(url, ownerId, 'legacy.jwt.token');
        await expectEnvelope(
            legacy,
            401,
            'AUTH_INVALID',
            'The authentication credential is invalid',
        );
        assert.equal(associationReads, 1);
        assert.equal(subscriptionReads, 1);
    } finally {
        server.close();
    }
});

test('authentication failures take precedence and prevent downstream reads', async () => {
    let reads = 0;
    const service = createOwnedSubscriptionService({
        associationLookup: async () => {
            reads += 1;
        },
    });
    const verify = async () => {
        throw new IdentityApiError(
            503,
            'AUTH_PROVIDER_UNAVAILABLE',
            'Authentication verification is temporarily unavailable',
        );
    };
    const { server, url } = await startServer({ verify, service });

    try {
        await expectEnvelope(
            await request(url, 'malformed'),
            503,
            'AUTH_PROVIDER_UNAVAILABLE',
            'Authentication verification is temporarily unavailable',
        );
        assert.equal(reads, 0);
    } finally {
        server.close();
    }
});

test('ID validation, provisioning, and ownership follow deterministic precedence', async () => {
    let associatedUser = null;
    let associationReads = 0;
    let subscriptionReads = 0;
    const service = createOwnedSubscriptionService({
        associationLookup: async () => {
            associationReads += 1;
            return associatedUser;
        },
        subscriptionLookup: async () => {
            subscriptionReads += 1;
            return [];
        },
    });
    const { server, url } = await startServer({
        verify: async () => identity,
        service,
    });

    try {
        await expectEnvelope(
            await request(url, 'not-an-object-id'),
            422,
            'INVALID_USER_ID',
            'The user ID is invalid',
        );
        assert.equal(associationReads, 0);

        await expectEnvelope(
            await request(url),
            403,
            'IDENTITY_NOT_PROVISIONED',
            'The authenticated identity is not provisioned',
        );
        assert.equal(subscriptionReads, 0);

        associatedUser = { _id: ownerId };
        await expectEnvelope(
            await request(url, otherId),
            403,
            'NOT_OWNER',
            'The authenticated user is not the requested owner',
        );
        assert.equal(subscriptionReads, 0);
    } finally {
        server.close();
    }
});

test('an invalid associated user preserves the approved USER_NOT_FOUND status', async () => {
    const service = createOwnedSubscriptionService({
        associationLookup: async () => ({ _id: null }),
    });
    const { server, url } = await startServer({ verify: async () => identity, service });

    try {
        await expectEnvelope(
            await request(url),
            404,
            'USER_NOT_FOUND',
            'The associated user was not found',
        );
    } finally {
        server.close();
    }
});

test('association and subscription database failures share the exact endpoint envelope', async () => {
    for (const service of [
        createOwnedSubscriptionService({
            associationLookup: async () => { throw new Error('association database details'); },
        }),
        createOwnedSubscriptionService({
            associationLookup: async () => ({ _id: ownerId }),
            subscriptionLookup: async () => { throw new Error('subscription database details'); },
        }),
    ]) {
        const { server, url } = await startServer({ verify: async () => identity, service });
        try {
            await expectEnvelope(
                await request(url),
                500,
                'SUBSCRIPTIONS_READ_FAILED',
                'Subscriptions could not be read',
            );
        } finally {
            server.close();
        }
    }
});

test('matching ownership returns the complete allowlisted DTO in deterministic order', async () => {
    const newestId = '665f00000000000000000012';
    const olderId = '665f00000000000000000011';
    const oldestId = '665f00000000000000000013';
    let queriedUserId;
    const service = createOwnedSubscriptionService({
        associationLookup: async (receivedIdentity) => {
            assert.deepEqual(receivedIdentity, identity);
            return { _id: ownerId };
        },
        subscriptionLookup: async (associatedUserId) => {
            queriedUserId = associatedUserId;
            return [
                {
                    ...baseSubscription,
                    _id: oldestId,
                    createdAt: new Date('2025-12-31T23:59:59.999Z'),
                },
                { ...baseSubscription, _id: olderId, workflowRunId: 'private-workflow' },
                {
                    ...baseSubscription,
                    _id: newestId,
                    password: 'private-credential',
                    identityProvider: 'clerk',
                },
            ];
        },
    });
    const { server, url } = await startServer({ verify: async () => identity, service });

    try {
        const response = await request(url, ownerId.toUpperCase());
        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(queriedUserId, ownerId);
        assert.deepEqual(
            payload.data.map(({ _id }) => _id),
            [newestId, olderId, oldestId],
        );
        assert.deepEqual(payload.data[0], {
            _id: newestId,
            name: 'Example Plus',
            price: 12.5,
            currency: 'USD',
            frequency: 'monthly',
            category: 'entertainment',
            paymentMethod: 'card',
            status: 'active',
            startDate: '2026-01-01T00:00:00.000Z',
            renewalDate: '2026-02-01T00:00:00.000Z',
            user: ownerId,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
        });
        assert.equal(JSON.stringify(payload).includes('workflowRunId'), false);
        assert.equal(JSON.stringify(payload).includes('password'), false);
        assert.equal(JSON.stringify(payload).includes('identityProvider'), false);
    } finally {
        server.close();
    }
});

test('production listing adapter performs only allowlisted reads with the required sort', async () => {
    const originalUserFindOne = User.findOne;
    const originalUserCreate = User.create;
    const originalSubscriptionFind = Subscription.find;
    const originalSubscriptionCreate = Subscription.create;
    const originalFetch = globalThis.fetch;
    let writes = 0;
    let profileCalls = 0;
    let selectedUserFields;
    let selectedSubscriptionFields;
    let sort;

    User.findOne = (query) => {
        assert.deepEqual(query, {
            identityProvider: 'clerk',
            providerSubject: 'user_subject',
        });
        return {
            select(fields) {
                selectedUserFields = fields;
                return this;
            },
            lean() {
                return this;
            },
            exec: async () => ({ _id: ownerId }),
        };
    };
    Subscription.find = (query) => {
        assert.deepEqual(query, { user: ownerId });
        return {
            select(fields) {
                selectedSubscriptionFields = fields;
                return this;
            },
            sort(value) {
                sort = value;
                return this;
            },
            lean() {
                return this;
            },
            exec: async () => [],
        };
    };
    User.create = async () => {
        writes += 1;
    };
    Subscription.create = async () => {
        writes += 1;
    };
    globalThis.fetch = async () => {
        profileCalls += 1;
    };

    try {
        const service = createOwnedSubscriptionService();
        assert.deepEqual(await service.listOwnedSubscriptions(identity, ownerId), []);
        assert.equal(selectedUserFields, '_id');
        assert.equal(selectedSubscriptionFields, OWNED_SUBSCRIPTION_FIELDS.join(' '));
        assert.deepEqual(sort, { createdAt: -1, _id: -1 });
        assert.equal(writes, 0);
        assert.equal(profileCalls, 0);
    } finally {
        User.findOne = originalUserFindOne;
        User.create = originalUserCreate;
        Subscription.find = originalSubscriptionFind;
        Subscription.create = originalSubscriptionCreate;
        globalThis.fetch = originalFetch;
    }
});

test('nullable legacy renewalDate is preserved without inventing a date', () => {
    assert.equal(serializeOwnedSubscription({
        ...baseSubscription,
        renewalDate: null,
    }).renewalDate, null);
    assert.equal(serializeOwnedSubscription({
        ...baseSubscription,
        renewalDate: undefined,
    }).renewalDate, null);
});

test('every contracted enum, date, ID, and required field boundary is validated', () => {
    const invalidOverrides = [
        { _id: 'bad-id' },
        { user: { _id: ownerId, password: 'leak' } },
        { name: '' },
        { name: 'x'.repeat(101) },
        { price: -1 },
        { price: Number.NaN },
        { currency: 'EUR' },
        { frequency: 'fortnightly' },
        { category: 'software' },
        { paymentMethod: '' },
        { paymentMethod: '   ' },
        { paymentMethod: 123 },
        { status: 'paused' },
        { startDate: '2026-01-01T00:00:00.000Z' },
        { renewalDate: new Date('invalid') },
        { createdAt: new Date('invalid') },
        { updatedAt: null },
    ];

    for (const override of invalidOverrides) {
        assert.throws(
            () => serializeOwnedSubscription({ ...baseSubscription, ...override }),
            (error) => error.statusCode === 500 && error.code === 'DATA_INTEGRITY_ERROR',
        );
    }

    for (const currency of ['USD', 'GBP', 'ZAR']) {
        assert.equal(serializeOwnedSubscription({ ...baseSubscription, currency }).currency, currency);
    }
    for (const frequency of ['daily', 'weekly', 'monthly', 'yearly']) {
        assert.equal(
            serializeOwnedSubscription({ ...baseSubscription, frequency }).frequency,
            frequency,
        );
    }
    for (const category of [
        'sports', 'news', 'entertainment', 'education', 'health', 'others',
    ]) {
        assert.equal(
            serializeOwnedSubscription({ ...baseSubscription, category }).category,
            category,
        );
    }
    for (const status of ['active', 'cancelled', 'expired']) {
        assert.equal(serializeOwnedSubscription({ ...baseSubscription, status }).status, status);
    }
});

test('one invalid record fails the whole list without a partial response', async () => {
    const service = createOwnedSubscriptionService({
        associationLookup: async () => ({ _id: ownerId }),
        subscriptionLookup: async () => [
            baseSubscription,
            { ...baseSubscription, _id: '665f00000000000000000099', currency: 'EUR' },
        ],
    });
    const { server, url } = await startServer({ verify: async () => identity, service });

    try {
        await expectEnvelope(
            await request(url),
            500,
            'DATA_INTEGRITY_ERROR',
            'Subscription data could not be represented',
        );
    } finally {
        server.close();
    }
});
