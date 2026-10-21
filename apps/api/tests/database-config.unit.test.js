import assert from 'node:assert/strict';
import test from 'node:test';

test('database startup disables automatic indexes and selects the configured database', async () => {
    process.env.DB_URI = 'mongodb://unit.test/subscription-tracker';
    process.env.DB_NAME = 'subhog';
    const { MONGOOSE_CONNECTION_OPTIONS } = await import('../src/database/mongodb.js');
    assert.deepEqual(MONGOOSE_CONNECTION_OPTIONS, { autoIndex: false, dbName: 'subhog' });
});
