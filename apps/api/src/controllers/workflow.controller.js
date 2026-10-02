import dayjs from 'dayjs'

import {createRequire} from 'module'
const require = createRequire(import.meta.url)
const {serve} = require('@upstash/workflow/express')

import Subscription from "../models/subscription.model.js";
import {sendReminderEmail} from "../utils/send-email.js";

const REMINDERS = [7, 5, 2, 1]


export const createReminderWorkflow = ({
    findSubscription = (subscriptionId) => Subscription.findById(subscriptionId),
    findDeliverableSubscription = (subscriptionId) => Subscription.findOne({
        _id: subscriptionId,
        status: 'active',
    }).populate('user', 'name email'),
    sendReminder = sendReminderEmail,
    now = () => dayjs(),
} = {}) => async (context) => {
    const { subscriptionId } = context.requestPayload;
    const subscription = await fetchSubscription(context, subscriptionId, findSubscription)

    if(!subscription || subscription.status !== 'active') return

    const renewalDate = dayjs(subscription.renewalDate)

    if(renewalDate.isBefore(now())) {
        console.log(`Renewal date had passed for subscription ${subscriptionId}. Stopping workflow.`)
        return
    }

    for(const daysBefore of REMINDERS) {
        const reminderDate = renewalDate.subtract(daysBefore, 'day')


        if(reminderDate.isAfter(now())) {
            await sleepUntilReminder(context, `${daysBefore} days before`, reminderDate)
        }

        if(now().isSame(reminderDate, 'day')) {
            const delivered = await triggerReminder(
                context,
                `${daysBefore} days before reminder`,
                subscriptionId,
                findDeliverableSubscription,
                sendReminder,
            )
            if (!delivered) {
                await context.cancel()
                return
            }
        }

    }
}

export const sendReminders = serve(createReminderWorkflow())

const fetchSubscription = async (context, subscriptionId, findSubscription) => {
    return await context.run('get subscription', async () => {
        return findSubscription(subscriptionId)
    })
}

const sleepUntilReminder = async (context, label, date) => {
    console.log(`Sleeping until ${label} reminder at ${date}`)
    await context.sleepUntil(label, date.toDate())
}

const triggerReminder = async (
    context,
    label,
    subscriptionId,
    findDeliverableSubscription,
    sendReminder,
) => {

    return await context.run(label, async () => {
        const subscription = await findDeliverableSubscription(subscriptionId)
        if (subscription?.status !== 'active' || !subscription.user?.email) return false

        console.log(`Triggering ${label}`);

        await sendReminder({
            to: subscription.user.email,
            type: label,
            subscription,
        })
        return true
    })
}
