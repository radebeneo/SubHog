import { Router } from 'express';

import { createIdentityController } from '../controllers/identity.controller.js';
import clerkAuthorize from '../middlewares/clerk-auth.middleware.js';

export const createIdentityRouter = ({
    authorize = clerkAuthorize,
    controller = createIdentityController(),
} = {}) => {
    const identityRouter = Router();

    identityRouter.get('/', authorize, controller.getIdentity);
    identityRouter.post('/provision', authorize, controller.provisionIdentity);

    return identityRouter;
};

export default createIdentityRouter();
