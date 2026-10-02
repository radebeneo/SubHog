const required = (value, name) => {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${name} is required for Clerk profile retrieval`);
    }

    if (value !== value.trim()) {
        throw new Error(`${name} must not have leading or trailing whitespace`);
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

    const rawTimeoutMs = required(source.CLERK_PROFILE_TIMEOUT_MS, 'CLERK_PROFILE_TIMEOUT_MS');
    const timeoutMs = Number(rawTimeoutMs);
    if (!/^\d+$/.test(rawTimeoutMs)
        || !Number.isSafeInteger(timeoutMs)
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
