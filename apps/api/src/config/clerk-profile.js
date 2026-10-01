const required = (value, name) => {
    if (!value) {
        throw new Error(`${name} is required for Clerk profile retrieval`);
    }

    return value;
};

export const MAX_CLERK_PROFILE_TIMEOUT_MS = 10000;

export const createClerkProfileConfig = (source = process.env) => {
    let apiBaseUrl;

    try {
        apiBaseUrl = new URL(required(source.CLERK_API_BASE_URL, 'CLERK_API_BASE_URL'));
    } catch {
        throw new Error('CLERK_API_BASE_URL must be a valid URL');
    }

    if (apiBaseUrl.protocol !== 'https:'
        || apiBaseUrl.username
        || apiBaseUrl.password
        || apiBaseUrl.pathname !== '/'
        || apiBaseUrl.search
        || apiBaseUrl.hash) {
        throw new Error('CLERK_API_BASE_URL must be a credential-free HTTPS origin');
    }

    const timeoutMs = Number(required(source.CLERK_PROFILE_TIMEOUT_MS, 'CLERK_PROFILE_TIMEOUT_MS'));
    if (!Number.isInteger(timeoutMs)
        || timeoutMs <= 0
        || timeoutMs > MAX_CLERK_PROFILE_TIMEOUT_MS) {
        throw new Error(
            `CLERK_PROFILE_TIMEOUT_MS must be an integer from 1 to ${MAX_CLERK_PROFILE_TIMEOUT_MS}`,
        );
    }

    return {
        apiBaseUrl,
        secretKey: required(source.CLERK_SECRET_KEY, 'CLERK_SECRET_KEY'),
        timeoutMs,
    };
};
