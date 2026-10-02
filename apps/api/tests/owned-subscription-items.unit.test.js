import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import { createOwnedSubscriptionController } from '../src/controllers/subscription.controller.js';
import { createClerkAuthorize } from '../src/middlewares/clerk-auth.middleware.js';
import errorMiddleware from '../src/middlewares/error.middleware.js';
import { createSubscriptionRouter } from '../src/routes/subscription.routes.js';
import { IdentityApiError } from '../src/services/clerk-profile.js';
import { createOwnedSubscriptionService } from '../src/services/owned-subscription-service.js';

const ownerId = '665f00000000000000000001';
const subscriptionId = '665f00000000000000000010';
const identity = { provider: 'clerk', subject: 'user_subject' };
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
    renewalDate: new Date('2026-02-01T00:00:00.000Z'),
    user: ownerId,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const cloneDocument = (overrides = {}) => {
    const document = {
        ...baseSubscription,
        ...overrides,
        async save() {
            this.updatedAt = new Date('2026-01-03T00:00:00.000Z');
            return this;
        },
    };
    return document;
};

const startServer = async ({ service, verify = async () => identity }) => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/subscriptions', createSubscriptionRouter({
        itemAuthorize: createClerkAuthorize(verify),
        itemController: createOwnedSubscriptionController(service),
    }));
    app.use(errorMiddleware);

    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    return {
        server,
        url: `http://127.0.0.1:${server.address().port}/api/v1/subscriptions`,
    };
};

const expectError = async (response, status, code, message) => {
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), {
        success: false,
        code,
        message,
    });
};

test('item authentication precedes association and resource access', async () => {
    let reads = 0;
    const service = createOwnedSubscriptionService({
        associationLookup: async () => {
            reads += 1;
            return { _id: ownerId };
        },
        itemLookup: async () => {
            reads += 1;
            return baseSubscription;
        },
    });
    const verify = async () => {
        throw new IdentityApiError(401, 'AUTH_INVALID', 'The authentication credential is invalid');
    };
    const { server, url } = await startServer({ service, verify });

    try {
        await expectError(
            await fetch(`${url}/${subscriptionId}`, {
                headers: { authorization: 'Bearer legacy.jwt.token' },
            }),
            401,
            'AUTH_INVALID',
            'The authentication credential is invalid',
        );
        assert.equal(reads, 0);
    } finally {
        server.close();
    }
});

test('detail resolves the API owner and returns only the allowlisted DTO', async () => {
    let lookup;
    const service = createOwnedSubscriptionService({
        associationLookup: async (received) => {
            assert.deepEqual(received, identity);
            return { _id: ownerId };
        },
        itemLookup: async (id, user) => {
            lookup = { id, user };
            return {
                ...baseSubscription,
                workflowRunId: 'private',
                __v: 3,
            };
        },
    });
    const { server, url } = await startServer({ service });

    try {
        const response = await fetch(`${url}/${subscriptionId.toUpperCase()}`, {
            headers: { authorization: 'Bearer clerk-session' },
        });
        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.deepEqual(lookup, { id: subscriptionId, user: ownerId });
        assert.deepEqual(Object.keys(payload.data), [
            '_id',
            'name',
            'price',
            'currency',
            'frequency',
            'category',
            'paymentMethod',
            'status',
            'startDate',
            'renewalDate',
            'user',
            'createdAt',
            'updatedAt',
        ]);
        assert.equal(JSON.stringify(payload).includes('workflowRunId'), false);
        assert.equal(JSON.stringify(payload).includes('__v'), false);
    } finally {
        server.close();
    }
});

test('malformed, missing, and cross-owner item IDs are indistinguishable', async () => {
    const queries = [];
    const service = createOwnedSubscriptionService({
        associationLookup: async () => ({ _id: ownerId }),
        itemLookup: async (id, user) => {
            queries.push({ id, user });
            return null;
        },
    });
    const { server, url } = await startServer({ service });

    try {
        for (const id of ['not-an-object-id', subscriptionId]) {
            await expectError(
                await fetch(`${url}/${id}`, {
                    headers: { authorization: 'Bearer clerk-session' },
                }),
                404,
                'SUBSCRIPTION_NOT_FOUND',
                'The subscription was not found',
            );
        }
        assert.deepEqual(queries, [{ id: subscriptionId, user: ownerId }]);
    } finally {
        server.close();
    }
});

test('update rejects server-controlled fields and saves only allowlisted values', async () => {
    const document = cloneDocument();
    let lookup;
    const service = createOwnedSubscriptionService({
        associationLookup: async () => ({ _id: ownerId }),
        itemDocumentLookup: async (id, user) => {
            lookup = { id, user };
            return document;
        },
    });
    const { server, url } = await startServer({ service });

    try {
        for (const body of [
            {},
            { user: '665f00000000000000000002' },
            { workflowRunId: 'injected' },
            { status: 'cancelled' },
            { createdAt: '2026-01-01T00:00:00.000Z' },
        ]) {
            await expectError(
                await fetch(`${url}/${subscriptionId}`, {
                    method: 'PUT',
                    headers: {
                        authorization: 'Bearer clerk-session',
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify(body),
                }),
                400,
                'REQUEST_INVALID',
                'The subscription update is invalid',
            );
        }

        const response = await fetch(`${url}/${subscriptionId}`, {
            method: 'PUT',
            headers: {
                authorization: 'Bearer clerk-session',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                name: ' Updated Plan ',
                price: 0,
                renewalDate: '2026-03-01T00:00:00.000Z',
            }),
        });
        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.deepEqual(lookup, { id: subscriptionId, user: ownerId });
        assert.equal(document.name, 'Updated Plan');
        assert.equal(document.price, 0);
        assert.equal(document.renewalDate.toISOString(), '2026-03-01T00:00:00.000Z');
        assert.equal(payload.data.name, 'Updated Plan');
        assert.equal(payload.data.workflowRunId, undefined);
    } finally {
        server.close();
    }
});

test('cancel requires an empty body, is idempotent, and returns the DTO', async () => {
    const document = cloneDocument({ workflowRunId: 'wfr_cancel-me' });
    let saves = 0;
    const cancellations = [];
    document.save = async function save() {
        saves += 1;
        this.updatedAt = new Date('2026-01-03T00:00:00.000Z');
        return this;
    };
    const service = createOwnedSubscriptionService({
        associationLookup: async () => ({ _id: ownerId }),
        itemDocumentLookup: async (id, user) => {
            assert.deepEqual({ id, user }, { id: subscriptionId, user: ownerId });
            return document;
        },
        workflowCancellation: async (request) => {
            assert.equal(document.status, 'cancelled');
            cancellations.push(request);
        },
    });
    const { server, url } = await startServer({ service });

    try {
        await expectError(
            await fetch(`${url}/${subscriptionId}/cancel`, {
                method: 'PUT',
                headers: {
                    authorization: 'Bearer clerk-session',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({ status: 'cancelled' }),
            }),
            400,
            'REQUEST_INVALID',
            'The request body must be an empty JSON object',
        );

        for (let request = 0; request < 2; request += 1) {
            const response = await fetch(`${url}/${subscriptionId}/cancel`, {
                method: 'PUT',
                headers: { authorization: 'Bearer clerk-session' },
            });
            assert.equal(response.status, 200);
            assert.equal((await response.json()).data.status, 'cancelled');
        }
        assert.equal(saves, 1);
        assert.deepEqual(cancellations, [
            { ids: 'wfr_cancel-me' },
            { ids: 'wfr_cancel-me' },
        ]);
    } finally {
        server.close();
    }
});

test('delete uses a compound owner predicate and returns 204 without a body', async () => {
    let deletedBy;
    let deleted = false;
    const cancellations = [];
    const service = createOwnedSubscriptionService({
        associationLookup: async () => ({ _id: ownerId }),
        itemDelete: async (id, user) => {
            deletedBy = { id, user };
            deleted = true;
            return { _id: id, workflowRunId: 'wfr_delete-me' };
        },
        workflowCancellation: async (request) => {
            assert.equal(deleted, true);
            cancellations.push(request);
        },
    });
    const { server, url } = await startServer({ service });

    try {
        const response = await fetch(`${url}/${subscriptionId}`, {
            method: 'DELETE',
            headers: { authorization: 'Bearer clerk-session' },
        });
        assert.equal(response.status, 204);
        assert.equal(await response.text(), '');
        assert.deepEqual(deletedBy, { id: subscriptionId, user: ownerId });
        assert.deepEqual(cancellations, [{ ids: 'wfr_delete-me' }]);
    } finally {
        server.close();
    }
});

test('a workflow cancellation failure does not reopen a cancelled subscription', async () => {
    const document = cloneDocument({ workflowRunId: 'wfr_unavailable' });
    const errors = [];
    const service = createOwnedSubscriptionService({
        associationLookup: async () => ({ _id: ownerId }),
        itemDocumentLookup: async () => document,
        workflowCancellation: async () => {
            throw new Error('QStash unavailable');
        },
        workflowCancellationError: (...args) => errors.push(args),
    });

    const result = await service.cancelOwnedSubscription(identity, subscriptionId);

    assert.equal(result.status, 'cancelled');
    assert.equal(document.status, 'cancelled');
    assert.equal(errors.length, 1);
});
