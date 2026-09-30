import { createClerkVerifier } from '../services/clerk-verifier.js';
import { createClerkVerifierConfig } from '../config/clerk.js';

let clerkVerifier;

const verifyWithConfiguredClerk = (authorization) => {
    clerkVerifier ||= createClerkVerifier(createClerkVerifierConfig());
    return clerkVerifier(authorization);
};

export const createClerkAuthorize = (verify = verifyWithConfiguredClerk) => async (req, res, next) => {
    try {
        req.providerIdentity = await verify(req.headers.authorization);
        return next();
    } catch (error) {
        return next(error);
    }
};

const clerkAuthorize = createClerkAuthorize();

export default clerkAuthorize;
