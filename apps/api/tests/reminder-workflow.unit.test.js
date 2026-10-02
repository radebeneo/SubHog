import assert from 'node:assert/strict';
import test from 'node:test';
import dayjs from 'dayjs';

import { createReminderWorkflow } from '../src/controllers/workflow.controller.js';

const subscriptionId = '665f00000000000000000010';
const now = () => dayjs('2026-10-02T12:00:00.000Z');

const createContext = () => {
    const labels = [];
    let cancellations = 0;

    return {
        context: {
            requestPayload: { subscriptionId },
            run: async (label, callback) => {
                labels.push(label);
                return callback();
            },
            sleepUntil: async () => {},
            cancel: async () => {
                cancellations += 1;
            },
        },
        labels,
        cancellationCount: () => cancellations,
    };
};

const scheduledSubscription = {
    _id: subscriptionId,
    status: 'active',
    renewalDate: new Date('2026-10-03T12:00:00.000Z'),
};

test('a reminder revalidates active state and recipient immediately before sending', async () => {
    const execution = createContext();
    const sent = [];
    const currentSubscription = {
        ...scheduledSubscription,
        name: 'Current Plan',
        user: { name: 'Current User', email: 'current@example.com' },
    };
    const workflow = createReminderWorkflow({
        findSubscription: async () => scheduledSubscription,
        findDeliverableSubscription: async (id) => {
            assert.equal(id, subscriptionId);
            return currentSubscription;
        },
        sendReminder: async (message) => sent.push(message),
        now,
    });

    await workflow(execution.context);

    assert.deepEqual(execution.labels, [
        'get subscription',
        '1 days before reminder',
    ]);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'current@example.com');
    assert.equal(sent[0].subscription, currentSubscription);
    assert.equal(execution.cancellationCount(), 0);
});

test('a reminder cancels without sending after cancellation or deletion', async () => {
    for (const currentSubscription of [
        null,
        {
            ...scheduledSubscription,
            status: 'cancelled',
            user: { name: 'Cancelled User', email: 'cancelled@example.com' },
        },
    ]) {
        const execution = createContext();
        let sends = 0;
        const workflow = createReminderWorkflow({
            findSubscription: async () => scheduledSubscription,
            findDeliverableSubscription: async () => currentSubscription,
            sendReminder: async () => {
                sends += 1;
            },
            now,
        });

        await workflow(execution.context);

        assert.equal(sends, 0);
        assert.equal(execution.cancellationCount(), 1);
    }
});
