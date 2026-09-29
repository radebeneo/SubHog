import mongoose from 'mongoose';

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

export const createIdentityService = ({
    UserModel = User,
    profileLookup = getClerkProfile,
    createUser = (document) => createAssociatedUser(document, UserModel),
} = {}) => {
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
        let associatedUser;

        try {
            associatedUser = await UserModel.findOne({
                identityProvider: identity.provider,
                providerSubject: identity.subject,
            });
        } catch {
            throw provisioningFailed();
        }

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

        if (emailUser) {
            if (matchesIdentityAndEmail(emailUser, identity, profile.email)) {
                return {
                    created: false,
                    data: serializeProvisionedIdentity(identity, emailUser),
                };
            }

            classifyExistingEmail(emailUser);
        }

        try {
            const createdUser = await createUser({
                ...profile,
                identityProvider: identity.provider,
                providerSubject: identity.subject,
            });

            return { created: true, data: serializeProvisionedIdentity(identity, createdUser) };
        } catch (error) {
            if (error?.code !== 11000) {
                throw provisioningFailed();
            }
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

    return { resolveIdentity, provisionIdentity };
};
