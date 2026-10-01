import mongoose from 'mongoose';
import {
    SUBSCRIPTION_CATEGORIES,
    SUBSCRIPTION_CURRENCIES,
    SUBSCRIPTION_FREQUENCIES,
    SUBSCRIPTION_STATUSES,
} from '@subhog/contracts';
import { isNonNegativeMoneyAmount } from '@subhog/domain';

import Subscription from '../models/subscription.model.js';
import User from '../models/user.model.js';

const CURRENCIES = new Set(SUBSCRIPTION_CURRENCIES);
const FREQUENCIES = new Set(SUBSCRIPTION_FREQUENCIES);
const CATEGORIES = new Set(SUBSCRIPTION_CATEGORIES);
const STATUSES = new Set(SUBSCRIPTION_STATUSES);

export const OWNED_SUBSCRIPTION_FIELDS = [
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
];

export class SubscriptionApiError extends Error {
    constructor(statusCode, code, message) {
        super(message);
        this.name = 'SubscriptionApiError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

const apiError = (statusCode, code, message) => (
    new SubscriptionApiError(statusCode, code, message)
);

const subscriptionsReadFailed = () => apiError(
    500,
    'SUBSCRIPTIONS_READ_FAILED',
    'Subscriptions could not be read',
);

const dataIntegrityError = () => apiError(
    500,
    'DATA_INTEGRITY_ERROR',
    'Subscription data could not be represented',
);

const canonicalObjectId = (value) => {
    if (!mongoose.isObjectIdOrHexString(value)) return null;
    return new mongoose.Types.ObjectId(value).toHexString();
};

const requiredString = (value, allowedValues) => (
    typeof value === 'string'
    && value.trim().length > 0
    && (!allowedValues || allowedValues.has(value))
);

const isoDate = (value) => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        throw dataIntegrityError();
    }

    return value.toISOString();
};

export const serializeOwnedSubscription = (subscription) => {
    const source = typeof subscription?.toObject === 'function'
        ? subscription.toObject()
        : subscription;
    const id = canonicalObjectId(source?._id);
    const user = canonicalObjectId(source?.user);

    if (!source
        || !id
        || !user
        || !requiredString(source.name)
        || source.name.length < 2
        || source.name.length > 100
        || !isNonNegativeMoneyAmount(source.price)
        || !requiredString(source.currency, CURRENCIES)
        || !requiredString(source.frequency, FREQUENCIES)
        || !requiredString(source.category, CATEGORIES)
        || !requiredString(source.paymentMethod)
        || !requiredString(source.status, STATUSES)) {
        throw dataIntegrityError();
    }

    return {
        _id: id,
        name: source.name,
        price: source.price,
        currency: source.currency,
        frequency: source.frequency,
        category: source.category,
        paymentMethod: source.paymentMethod,
        status: source.status,
        startDate: isoDate(source.startDate),
        renewalDate: source.renewalDate === null || source.renewalDate === undefined
            ? null
            : isoDate(source.renewalDate),
        user,
        createdAt: isoDate(source.createdAt),
        updatedAt: isoDate(source.updatedAt),
    };
};

const findAssociation = (identity) => User.findOne({
    identityProvider: identity.provider,
    providerSubject: identity.subject,
}).select('_id').lean().exec();

const findSubscriptions = (associatedUserId) => Subscription.find({
    user: associatedUserId,
}).select(OWNED_SUBSCRIPTION_FIELDS.join(' ')).sort({ createdAt: -1, _id: -1 }).lean().exec();

export const createOwnedSubscriptionService = ({
    associationLookup = findAssociation,
    subscriptionLookup = findSubscriptions,
} = {}) => ({
    listOwnedSubscriptions: async (identity, requestedId) => {
        const canonicalRequestedId = canonicalObjectId(requestedId);
        if (!canonicalRequestedId) {
            throw apiError(422, 'INVALID_USER_ID', 'The user ID is invalid');
        }

        let associatedUser;
        try {
            associatedUser = await associationLookup(identity);
        } catch {
            throw subscriptionsReadFailed();
        }

        if (!associatedUser) {
            throw apiError(
                403,
                'IDENTITY_NOT_PROVISIONED',
                'The authenticated identity is not provisioned',
            );
        }

        const associatedUserId = canonicalObjectId(associatedUser._id);
        if (!associatedUserId) {
            throw apiError(404, 'USER_NOT_FOUND', 'The associated user was not found');
        }

        if (canonicalRequestedId !== associatedUserId) {
            throw apiError(403, 'NOT_OWNER', 'The authenticated user is not the requested owner');
        }

        let subscriptions;
        try {
            subscriptions = await subscriptionLookup(associatedUserId);
        } catch {
            throw subscriptionsReadFailed();
        }

        if (!Array.isArray(subscriptions)) throw dataIntegrityError();

        const serialized = subscriptions.map(serializeOwnedSubscription);
        if (serialized.some((subscription) => subscription.user !== associatedUserId)) {
            throw dataIntegrityError();
        }

        return serialized.sort((left, right) => (
            right.createdAt.localeCompare(left.createdAt)
            || right._id.localeCompare(left._id)
        ));
    },
});
