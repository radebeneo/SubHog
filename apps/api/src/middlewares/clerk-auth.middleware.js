import { createClerkVerifier } from '../services/clerk-verifier.js';
import { createClerkVerifierConfig } from '../config/clerk.js';

let clerkVerifier;

export const initializeClerkVerifier = (source = process.env) => {
    const verifier = createClerkVerifier(createClerkVerifierConfig(source));
    clerkVerifier = verifier;
    return verifier;
};

const verifyWithConfiguredClerk = (authorization) => {
    clerkVerifier ||= initializeClerkVerifier();
    return clerkVerifier(authorization);
};

const authorizationValues = (req) => {
    if (req?.headersDistinct
        && Object.prototype.hasOwnProperty.call(req.headersDistinct, 'authorization')) {
        const distinct = req.headersDistinct.authorization;
        return Array.isArray(distinct) ? distinct : [distinct];
    }

    if (!Array.isArray(req?.rawHeaders)) return [];

    const values = [];
    for (let index = 0; index < req.rawHeaders.length; index += 2) {
        if (typeof req.rawHeaders[index] === 'string'
            && req.rawHeaders[index].toLowerCase() === 'authorization') {
            values.push(req.rawHeaders[index + 1]);
        }
    }
    return values;
};

export const createClerkAuthorize = (verify = verifyWithConfiguredClerk) => async (req, res, next) => {
    try {
        const values = authorizationValues(req);
        req.providerIdentity = await verify(values.length === 1 ? values[0] : values);
        return next();
    } catch (error) {
        return next(error);
    }
};

const clerkAuthorize = createClerkAuthorize();

export default clerkAuthorize;
