import Subscription from "../models/subscription.model.js";
import {workflowClient} from "../config/upstash.js";
import {SERVER_URL} from "../config/env.js";
import { createOwnedSubscriptionService } from '../services/owned-subscription-service.js';

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
