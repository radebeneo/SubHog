import {
    createClerkProfileConfig,
    MAX_CLERK_PROFILE_TIMEOUT_MS,
} from '../config/clerk-profile.js';

export class IdentityApiError extends Error {
    constructor(statusCode, code, message) {
        super(message);
        this.name = 'IdentityApiError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

const providerUnavailable = () => new IdentityApiError(
    503,
    'AUTH_PROVIDER_UNAVAILABLE',
    'Authentication provider is temporarily unavailable',
);

const incompleteProfile = () => new IdentityApiError(
    422,
    'PROFILE_INCOMPLETE',
    'The provider profile is incomplete',
);

const unverifiedEmail = () => new IdentityApiError(
    422,
    'PROFILE_EMAIL_UNVERIFIED',
    'The primary email address is not verified',
);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export const MAX_CLERK_PROFILE_BODY_BYTES = 256 * 1024;

const readProfileBody = async (response) => {
    const declaredLength = response.headers?.get?.('content-length');
    if (declaredLength !== null && declaredLength !== undefined) {
        const length = Number(declaredLength);
        if (!Number.isSafeInteger(length) || length < 0 || length > MAX_CLERK_PROFILE_BODY_BYTES) {
            await response.body?.cancel?.();
            throw providerUnavailable();
        }
    }

    if (!response.body?.getReader) throw providerUnavailable();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytesRead = 0;
    let body = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            bytesRead += value.byteLength;
            if (bytesRead > MAX_CLERK_PROFILE_BODY_BYTES) {
                await reader.cancel();
                throw providerUnavailable();
            }

            body += decoder.decode(value, { stream: true });
        }
        body += decoder.decode();
    } finally {
        reader.releaseLock();
    }

    try {
        return JSON.parse(body);
    } catch {
        throw providerUnavailable();
    }
};

const deriveProfile = (profile, subject) => {
    if (!isObject(profile)
        || profile.id !== subject
        || typeof profile.primary_email_address_id !== 'string'
        || !Array.isArray(profile.email_addresses)
        || ![profile.first_name, profile.last_name].every(
            (value) => value === null || value === undefined || typeof value === 'string',
        )) {
        throw providerUnavailable();
    }

    const primaryEmail = profile.email_addresses.find(
        (entry) => isObject(entry) && entry.id === profile.primary_email_address_id,
    );

    if (!primaryEmail
        || !isObject(primaryEmail.verification)
        || primaryEmail.verification.status !== 'verified') {
        throw unverifiedEmail();
    }

    if (typeof primaryEmail.email_address !== 'string') {
        throw providerUnavailable();
    }

    const name = [profile.first_name, profile.last_name]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(' ');
    const email = primaryEmail.email_address.trim().toLowerCase();

    if (name.length < 2 || name.length > 20) {
        throw incompleteProfile();
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
        throw providerUnavailable();
    }

    return { name, email };
};

export const createClerkProfileClient = (config, { fetchImpl = fetch } = {}) => {
    if (!(config?.apiBaseUrl instanceof URL)
        || config.apiBaseUrl.protocol !== 'https:'
        || !config.secretKey
        || !Number.isInteger(config.timeoutMs)
        || config.timeoutMs <= 0
        || config.timeoutMs > MAX_CLERK_PROFILE_TIMEOUT_MS) {
        throw new Error('Complete Clerk profile configuration is required');
    }

    return async (subject) => {
        if (typeof subject !== 'string'
            || !subject
            || subject === '.'
            || subject === '..') {
            throw providerUnavailable();
        }

        const url = new URL(`/v1/users/${encodeURIComponent(subject)}`, config.apiBaseUrl.origin);

        try {
            const response = await fetchImpl(url, {
                method: 'GET',
                headers: {
                    authorization: `Bearer ${config.secretKey}`,
                    accept: 'application/json',
                },
                redirect: 'error',
                signal: AbortSignal.timeout(config.timeoutMs),
            });

            if (!response.ok) {
                throw providerUnavailable();
            }

            const profile = await readProfileBody(response);
            return deriveProfile(profile, subject);
        } catch (error) {
            if (error instanceof IdentityApiError) {
                throw error;
            }

            throw providerUnavailable();
        }
    };
};

let configuredClient;

export const getClerkProfile = async (subject) => {
    try {
        configuredClient ||= createClerkProfileClient(createClerkProfileConfig());
        return await configuredClient(subject);
    } catch (error) {
        if (error instanceof IdentityApiError) {
            throw error;
        }

        throw providerUnavailable();
    }
};
