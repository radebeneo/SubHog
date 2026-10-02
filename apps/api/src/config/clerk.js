const required = (value, name) => {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${name} is required for Clerk verification`);
    }

    if (value !== value.trim()) {
        throw new Error(`${name} must not have leading or trailing whitespace`);
    }

    return value;
};

export const MAX_CLERK_CLOCK_SKEW_SECONDS = 300;
export const MAX_CLERK_JWKS_TIMEOUT_MS = 30000;
export const MAX_CLERK_JWKS_REFRESH_COOLDOWN_MS = 3600000;
export const MAX_CLERK_JWKS_CACHE_MAX_AGE_MS = 86400000;

const boundedInteger = (value, name, minimum, maximum) => {
    const raw = required(value, name);
    const parsed = Number(raw);

    if (!/^\d+$/.test(raw)
        || !Number.isSafeInteger(parsed)
        || parsed < minimum
        || parsed > maximum) {
        throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
    }

    return parsed;
};

const splitList = (value, name) => {
    const values = required(value, name).split(',').map((item) => item.trim());

    if (values.some((item) => !item)) {
        throw new Error(`${name} must contain non-empty comma-separated values`);
    }

    return values;
};

export const createClerkVerifierConfig = (source = process.env) => {
    const jwksUrl = required(source.CLERK_JWKS_URL, 'CLERK_JWKS_URL');

    let parsedJwksUrl;
    try {
        parsedJwksUrl = new URL(jwksUrl);
    } catch {
        throw new Error('CLERK_JWKS_URL must be a valid URL');
    }

    if (parsedJwksUrl.protocol !== 'https:'
        || parsedJwksUrl.username
        || parsedJwksUrl.password
        || parsedJwksUrl.hash) {
        throw new Error('CLERK_JWKS_URL must be a credential-free HTTPS URL without a fragment');
    }

    const authorizedPartyPolicy = required(
        source.CLERK_AUTHORIZED_PARTY_POLICY,
        'CLERK_AUTHORIZED_PARTY_POLICY',
    );

    if (!['required', 'absent'].includes(authorizedPartyPolicy)) {
        throw new Error('CLERK_AUTHORIZED_PARTY_POLICY must be required or absent');
    }

    const authorizedParties = authorizedPartyPolicy === 'required'
        ? splitList(source.CLERK_AUTHORIZED_PARTIES, 'CLERK_AUTHORIZED_PARTIES')
        : [];

    return {
        jwksUrl: parsedJwksUrl,
        issuer: required(source.CLERK_ISSUER, 'CLERK_ISSUER'),
        audience: splitList(source.CLERK_AUDIENCE, 'CLERK_AUDIENCE'),
        algorithms: splitList(source.CLERK_ALLOWED_ALGORITHMS, 'CLERK_ALLOWED_ALGORITHMS'),
        authorizedPartyPolicy,
        authorizedParties,
        clockTolerance: boundedInteger(
            source.CLERK_CLOCK_SKEW_SECONDS,
            'CLERK_CLOCK_SKEW_SECONDS',
            0,
            MAX_CLERK_CLOCK_SKEW_SECONDS,
        ),
        jwksTimeout: boundedInteger(
            source.CLERK_JWKS_TIMEOUT_MS,
            'CLERK_JWKS_TIMEOUT_MS',
            1,
            MAX_CLERK_JWKS_TIMEOUT_MS,
        ),
        jwksCooldown: boundedInteger(
            source.CLERK_JWKS_REFRESH_COOLDOWN_MS,
            'CLERK_JWKS_REFRESH_COOLDOWN_MS',
            1,
            MAX_CLERK_JWKS_REFRESH_COOLDOWN_MS,
        ),
        jwksCacheMaxAge: boundedInteger(
            source.CLERK_JWKS_CACHE_MAX_AGE_MS,
            'CLERK_JWKS_CACHE_MAX_AGE_MS',
            1,
            MAX_CLERK_JWKS_CACHE_MAX_AGE_MS,
        ),
    };
};
