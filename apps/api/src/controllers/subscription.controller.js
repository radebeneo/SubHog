import Subscription from "../models/subscription.model.js";
import {workflowClient} from "../config/upstash.js";
import {SERVER_URL} from "../config/env.js";
import { createOwnedSubscriptionService } from '../services/owned-subscription-service.js';
import {
    isEmptyMutationRequest,
    isUpdateSubscriptionRequest,
} from '@subhog/contracts';

export const createSubscription = async (req, res, next) => {
    try{
        const subscription = await Subscription.create({
            ...req.body,
            user: req.user._id,
        });

        const {workflowRunId} = await workflowClient.trigger({
            url: `${SERVER_URL}/api/v1/workflows/subscription/reminder`,
            body: {
                subscriptionId: subscription.id
            },
            headers: {
                'content-type': 'application/json'
            },
            retries: 0
        })

        await Subscription.findByIdAndUpdate(subscription._id, {workflowRunId});

        res.status(201).json({success: true, data: {...subscription.toJSON(), workflowRunId}});
    } catch(error){
        next(error);
    }
}


export const createGetUserSubscriptions = (
    service = createOwnedSubscriptionService(),
) => async (req, res, next) => {
    try {
        const subscriptions = await service.listOwnedSubscriptions(
            req.providerIdentity,
            req.params.id,
        );

        return res.status(200).json({ success: true, data: subscriptions });
    } catch (error) {
        return next(error);
    }
};

export const getUserSubscriptions = createGetUserSubscriptions();

const requestInvalid = (message) => {
    const error = new Error(message);
    error.statusCode = 400;
    error.code = 'REQUEST_INVALID';
    return error;
};

const hasBody = (req) => Number(req.headers['content-length'] || 0) > 0
    || Boolean(req.headers['transfer-encoding']);

const validateJsonBody = (req, guard, message) => {
    if (hasBody(req) && !req.is('application/json')) throw requestInvalid(message);
    if (!guard(req.body)) throw requestInvalid(message);
};

export const createOwnedSubscriptionController = (
    service = createOwnedSubscriptionService(),
) => ({
    getSubscription: async (req, res, next) => {
        try {
            const data = await service.getOwnedSubscription(
                req.providerIdentity,
                req.params.id,
            );
            return res.status(200).json({ success: true, data });
        } catch (error) {
            return next(error);
        }
    },

    updateSubscription: async (req, res, next) => {
        try {
            validateJsonBody(
                req,
                isUpdateSubscriptionRequest,
                'The subscription update is invalid',
            );
            const data = await service.updateOwnedSubscription(
                req.providerIdentity,
                req.params.id,
                req.body,
            );
            return res.status(200).json({ success: true, data });
        } catch (error) {
            return next(error);
        }
    },

    cancelSubscription: async (req, res, next) => {
        try {
            validateJsonBody(
                req,
                isEmptyMutationRequest,
                'The request body must be an empty JSON object',
            );
            const data = await service.cancelOwnedSubscription(
                req.providerIdentity,
                req.params.id,
            );
            return res.status(200).json({ success: true, data });
        } catch (error) {
            return next(error);
        }
    },

    deleteSubscription: async (req, res, next) => {
        try {
            validateJsonBody(
                req,
                isEmptyMutationRequest,
                'The request body must be an empty JSON object',
            );
            await service.deleteOwnedSubscription(
                req.providerIdentity,
                req.params.id,
            );
            return res.status(204).end();
        } catch (error) {
            return next(error);
        }
    },
});

export const ownedSubscriptionController = createOwnedSubscriptionController();
