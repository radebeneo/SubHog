import { isProvisionIdentityRequest } from '@subhog/contracts';
import { IdentityApiError } from '../services/clerk-profile.js';
import { createIdentityService } from '../services/identity-service.js';

const requestInvalid = () => new IdentityApiError(
    400,
    'REQUEST_INVALID',
    'The request body must be an empty JSON object',
);

export const createIdentityController = (service = createIdentityService()) => ({
    getIdentity: async (req, res, next) => {
        try {
            const data = await service.resolveIdentity(req.providerIdentity);
            return res.status(200).json({ success: true, data });
        } catch (error) {
            return next(error);
        }
    },

    provisionIdentity: async (req, res, next) => {
        const hasBody = Number(req.headers['content-length'] || 0) > 0
            || Boolean(req.headers['transfer-encoding']);
        if (hasBody && !req.is('application/json')) {
            return next(requestInvalid());
        }

        const body = req.body;
        if (!isProvisionIdentityRequest(body)) {
            return next(requestInvalid());
        }

        try {
            const result = await service.provisionIdentity(req.providerIdentity);
            return res.status(result.created ? 201 : 200).json({
                success: true,
                data: result.data,
            });
        } catch (error) {
            return next(error);
        }
    },
});

const identityController = createIdentityController();

export const { getIdentity, provisionIdentity } = identityController;
