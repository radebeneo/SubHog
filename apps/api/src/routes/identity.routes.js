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
    } else {
        identityRouter.post('/provision', (req, res) => {
            res.status(404).json({
                success: false,
                code: 'PROVISIONING_DISABLED',
                message: 'Account setup is unavailable because identity provisioning is disabled on the API',
            });
        });
    }

    return identityRouter;
};

export default createIdentityRouter();
