const required = (source, name) => {
    const value = source[name];
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${name} is required for integration acceptance`);
    }

    return value.trim();
};

const parseMongoUrl = (value) => {
    try {
        return new URL(value);
    } catch {
        throw new Error('INTEGRATION_MONGODB_URI must be a valid MongoDB connection URL');
    }
};

export const createMongoAcceptanceConfig = (source = process.env) => {
    const uri = required(source, 'INTEGRATION_MONGODB_URI');
    const resourceId = required(source, 'INTEGRATION_DB_RESOURCE_ID');
    const databaseName = required(source, 'INTEGRATION_DB_NAME');
    const runId = required(source, 'INTEGRATION_TEST_RUN_ID');
    const parsedUri = parseMongoUrl(uri);

    if (!['mongodb:', 'mongodb+srv:'].includes(parsedUri.protocol)) {
        throw new Error('INTEGRATION_MONGODB_URI must use mongodb or mongodb+srv');
    }

    if (!/^[A-Za-z0-9_-]{8,64}$/.test(runId)) {
        throw new Error('INTEGRATION_TEST_RUN_ID must be 8-64 safe identifier characters');
    }

    if (!/^[A-Za-z0-9_-]{1,63}$/.test(databaseName)
        || ['admin', 'config', 'local'].includes(databaseName.toLowerCase())) {
        throw new Error('INTEGRATION_DB_NAME must be an explicit non-system database name');
    }

    let uriDatabaseName;
    try {
        uriDatabaseName = decodeURIComponent(parsedUri.pathname.replace(/^\/+/, ''));
    } catch {
        throw new Error('INTEGRATION_MONGODB_URI contains an invalid database name');
    }

    if (uriDatabaseName !== databaseName) {
        throw new Error('INTEGRATION_MONGODB_URI database must match INTEGRATION_DB_NAME');
    }

    if (source.DB_URI && source.DB_URI === uri) {
        throw new Error('Integration acceptance cannot reuse DB_URI');
    }

    const expectedConfirmation = `DISPOSABLE_DATABASE:${resourceId}:${databaseName}`;
    if (source.INTEGRATION_DB_CONFIRMED !== expectedConfirmation) {
        throw new Error('Integration acceptance requires resource-bound disposable confirmation');
    }

    const expectedCleanup = `CLEANUP_RUN:${resourceId}:${databaseName}:${runId}`;
    if (source.INTEGRATION_CLEANUP_CONFIRMED !== expectedCleanup) {
        throw new Error('Integration acceptance requires run-scoped cleanup confirmation');
    }

    return {
        uri,
        resourceId,
        databaseName,
        runId,
    };
};

export const createLiveAcceptanceConfig = (source = process.env) => {
    const mongo = createMongoAcceptanceConfig(source);
    const expectedSeed = `SEED_SUBSCRIPTIONS:${mongo.resourceId}:${mongo.databaseName}:${mongo.runId}`;

    if (source.INTEGRATION_SEED_SUBSCRIPTIONS_CONFIRMED !== expectedSeed) {
        throw new Error('Live acceptance requires run-scoped subscription seed confirmation');
    }

    return {
        mongo,
        primaryToken: required(source, 'INTEGRATION_CLERK_TOKEN_PRIMARY'),
        secondaryToken: required(source, 'INTEGRATION_CLERK_TOKEN_SECONDARY'),
    };
};
