import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

import { createMongoAcceptanceConfig } from '../src/config/integration-acceptance.js';
import Subscription from '../src/models/subscription.model.js';
import User from '../src/models/user.model.js';
import { createIdentityService } from '../src/services/identity-service.js';
import { createOwnedSubscriptionService } from '../src/services/owned-subscription-service.js';

const config = createMongoAcceptanceConfig();
const tag = config.runId.toLowerCase();
const email = (name) => `${name}.${tag}@acceptance.invalid`;
const subject = (name) => `int01a_${tag}_${name}`;
const trackedUserIds = new Set();
const trackedSubscriptionIds = new Set();

const expectCode = async (promise, code) => {
    await assert.rejects(promise, (error) => {
        assert.equal(error.code, code);
        return true;
    });
};

const trackUser = (user) => {
    trackedUserIds.add(String(user._id));
    return user;
};

const createLegacyUser = async (name, address, password = 'legacy-password-sentinel') => (
    trackUser(await User.create({ name, email: address, password }))
);

const createService = (name, address) => createIdentityService({
    profileLookup: async () => ({ name, email: address }),
});

const listIndexes = async (collection) => collection.listIndexes().toArray();

const ensureIndexes = async () => {
    await User.createCollection();
    await Subscription.createCollection();
    await User.collection.createIndex({ email: 1 }, { name: 'email_1', unique: true });
    await User.collection.createIndex(
        { identityProvider: 1, providerSubject: 1 },
        {
            name: 'unique_provider_subject',
            unique: true,
            partialFilterExpression: {
                identityProvider: { $type: 'string' },
                providerSubject: { $type: 'string' },
            },
        },
    );
    await Subscription.collection.createIndex({ user: 1 }, { name: 'user_1' });

    const userIndexes = await listIndexes(User.collection);
    const subscriptionIndexes = await listIndexes(Subscription.collection);
    const emailIndex = userIndexes.find((index) => index.name === 'email_1');
    const associationIndex = userIndexes.find(
        (index) => index.name === 'unique_provider_subject',
    );
    const ownerIndex = subscriptionIndexes.find((index) => index.name === 'user_1');

    assert.deepEqual(emailIndex.key, { email: 1 });
    assert.equal(emailIndex.unique, true);
    assert.deepEqual(associationIndex.key, {
        identityProvider: 1,
        providerSubject: 1,
    });
    assert.equal(associationIndex.unique, true);
    assert.deepEqual(associationIndex.partialFilterExpression, {
        identityProvider: { $type: 'string' },
        providerSubject: { $type: 'string' },
    });
    assert.deepEqual(ownerIndex.key, { user: 1 });
};

test('INT-01A MongoDB persistence acceptance', async (t) => {
    await mongoose.connect(config.uri, {
        autoIndex: false,
        serverSelectionTimeoutMS: 10000,
    });

    try {
        assert.equal(mongoose.connection.name, config.databaseName);
        const topologyType = mongoose.connection.client?.topology?.description?.type;
        assert.ok(
            topologyType === 'ReplicaSetWithPrimary' || topologyType === 'Sharded',
            `A transaction-capable disposable topology is required; received ${topologyType}`,
        );

        await t.test('creates and inspects required indexes without synchronization', ensureIndexes);

        await t.test('preserves multiple legacy users and enforces unique email', async () => {
            const first = await createLegacyUser('Legacy One', email('legacy-one'));
            const second = await createLegacyUser('Legacy Two', email('legacy-two'));
            assert.equal(first.identityProvider, undefined);
            assert.equal(second.providerSubject, undefined);

            await assert.rejects(
                User.create({
                    name: 'Duplicate Email',
                    email: first.email,
                    password: 'another-password',
                }),
                (error) => error?.code === 11000,
            );
            assert.equal(await User.countDocuments({ email: first.email }), 1);
        });

        await t.test('rejects duplicate provider subjects even when emails differ', async () => {
            const providerSubject = subject('duplicate-provider');
            trackUser(await User.create({
                name: 'Provider One',
                email: email('provider-one'),
                identityProvider: 'clerk',
                providerSubject,
            }));

            await assert.rejects(
                User.create({
                    name: 'Provider Two',
                    email: email('provider-two'),
                    identityProvider: 'clerk',
                    providerSubject,
                }),
                (error) => error?.code === 11000,
            );
            assert.equal(await User.countDocuments({
                identityProvider: 'clerk',
                providerSubject,
            }), 1);
        });

        let primaryIdentity;
        let primaryUser;
        await t.test('first and repeated provisioning are passwordless and idempotent', async () => {
            primaryIdentity = { provider: 'clerk', subject: subject('primary') };
            let profileCalls = 0;
            const service = createIdentityService({
                profileLookup: async () => {
                    profileCalls += 1;
                    return { name: 'Primary User', email: email('primary') };
                },
            });

            const first = await service.provisionIdentity(primaryIdentity);
            trackedUserIds.add(first.data.userId);
            const repeat = await service.provisionIdentity(primaryIdentity);
            primaryUser = await User.findById(first.data.userId).lean();

            assert.equal(first.created, true);
            assert.equal(repeat.created, false);
            assert.equal(repeat.data.userId, first.data.userId);
            assert.equal(profileCalls, 1);
            assert.equal(primaryUser.password, undefined);
            assert.equal(await User.countDocuments({
                identityProvider: 'clerk',
                providerSubject: primaryIdentity.subject,
            }), 1);
        });

        await t.test('overlapping first provisioning converges on one user', async () => {
            const identity = { provider: 'clerk', subject: subject('overlap') };
            const service = createService('Overlap User', email('overlap'));
            const results = await Promise.all([
                service.provisionIdentity(identity),
                service.provisionIdentity(identity),
            ]);
            const stored = await User.find({
                identityProvider: 'clerk',
                providerSubject: identity.subject,
            }).lean();
            stored.forEach(trackUser);

            assert.equal(stored.length, 1);
            assert.equal(new Set(results.map((result) => result.data.userId)).size, 1);
            assert.equal(results.filter((result) => result.created).length, 1);
        });

        await t.test('same-email conflicts preserve existing users and passwords', async () => {
            const legacyPassword = 'legacy-password-sentinel';
            const legacy = await createLegacyUser(
                'Legacy Guard',
                email('legacy-guard'),
                legacyPassword,
            );
            await expectCode(
                createService('New Identity', legacy.email).provisionIdentity({
                    provider: 'clerk',
                    subject: subject('legacy-conflict'),
                }),
                'LEGACY_EMAIL_CONFLICT',
            );
            const preserved = await User.findById(legacy._id).lean();
            assert.equal(preserved.password, legacyPassword);
            assert.equal(preserved.identityProvider, undefined);

            const sharedEmail = email('shared');
            const firstIdentity = { provider: 'clerk', subject: subject('shared-first') };
            const first = await createService('Shared First', sharedEmail)
                .provisionIdentity(firstIdentity);
            trackedUserIds.add(first.data.userId);
            await expectCode(
                createService('Shared Second', sharedEmail).provisionIdentity({
                    provider: 'clerk',
                    subject: subject('shared-second'),
                }),
                'IDENTITY_CONFLICT',
            );
            assert.equal(await User.countDocuments({ email: sharedEmail }), 1);
        });

        await t.test('transaction failure does not fall back to an independent create', async () => {
            const originalTransaction = mongoose.connection.transaction;
            mongoose.connection.transaction = async () => {
                throw new Error('controlled transaction failure');
            };
            const failedEmail = email('transaction-failure');
            const failedIdentity = {
                provider: 'clerk',
                subject: subject('transaction-failure'),
            };

            try {
                await expectCode(
                    createService('Failed Transaction', failedEmail)
                        .provisionIdentity(failedIdentity),
                    'PROVISIONING_FAILED',
                );
            } finally {
                mongoose.connection.transaction = originalTransaction;
            }

            assert.equal(await User.countDocuments({
                $or: [
                    { email: failedEmail },
                    {
                        identityProvider: 'clerk',
                        providerSubject: failedIdentity.subject,
                    },
                ],
            }), 0);
        });

        await t.test('identity reads make no writes or profile calls', async () => {
            let profileCalls = 0;
            const before = await User.findById(primaryUser._id).lean();
            const service = createIdentityService({
                profileLookup: async () => {
                    profileCalls += 1;
                    throw new Error('profile lookup must not run');
                },
            });
            const resolved = await service.resolveIdentity(primaryIdentity);
            const after = await User.findById(primaryUser._id).lean();

            assert.equal(resolved.userId, String(primaryUser._id));
            assert.equal(profileCalls, 0);
            assert.deepEqual(after, before);
        });

        await t.test('owned reads enforce ownership, ordering, DTO shape, and whole-list failure', async () => {
            const olderId = new mongoose.Types.ObjectId();
            const newerId = new mongoose.Types.ObjectId();
            const invalidId = new mongoose.Types.ObjectId();
            const now = Date.now();
            const base = {
                name: 'Acceptance Plan',
                price: 12.5,
                currency: 'USD',
                frequency: 'monthly',
                category: 'entertainment',
                paymentMethod: 'card',
                status: 'active',
                startDate: new Date(now - 86400000),
                renewalDate: new Date(now + 86400000),
                user: primaryUser._id,
                updatedAt: new Date(now),
            };
            await Subscription.collection.insertMany([
                {
                    ...base,
                    _id: olderId,
                    createdAt: new Date(now - 2000),
                    workflowRunId: 'must-not-leak',
                },
                {
                    ...base,
                    _id: newerId,
                    name: 'Newest Plan',
                    createdAt: new Date(now - 1000),
                },
            ]);
            trackedSubscriptionIds.add(String(olderId));
            trackedSubscriptionIds.add(String(newerId));

            const service = createOwnedSubscriptionService();
            const listed = await service.listOwnedSubscriptions(
                primaryIdentity,
                String(primaryUser._id),
            );
            assert.deepEqual(listed.map((item) => item._id), [
                String(newerId),
                String(olderId),
            ]);
            assert.deepEqual(Object.keys(listed[0]), [
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
            assert.equal(JSON.stringify(listed).includes('workflowRunId'), false);

            const otherIdentity = { provider: 'clerk', subject: subject('owner-check') };
            const other = await createService('Other Owner', email('owner-check'))
                .provisionIdentity(otherIdentity);
            trackedUserIds.add(other.data.userId);
            await expectCode(
                service.listOwnedSubscriptions(otherIdentity, String(primaryUser._id)),
                'NOT_OWNER',
            );

            await Subscription.collection.insertOne({
                ...base,
                _id: invalidId,
                currency: 'EUR',
                createdAt: new Date(now),
            });
            trackedSubscriptionIds.add(String(invalidId));
            await expectCode(
                service.listOwnedSubscriptions(primaryIdentity, String(primaryUser._id)),
                'DATA_INTEGRITY_ERROR',
            );
        });
    } finally {
        if (mongoose.connection.readyState === 1) {
            const subscriptionIds = [...trackedSubscriptionIds]
                .map((id) => new mongoose.Types.ObjectId(id));
            const userIds = [...trackedUserIds].map((id) => new mongoose.Types.ObjectId(id));
            if (subscriptionIds.length) {
                await Subscription.collection.deleteMany({ _id: { $in: subscriptionIds } });
            }
            if (userIds.length) {
                await User.collection.deleteMany({ _id: { $in: userIds } });
            }
        }
        await mongoose.disconnect();
    }
});
