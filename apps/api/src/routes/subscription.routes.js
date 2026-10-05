import { Router } from 'express';
import clerkAuthorize from '../middlewares/clerk-auth.middleware.js';
import {
    createSubscription,
    getUpcomingRenewals,
    getUserSubscriptions,
    ownedSubscriptionController,
} from "../controllers/subscription.controller.js";

export const createSubscriptionRouter = ({
    createAuthorize = clerkAuthorize,
    createHandler = createSubscription,
    ownedSubscriptionsAuthorize = clerkAuthorize,
    ownedSubscriptionsHandler = getUserSubscriptions,
    upcomingRenewalsAuthorize = clerkAuthorize,
    upcomingRenewalsHandler = getUpcomingRenewals,
    itemAuthorize = clerkAuthorize,
    itemController = ownedSubscriptionController,
} = {}) => {
    const subscriptionRouter = Router();

    subscriptionRouter.get('/', (req, res) => res.send({title: 'GET all subscriptions'}))
    subscriptionRouter.post('/', createAuthorize, createHandler)
    subscriptionRouter.get('/user/:id', ownedSubscriptionsAuthorize, ownedSubscriptionsHandler)
    subscriptionRouter.get(
        '/upcoming-renewals',
        upcomingRenewalsAuthorize,
        upcomingRenewalsHandler,
    )
    subscriptionRouter.get('/:id', itemAuthorize, itemController.getSubscription)
    subscriptionRouter.put('/:id', itemAuthorize, itemController.updateSubscription)
    subscriptionRouter.delete('/:id', itemAuthorize, itemController.deleteSubscription)
    subscriptionRouter.put('/:id/cancel', itemAuthorize, itemController.cancelSubscription)

    return subscriptionRouter;
};

export default createSubscriptionRouter();
