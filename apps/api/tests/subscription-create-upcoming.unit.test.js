import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import {
    createCreateSubscription,
    createGetUpcomingRenewals,
} from '../src/controllers/subscription.controller.js';
import { createClerkAuthorize } from '../src/middlewares/clerk-auth.middleware.js';
import errorMiddleware from '../src/middlewares/error.middleware.js';
import Subscription from '../src/models/subscription.model.js';
import { createSubscriptionRouter } from '../src/routes/subscription.routes.js';
import {
    createOwnedSubscriptionService,
    OWNED_SUBSCRIPTION_FIELDS,
    SUBSCRIPTION_MUTATION_IDEMPOTENCY,
} from '../src/services/owned-subscription-service.js';

const ownerId = '665f00000000000000000001';
const subscriptionId = '665f00000000000000000010';
const identity = { provider: 'clerk', subject: 'user_subject' };
const now = new Date('2026-10-02T00:00:00.000Z');
const baseSubscription = {
    _id: subscriptionId,
    name: 'Example Plus',
    price: 12.5,
    currency: 'USD',
    frequency: 'monthly',
    category: 'entertainment',
    paymentMethod: 'card',
    status: 'active',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    renewalDate: new Date('2026-11-01T00:00:00.000Z'),
    user: ownerId,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
};
const createBody = {
    name: ' Example Plus ',
    price: 12.5,
    currency: 'USD',
    frequency: 'monthly',
    category: 'entertainment',
    paymentMethod: ' card ',
    startDate: '2026-01-01T00:00:00.000Z',
};

const startServer = async ({ service, verify = async () => identity }) => {
    const authorize = createClerkAuthorize(verify);
    const app = express();
    app.use(express.json());
    app.use('/api/v1/subscriptions', createSubscriptionRouter({
        createAuthorize: authorize,
        createHandler: createCreateSubscription(service),
        upcomingRenewalsAuthorize: authorize,
        upcomingRenewalsHandler: createGetUpcomingRenewals(service),
    }));
    app.use(errorMiddleware);

    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    return {
        server,
        url: `http://127.0.0.1:${server.address().port}/api/v1/subscriptions`,
    };
};

test('create derives its owner from Clerk and returns the strict DTO', async () => {
    let created;
    let scheduled;
    let tracked;
    const service = createOwnedSubscriptionService({
        associationLookup: async (receivedIdentity) => {
            assert.deepEqual(receivedIdentity, identity);
            return { _id: ownerId };
        },
        subscriptionCreate: async (attributes) => {
            created = attributes;
            return {
                ...baseSubscription,
                ...attributes,
                renewalDate: baseSubscription.renewalDate,
            };
        },
        reminderScheduling: async (request) => {
            scheduled = request;
            return { workflowRunId: 'wfr_create' };
        },
        reminderTracking: async (...args) => {
            tracked = args;
        },
    });
    const { server, url } = await startServer({ service });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                authorization: 'Bearer clerk-session',
                'content-type': 'application/json',
            },
            body: JSON.stringify(createBody),
        });
        assert.equal(response.status, 201);
        const payload = await response.json();
        assert.equal(created.user, ownerId);
        assert.equal(created.name, 'Example Plus');
        assert.equal(created.paymentMethod, 'card');
        assert.ok(created.startDate instanceof Date);
        assert.deepEqual(scheduled, { subscriptionId });
        assert.deepEqual(tracked, [subscriptionId, 'wfr_create']);
        assert.deepEqual(Object.keys(payload.data), OWNED_SUBSCRIPTION_FIELDS);
        assert.equal(JSON.stringify(payload).includes('workflowRunId'), false);
    } finally {
        server.close();
    }
});

test('create rejects server-controlled fields and legacy credentials before writes', async () => {
    let writes = 0;
    const service = createOwnedSubscriptionService({
        associationLookup: async () => ({ _id: ownerId }),
        subscriptionCreate: async () => {
            writes += 1;
        },
    });
    const verify = async (authorization) => {
        if (authorization === 'Bearer clerk-session') return identity;
        const error = new Error('The authentication credential is invalid');
        error.statusCode = 401;
        error.code = 'AUTH_INVALID';
        throw error;
    };
    const { server, url } = await startServer({ service, verify });

    try {
        const invalidBody = await fetch(url, {
            method: 'POST',
            headers: {
                authorization: 'Bearer clerk-session',
                'content-type': 'application/json',
            },
            body: JSON.stringify({ ...createBody, user: ownerId }),
        });
        assert.equal(invalidBody.status, 400);
        assert.equal((await invalidBody.json()).code, 'REQUEST_INVALID');

        const legacy = await fetch(url, {
            method: 'POST',
            headers: {
                authorization: 'Bearer legacy.jwt.token',
                'content-type': 'application/json',
            },
            body: JSON.stringify(createBody),
        });
        assert.equal(legacy.status, 401);
        assert.equal((await legacy.json()).code, 'AUTH_INVALID');
        assert.equal(writes, 0);
    } finally {
        server.close();
    }
});

test('create maps reminder scheduling failures to the generic write envelope', async () => {
    const rolledBack = [];
    const service = createOwnedSubscriptionService({
        subscriptionRollback: async (id) => rolledBack.push(id),
        associationLookup: async () => ({ _id: ownerId }),
        subscriptionCreate: async (attributes) => ({
            ...baseSubscription,
            ...attributes,
            renewalDate: baseSubscription.renewalDate,
        }),
        reminderScheduling: async () => {
            throw new Error('private scheduler transport details');
        },
    });
    const { server, url } = await startServer({ service });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                authorization: 'Bearer clerk-session',
                'content-type': 'application/json',
            },
            body: JSON.stringify(createBody),
        });
        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), {
            success: false,
            code: 'SUBSCRIPTION_WRITE_FAILED',
            message: 'The subscription could not be changed',
        });
        assert.deepEqual(rolledBack, [subscriptionId]);
    } finally {
        server.close();
    }
});

test('create rolls back the subscription and cancels the workflow when tracking fails', async () => {
    const rolledBack = [];
    const cancelled = [];
    const service = createOwnedSubscriptionService({
        associationLookup: async () => ({ _id: ownerId }),
        subscriptionCreate: async (attributes) => ({
            ...baseSubscription,
            ...attributes,
            renewalDate: baseSubscription.renewalDate,
        }),
        reminderScheduling: async () => ({ workflowRunId: 'wfr_orphan' }),
        reminderTracking: async () => {
            throw new Error('tracking failed');
        },
        subscriptionRollback: async (id) => rolledBack.push(id),
        workflowCancellation: async (request) => cancelled.push(request),
    });

    await assert.rejects(
        service.createOwnedSubscription(identity, createBody),
        { code: 'SUBSCRIPTION_WRITE_FAILED' },
    );
    assert.deepEqual(rolledBack, [subscriptionId]);
    assert.deepEqual(cancelled, [{ ids: 'wfr_orphan' }]);
});

test('upcoming renewals infer the owner and sort active future DTOs', async () => {
    const earlierId = '665f00000000000000000011';
    const laterId = '665f00000000000000000012';
    let lookup;
    const service = createOwnedSubscriptionService({
        associationLookup: async () => ({ _id: ownerId }),
        upcomingRenewalsLookup: async (user, currentTime) => {
            lookup = { user, currentTime };
            return [
                {
                    ...baseSubscription,
                    _id: laterId,
                    renewalDate: new Date('2026-12-01T00:00:00.000Z'),
                },
                {
                    ...baseSubscription,
                    _id: earlierId,
                    renewalDate: new Date('2026-11-01T00:00:00.000Z'),
                },
            ];
        },
        now: () => now,
    });
    const { server, url } = await startServer({ service });

    try {
        const response = await fetch(`${url}/upcoming-renewals`, {
            headers: { authorization: 'Bearer clerk-session' },
        });
        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.deepEqual(lookup, { user: ownerId, currentTime: now });
        assert.deepEqual(payload.data.map(({ _id }) => _id), [earlierId, laterId]);
        assert.ok(payload.data.every(({ status }) => status === 'active'));
        assert.equal(JSON.stringify(payload).includes('workflowRunId'), false);
    } finally {
        server.close();
    }
});

test('production upcoming lookup is owner-scoped, active, future, and deterministic', async () => {
    const originalFind = Subscription.find;
    let query;
    let selected;
    let sort;
    Subscription.find = (value) => {
        query = value;
        return {
            select(fields) {
                selected = fields;
                return this;
            },
            sort(valueToSort) {
                sort = valueToSort;
                return this;
            },
            lean() {
                return this;
            },
            exec: async () => [],
        };
    };

    try {
        const service = createOwnedSubscriptionService({
            associationLookup: async () => ({ _id: ownerId }),
            now: () => now,
        });
        assert.deepEqual(await service.listUpcomingRenewals(identity), []);
        assert.deepEqual(query, {
            user: ownerId,
            status: 'active',
            renewalDate: { $gt: now },
        });
        assert.equal(selected, OWNED_SUBSCRIPTION_FIELDS.join(' '));
        assert.deepEqual(sort, { renewalDate: 1, _id: 1 });
    } finally {
        Subscription.find = originalFind;
    }
});

test('only cancel is idempotent; create, update, and delete are not auto-retryable', () => {
    assert.deepEqual(SUBSCRIPTION_MUTATION_IDEMPOTENCY, {
        create: false,
        update: false,
        cancel: true,
        delete: false,
    });
});
