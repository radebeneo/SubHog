import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import {
    createLiveAcceptanceConfig,
    createMongoAcceptanceConfig,
} from '../src/config/integration-acceptance.js';
import { createProvisioningConfig } from '../src/config/provisioning.js';
import { createIdentityRouter } from '../src/routes/identity.routes.js';

const mongoSource = {
    INTEGRATION_MONGODB_URI: 'mongodb://localhost:27017/int01a_acceptance?replicaSet=rs0',
    INTEGRATION_DB_RESOURCE_ID: 'disposable-rs-01',
    INTEGRATION_DB_NAME: 'int01a_acceptance',
    INTEGRATION_TEST_RUN_ID: 'run_20260929',
    INTEGRATION_DB_CONFIRMED: 'DISPOSABLE_DATABASE:disposable-rs-01:int01a_acceptance',
    INTEGRATION_CLEANUP_CONFIRMED:
        'CLEANUP_RUN:disposable-rs-01:int01a_acceptance:run_20260929',
};

test('provisioning is disabled by default', () => {
    assert.deepEqual(createProvisioningConfig({}), { enabled: false });
});

test('provisioning requires a resource-bound database confirmation', () => {
    const source = {
        IDENTITY_PROVISIONING_ENABLED: 'true',
        DB_RESOURCE_ID: 'disposable-rs-01',
        IDENTITY_PROVISIONING_RESOURCE_ID: 'disposable-rs-01',
        IDENTITY_PROVISIONING_RESOURCE_CONFIRMATION:
            'ENABLE_PROVISIONING:disposable-rs-01',
    };

    assert.deepEqual(createProvisioningConfig(source), {
        enabled: true,
        resourceId: 'disposable-rs-01',
    });
    assert.throws(
        () => createProvisioningConfig({
            ...source,
            IDENTITY_PROVISIONING_RESOURCE_ID: 'different-resource',
        }),
        /does not match/,
    );
    assert.throws(
        () => createProvisioningConfig({
            ...source,
            IDENTITY_PROVISIONING_RESOURCE_CONFIRMATION: 'true',
        }),
        /resource-bound confirmation/,
    );
});

test('disabled provisioning route is unavailable while identity reads remain registered', async () => {
    const app = express();
    let identityReads = 0;
    let provisioningWrites = 0;
    let identityDeletes = 0;
    app.use('/api/v1/identity', createIdentityRouter({
        authorize: (req, res, next) => {
            void req;
            void res;
            next();
        },
        controller: {
            getIdentity: (req, res) => {
                void req;
                identityReads += 1;
                res.status(200).json({ success: true });
            },
            provisionIdentity: (req, res) => {
                void req;
                provisioningWrites += 1;
                res.status(201).json({ success: true });
            },
            deleteIdentity: (req, res) => {
                void req;
                identityDeletes += 1;
                res.status(204).end();
            },
        },
        provisioningEnabled: false,
    }));

    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/identity`;

    try {
        assert.equal((await fetch(baseUrl)).status, 200);
        assert.equal((await fetch(`${baseUrl}/provision`, { method: 'POST' })).status, 404);
        assert.equal((await fetch(baseUrl, { method: 'DELETE' })).status, 204);
        assert.equal(identityReads, 1);
        assert.equal(provisioningWrites, 0);
        assert.equal(identityDeletes, 1);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

test('MongoDB acceptance config is integration-only and resource-bound', () => {
    assert.deepEqual(createMongoAcceptanceConfig(mongoSource), {
        uri: mongoSource.INTEGRATION_MONGODB_URI,
        resourceId: 'disposable-rs-01',
        databaseName: 'int01a_acceptance',
        runId: 'run_20260929',
    });

    assert.throws(() => createMongoAcceptanceConfig({
        ...mongoSource,
        DB_URI: mongoSource.INTEGRATION_MONGODB_URI,
    }), /cannot reuse DB_URI/);
    assert.throws(() => createMongoAcceptanceConfig({
        ...mongoSource,
        INTEGRATION_DB_CONFIRMED: 'true',
    }), /resource-bound disposable confirmation/);
    assert.throws(() => createMongoAcceptanceConfig({
        ...mongoSource,
        INTEGRATION_CLEANUP_CONFIRMED: 'true',
    }), /run-scoped cleanup confirmation/);
    assert.throws(() => createMongoAcceptanceConfig({
        ...mongoSource,
        INTEGRATION_MONGODB_URI: 'mongodb://localhost:27017/another_database',
    }), /must match INTEGRATION_DB_NAME/);
    assert.throws(() => createMongoAcceptanceConfig({
        ...mongoSource,
        INTEGRATION_DB_NAME: 'admin',
        INTEGRATION_MONGODB_URI: 'mongodb://localhost:27017/admin',
        INTEGRATION_DB_CONFIRMED: 'DISPOSABLE_DATABASE:disposable-rs-01:admin',
        INTEGRATION_CLEANUP_CONFIRMED:
            'CLEANUP_RUN:disposable-rs-01:admin:run_20260929',
    }), /non-system database name/);
});

test('live acceptance additionally requires tokens and explicit seed approval', () => {
    assert.throws(() => createLiveAcceptanceConfig(mongoSource), /subscription seed/);

    const config = createLiveAcceptanceConfig({
        ...mongoSource,
        INTEGRATION_CLERK_TOKEN_PRIMARY: 'primary-token',
        INTEGRATION_CLERK_TOKEN_SECONDARY: 'secondary-token',
        INTEGRATION_SEED_SUBSCRIPTIONS_CONFIRMED:
            'SEED_SUBSCRIPTIONS:disposable-rs-01:int01a_acceptance:run_20260929',
    });
    assert.equal(config.mongo.resourceId, 'disposable-rs-01');
});
