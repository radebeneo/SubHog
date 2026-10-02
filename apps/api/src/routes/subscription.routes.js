import { Router } from 'express';
import authorize from "../middlewares/auth.middleware.js";
import clerkAuthorize from '../middlewares/clerk-auth.middleware.js';
import {
    createSubscription,
    getUserSubscriptions,
    ownedSubscriptionController,
} from "../controllers/subscription.controller.js";

export const createSubscriptionRouter = ({
    ownedSubscriptionsAuthorize = clerkAuthorize,
    ownedSubscriptionsHandler = getUserSubscriptions,
    itemAuthorize = clerkAuthorize,
    itemController = ownedSubscriptionController,
} = {}) => {
    const subscriptionRouter = Router();

    subscriptionRouter.get('/', (req, res) => res.send({title: 'GET all subscriptions'}))
    subscriptionRouter.post('/', authorize, createSubscription)
    subscriptionRouter.get('/user/:id', ownedSubscriptionsAuthorize, ownedSubscriptionsHandler)
    subscriptionRouter.get('/upcoming-renewals', (req, res) => res.send({title: 'GET upcoming renewals'}))
    subscriptionRouter.get('/:id', itemAuthorize, itemController.getSubscription)
    subscriptionRouter.put('/:id', itemAuthorize, itemController.updateSubscription)
    subscriptionRouter.delete('/:id', itemAuthorize, itemController.deleteSubscription)
    subscriptionRouter.put('/:id/cancel', itemAuthorize, itemController.cancelSubscription)

    return subscriptionRouter;
};

export default createSubscriptionRouter();
