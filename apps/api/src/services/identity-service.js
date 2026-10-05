import mongoose from 'mongoose';

import { workflowClient } from '../config/upstash.js';
import IdentityDeletion from '../models/identity-deletion.model.js';
import Subscription from '../models/subscription.model.js';
import User from '../models/user.model.js';
import { IdentityApiError, getClerkProfile } from './clerk-profile.js';

const apiError = (statusCode, code, message) => new IdentityApiError(statusCode, code, message);

const identityFailed = () => apiError(
    500,
    'IDENTITY_RESOLUTION_FAILED',
    'Identity resolution failed',
);

const provisioningFailed = () => apiError(
    500,
    'PROVISIONING_FAILED',
    'Identity provisioning failed',
);

const accountDeleteFailed = () => apiError(
    500,
    'ACCOUNT_DELETE_FAILED',
    'The account could not be deleted',
);

const accountDeletionInProgress = () => apiError(
    409,
    'ACCOUNT_DELETION_IN_PROGRESS',
    'The account is being deleted',
);

const identityConflict = () => apiError(
    409,
    'IDENTITY_CONFLICT',
    'The provider identity conflicts with an existing user',
);

const legacyEmailConflict = () => apiError(
    409,
    'LEGACY_EMAIL_CONFLICT',
    'The email address belongs to an existing legacy user',
);

const userId = (user) => String(user._id);

export const serializeIdentity = (identity, user = null) => ({
    provider: identity.provider,
    clerkUserId: identity.subject,
    userId: user ? userId(user) : null,
    provisioned: Boolean(user),
});

export const serializeProvisionedIdentity = (identity, user) => ({
    provider: identity.provider,
    clerkUserId: identity.subject,
    userId: userId(user),
    email: user.email,
    name: user.name,
});

const supportsTransactions = () => {
    const topologyType = mongoose.connection.client?.topology?.description?.type;
    return topologyType === 'ReplicaSetWithPrimary' || topologyType === 'Sharded';
};

const createAssociatedUser = async (document, UserModel) => {
    if (!supportsTransactions()) {
        return UserModel.create(document);
    }

    let created;
    await mongoose.connection.transaction(async (session) => {
        [created] = await UserModel.create([document], { session });
    });
    return created;
};

const hasAssociation = (user) => Boolean(user?.identityProvider || user?.providerSubject);

const matchesIdentityAndEmail = (user, identity, email) => (
    user?.identityProvider === identity.provider
    && user?.providerSubject === identity.subject
    && user?.email === email
);

const classifyExistingEmail = (user) => {
    if (!hasAssociation(user)) {
        throw legacyEmailConflict();
    }

    throw identityConflict();
};

const findAssociation = (identity, UserModel) => UserModel.findOne({
    identityProvider: identity.provider,
    providerSubject: identity.subject,
}).select('_id').lean().exec();

const findReminderWorkflows = (associatedUserId) => Subscription.find({
    user: associatedUserId,
}).select('workflowRunId').lean().exec();

const identityDeletionQuery = (identity) => ({
    identityProvider: identity.provider,
    providerSubject: identity.subject,
});

const findDeletionRecord = (identity, DeletionModel) => DeletionModel.findOne(
    identityDeletionQuery(identity),
).select('_id').lean().exec();

const markDeletionStarted = async (identity, associatedUserId, UserModel, DeletionModel) => {
    await DeletionModel.updateOne(
        identityDeletionQuery(identity),
        { $setOnInsert: identityDeletionQuery(identity) },
        { upsert: true },
    ).exec();

    if (associatedUserId) {
        await UserModel.updateOne(
            { _id: associatedUserId, deletionStartedAt: null },
            { $set: { deletionStartedAt: new Date() } },
        ).exec();
    }
};

const deleteSubscriptions = (associatedUserId) => Subscription.deleteMany({
    user: associatedUserId,
}).exec();

const deleteAssociatedUser = (identity, associatedUserId, UserModel) => (
    UserModel.findOneAndDelete({
        _id: associatedUserId,
        identityProvider: identity.provider,
        providerSubject: identity.subject,
    }).exec()
);

const cancelWorkflows = (ids) => workflowClient.cancel({ ids });

const waitForSubscriptionCreations = async (associatedUserId, UserModel) => {
    const timeoutAt = Date.now() + 30_000;
    while (true) {
        const user = await UserModel.findById(associatedUserId)
            .select('activeSubscriptionCreations')
            .lean()
            .exec();
        if (!user || !user.activeSubscriptionCreations) return;
        if (Date.now() >= timeoutAt) throw new Error('Subscription creation drain timed out');
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
};

export const createIdentityService = ({
    UserModel = User,
    DeletionModel = IdentityDeletion,
    profileLookup = getClerkProfile,
    createUser = (document) => createAssociatedUser(document, UserModel),
    associationLookup = (identity) => findAssociation(identity, UserModel),
    deletionRecordLookup = (identity) => findDeletionRecord(identity, DeletionModel),
    reminderWorkflowLookup = findReminderWorkflows,
    deletionMarker = (identity, userId) => (
        markDeletionStarted(identity, userId, UserModel, DeletionModel)
    ),
    creationDrain = (userId) => waitForSubscriptionCreations(userId, UserModel),
    ownedSubscriptionsDelete = deleteSubscriptions,
    associatedUserDelete = (identity, userId) => (
        deleteAssociatedUser(identity, userId, UserModel)
    ),
    workflowCancellation = cancelWorkflows,
    workflowCancellationError = console.error,
} = {}) => {
    const identityIsDeleted = async (identity) => {
        try {
            return Boolean(await deletionRecordLookup(identity));
        } catch {
            throw provisioningFailed();
        }
    };

    const resolveIdentity = async (identity) => {
        try {
            const user = await UserModel.findOne({
                identityProvider: identity.provider,
                providerSubject: identity.subject,
            });

            return serializeIdentity(identity, user);
        } catch {
            throw identityFailed();
        }
    };

    const provisionIdentity = async (identity) => {
        if (await identityIsDeleted(identity)) throw accountDeletionInProgress();

        let associatedUser;
        try {
            associatedUser = await UserModel.findOne({
                identityProvider: identity.provider,
                providerSubject: identity.subject,
            });
        } catch {
            throw provisioningFailed();
        }

        if (await identityIsDeleted(identity)) throw accountDeletionInProgress();
        if (associatedUser?.deletionStartedAt) throw accountDeletionInProgress();

        if (associatedUser) {
            return { created: false, data: serializeProvisionedIdentity(identity, associatedUser) };
        }

        const profile = await profileLookup(identity.subject);

        let emailUser;
        try {
            emailUser = await UserModel.findOne({ email: profile.email });
        } catch {
            throw provisioningFailed();
        }

        if (await identityIsDeleted(identity)) throw accountDeletionInProgress();

        if (emailUser) {
            if (emailUser.deletionStartedAt) throw accountDeletionInProgress();
            if (matchesIdentityAndEmail(emailUser, identity, profile.email)) {
                return {
                    created: false,
                    data: serializeProvisionedIdentity(identity, emailUser),
                };
            }

            classifyExistingEmail(emailUser);
        }

        let createdUser;
        try {
            createdUser = await createUser({
                ...profile,
                identityProvider: identity.provider,
                providerSubject: identity.subject,
            });
        } catch (error) {
            if (error?.code !== 11000) {
                throw provisioningFailed();
            }
        }

        if (createdUser) {
            let deletionRecordFound;
            try {
                deletionRecordFound = await identityIsDeleted(identity);
            } catch (error) {
                try {
                    await associatedUserDelete(identity, createdUser._id);
                } catch {
                    throw provisioningFailed();
                }
                throw error;
            }

            if (deletionRecordFound) {
                try {
                    await associatedUserDelete(identity, createdUser._id);
                } catch {
                    throw provisioningFailed();
                }
                throw accountDeletionInProgress();
            }

            return { created: true, data: serializeProvisionedIdentity(identity, createdUser) };
        }

        let racedAssociation;
        let racedEmail;
        try {
            [racedAssociation, racedEmail] = await Promise.all([
                UserModel.findOne({
                    identityProvider: identity.provider,
                    providerSubject: identity.subject,
                }),
                UserModel.findOne({ email: profile.email }),
            ]);
        } catch {
            throw provisioningFailed();
        }

        if (await identityIsDeleted(identity)) throw accountDeletionInProgress();

        if (racedAssociation?.deletionStartedAt || racedEmail?.deletionStartedAt) {
            throw accountDeletionInProgress();
        }

        if (matchesIdentityAndEmail(racedAssociation, identity, profile.email)) {
            return {
                created: false,
                data: serializeProvisionedIdentity(identity, racedAssociation),
            };
        }

        if (matchesIdentityAndEmail(racedEmail, identity, profile.email)) {
            return {
                created: false,
                data: serializeProvisionedIdentity(identity, racedEmail),
            };
        }

        if (racedEmail && !hasAssociation(racedEmail)) {
            throw legacyEmailConflict();
        }

        if (racedAssociation || racedEmail) {
            throw identityConflict();
        }

        throw provisioningFailed();
    };

    const deleteIdentity = async (identity) => {
        let associatedUser;
        try {
            associatedUser = await associationLookup(identity);
        } catch {
            throw accountDeleteFailed();
        }
        try {
            await deletionMarker(identity, associatedUser?._id);
            if (associatedUser) await creationDrain(associatedUser._id);
        } catch {
            throw accountDeleteFailed();
        }
        if (!associatedUser) return;

        let subscriptions = [];
        try {
            const found = await reminderWorkflowLookup(associatedUser._id);
            if (Array.isArray(found)) subscriptions = found;
        } catch (error) {
            workflowCancellationError('Could not gather account reminder workflows', error);
            throw accountDeleteFailed();
        }
        const workflowIds = [...new Set(
            subscriptions
                .map((subscription) => subscription?.workflowRunId)
                .filter((value) => typeof value === 'string' && value.length > 0),
        )];

        if (workflowIds.length > 0) {
            try {
                await workflowCancellation(workflowIds);
            } catch (error) {
                workflowCancellationError('Could not cancel account reminder workflows', error);
                throw accountDeleteFailed();
            }
        }

        try {
            await ownedSubscriptionsDelete(associatedUser._id);
            await associatedUserDelete(identity, associatedUser._id);
        } catch {
            throw accountDeleteFailed();
        }
    };

    return { deleteIdentity, resolveIdentity, provisionIdentity };
};
