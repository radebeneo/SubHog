import assert from 'node:assert/strict';
import test from 'node:test';

test('database startup disables automatic index creation for manual rollout', async () => {
    process.env.DB_URI = 'mongodb://unit.test/subscription-tracker';
    const { MONGOOSE_CONNECTION_OPTIONS } = await import('../src/database/mongodb.js');
    assert.deepEqual(MONGOOSE_CONNECTION_OPTIONS, { autoIndex: false });
});
