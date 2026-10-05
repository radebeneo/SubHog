import { Router } from 'express';

import { createProvisioningConfig } from '../config/provisioning.js';
import { createIdentityController } from '../controllers/identity.controller.js';
import clerkAuthorize from '../middlewares/clerk-auth.middleware.js';

export const createIdentityRouter = ({
    authorize = clerkAuthorize,
    controller = createIdentityController(),
    provisioningEnabled = createProvisioningConfig().enabled,
} = {}) => {
    const identityRouter = Router();

    identityRouter.get('/', authorize, controller.getIdentity);
    identityRouter.delete('/', authorize, controller.deleteIdentity);
    if (provisioningEnabled) {
        identityRouter.post('/provision', authorize, controller.provisionIdentity);
    }

    return identityRouter;
};

export default createIdentityRouter();
