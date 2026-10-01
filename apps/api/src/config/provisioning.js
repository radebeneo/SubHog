const required = (value, name) => {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${name} is required when identity provisioning is enabled`);
    }

    return value.trim();
};

export const createProvisioningConfig = (source = process.env) => {
    if (source.IDENTITY_PROVISIONING_ENABLED !== 'true') {
        return { enabled: false };
    }

    const databaseResourceId = required(source.DB_RESOURCE_ID, 'DB_RESOURCE_ID');
    const provisioningResourceId = required(
        source.IDENTITY_PROVISIONING_RESOURCE_ID,
        'IDENTITY_PROVISIONING_RESOURCE_ID',
    );

    if (databaseResourceId !== provisioningResourceId) {
        throw new Error('Identity provisioning resource does not match the database resource');
    }

    const expectedConfirmation = `ENABLE_PROVISIONING:${provisioningResourceId}`;
    if (source.IDENTITY_PROVISIONING_RESOURCE_CONFIRMATION !== expectedConfirmation) {
        throw new Error('Identity provisioning requires resource-bound confirmation');
    }

    return {
        enabled: true,
        resourceId: provisioningResourceId,
    };
};
