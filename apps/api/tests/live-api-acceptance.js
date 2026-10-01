import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';

import { createClerkVerifierConfig } from '../src/config/clerk.js';
import { createLiveAcceptanceConfig } from '../src/config/integration-acceptance.js';
import { createProvisioningConfig } from '../src/config/provisioning.js';
import errorMiddleware from '../src/middlewares/error.middleware.js';
import Subscription from '../src/models/subscription.model.js';
import User from '../src/models/user.model.js';
import { createIdentityRouter } from '../src/routes/identity.routes.js';
import { createSubscriptionRouter } from '../src/routes/subscription.routes.js';
import { createClerkVerifier } from '../src/services/clerk-verifier.js';

const config = createLiveAcceptanceConfig();
const provisioning = createProvisioningConfig();
if (!provisioning.enabled || provisioning.resourceId !== config.mongo.resourceId) {
    throw new Error('Live acceptance requires provisioning enabled for the approved resource');
}

const verifier = createClerkVerifier(createClerkVerifierConfig());
const [primaryIdentity, secondaryIdentity] = await Promise.all([
    verifier(`Bearer ${config.primaryToken}`),
    verifier(`Bearer ${config.secondaryToken}`),
]);
assert.notEqual(primaryIdentity.subject, secondaryIdentity.subject);

const createdUserIds = new Set();
const createdSubscriptionIds = new Set();
let server;

const request = async (baseUrl, path, {
    method = 'GET',
    token = config.primaryToken,
    body,
} = {}) => {
    const headers = {};
    if (token !== null) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json();
    const serialized = JSON.stringify(payload);
    assert.equal(serialized.includes(config.primaryToken), false);
    assert.equal(serialized.includes(config.secondaryToken), false);
    assert.equal(serialized.includes('workflowRunId'), false);
    assert.equal(serialized.includes('password'), false);
    return { response, payload };
};

const expectError = ({ response, payload }, status, code) => {
    assert.equal(response.status, status);
    assert.equal(payload.success, false);
    assert.equal(payload.code, code);
};

await mongoose.connect(config.mongo.uri, {
    autoIndex: false,
    serverSelectionTimeoutMS: 10000,
});

try {
    assert.equal(mongoose.connection.name, config.mongo.databaseName);
    const topologyType = mongoose.connection.client?.topology?.description?.type;
    assert.ok(topologyType === 'ReplicaSetWithPrimary' || topologyType === 'Sharded');

    const app = express();
    app.use(express.json());
    app.use('/api/v1/identity', createIdentityRouter());
    app.use('/api/v1/subscriptions', createSubscriptionRouter());
    app.use(errorMiddleware);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    for (const token of [config.primaryToken, config.secondaryToken]) {
        const unprovisioned = await request(baseUrl, '/api/v1/identity', { token });
        assert.equal(unprovisioned.response.status, 200);
        assert.equal(unprovisioned.payload.data.userId, null);
        assert.equal(unprovisioned.payload.data.provisioned, false);
    }

    const first = await request(baseUrl, '/api/v1/identity/provision', {
        method: 'POST',
        body: {},
    });
    assert.equal(first.response.status, 201);
    createdUserIds.add(first.payload.data.userId);

    const repeat = await request(baseUrl, '/api/v1/identity/provision', {
        method: 'POST',
        body: {},
    });
    assert.equal(repeat.response.status, 200);
    assert.equal(repeat.payload.data.userId, first.payload.data.userId);

    const resolved = await request(baseUrl, '/api/v1/identity');
    assert.equal(resolved.response.status, 200);
    assert.equal(resolved.payload.data.userId, first.payload.data.userId);
    assert.equal(resolved.payload.data.provisioned, true);

    const empty = await request(
        baseUrl,
        `/api/v1/subscriptions/user/${first.payload.data.userId}`,
    );
    assert.equal(empty.response.status, 200);
    assert.deepEqual(empty.payload, { success: true, data: [] });

    const secondary = await request(baseUrl, '/api/v1/identity/provision', {
        method: 'POST',
        token: config.secondaryToken,
        body: {},
    });
    assert.equal(secondary.response.status, 201);
    createdUserIds.add(secondary.payload.data.userId);

    const now = Date.now();
    const seeded = await Subscription.create([
        {
            name: 'Acceptance Older',
            price: 10,
            currency: 'USD',
            frequency: 'monthly',
            category: 'others',
            paymentMethod: 'test-card',
            status: 'active',
            startDate: new Date(now - 86400000),
            renewalDate: new Date(now + 86400000),
            user: first.payload.data.userId,
            createdAt: new Date(now - 2000),
            updatedAt: new Date(now - 2000),
        },
        {
            name: 'Acceptance Newer',
            price: 20,
            currency: 'ZAR',
            frequency: 'yearly',
            category: 'education',
            paymentMethod: 'test-bank',
            status: 'active',
            startDate: new Date(now - 86400000),
            renewalDate: new Date(now + 86400000),
            user: first.payload.data.userId,
            createdAt: new Date(now - 1000),
            updatedAt: new Date(now - 1000),
        },
    ]);
    seeded.forEach((subscription) => createdSubscriptionIds.add(String(subscription._id)));

    const populated = await request(
        baseUrl,
        `/api/v1/subscriptions/user/${first.payload.data.userId}`,
    );
    assert.equal(populated.response.status, 200);
    assert.deepEqual(populated.payload.data.map(({ name }) => name), [
        'Acceptance Newer',
        'Acceptance Older',
    ]);

    expectError(
        await request(
            baseUrl,
            `/api/v1/subscriptions/user/${first.payload.data.userId}`,
            { token: config.secondaryToken },
        ),
        403,
        'NOT_OWNER',
    );
    expectError(
        await request(
            baseUrl,
            `/api/v1/subscriptions/user/${first.payload.data.userId}`,
            { token: null },
        ),
        401,
        'AUTH_INVALID',
    );
    expectError(
        await request(
            baseUrl,
            `/api/v1/subscriptions/user/${first.payload.data.userId}`,
            { token: 'invalid.credential.value' },
        ),
        401,
        'AUTH_INVALID',
    );
    expectError(
        await request(
            baseUrl,
            `/api/v1/subscriptions/user/${first.payload.data.userId}`,
            { token: 'legacy.jwt.value' },
        ),
        401,
        'AUTH_INVALID',
    );
    expectError(
        await request(baseUrl, '/api/v1/subscriptions/user/not-an-object-id'),
        422,
        'INVALID_USER_ID',
    );
    expectError(
        await request(
            baseUrl,
            `/api/v1/subscriptions/user/${secondary.payload.data.userId}`,
        ),
        403,
        'NOT_OWNER',
    );

    console.log(JSON.stringify({
        success: true,
        databaseResourceId: config.mongo.resourceId,
        databaseName: config.mongo.databaseName,
        topology: topologyType,
        apiBaseUrl: baseUrl,
        identityCount: 2,
        seededSubscriptionCount: seeded.length,
    }));
} finally {
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState === 1) {
        const subscriptionIds = [...createdSubscriptionIds]
            .map((id) => new mongoose.Types.ObjectId(id));
        const userIds = [...createdUserIds].map((id) => new mongoose.Types.ObjectId(id));
        if (subscriptionIds.length) {
            await Subscription.collection.deleteMany({ _id: { $in: subscriptionIds } });
        }
        if (userIds.length) {
            await User.collection.deleteMany({ _id: { $in: userIds } });
        }
    }
    await mongoose.disconnect();
}
