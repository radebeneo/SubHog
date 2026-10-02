import mongoose from 'mongoose';
import {
    SUBSCRIPTION_CATEGORIES,
    SUBSCRIPTION_CURRENCIES,
    SUBSCRIPTION_FREQUENCIES,
    SUBSCRIPTION_STATUSES,
} from '@subhog/contracts';

const subscriptionSchema = new mongoose.Schema({

    name:{
        type: String,
        required: [true, 'Subscription name is required'],
        trim: true,
        minLength: 2,
        maxLength: 100
    },
    price: {
        type: Number,
        required: [true, 'Subscription price is required'],
        min: [0, 'Price must be greater than 0'],
    },
    currency: {
        type: String,
        enum: SUBSCRIPTION_CURRENCIES,
        default: 'ZAR'
    },
    frequency: {
        type: String,
        enum: SUBSCRIPTION_FREQUENCIES,
    },
    category:{
        type: String,
        enum: SUBSCRIPTION_CATEGORIES,
        required: true
    },
    paymentMethod: {
        type: String,
        required: true,
        trim: true,
    },
    status: {
        type: String,
        enum: SUBSCRIPTION_STATUSES,
        default: 'active'
    },
    startDate: {
        type: Date,
        required: true,
        validate: {
            validator: (value) => value <= new Date(),
            message: 'Start date must be in the past',
        }
    },
    renewalDate: {
        type: Date,
        validate: {
            validator: function (value) {
                return value > this.startDate;
            },
            message: 'Renewal date must be after start date',
        }
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    workflowRunId: {
        type: String,
    }
},{ timestamps: true})

// Calculate the renewal date if missing
subscriptionSchema.pre('save', async function() {

    if(!this.renewalDate){

        const renewalPeriods = {
            daily: 1,
            weekly: 7,
            monthly: 30,
            yearly: 365
        }

        this.renewalDate = new Date(this.startDate)
        this.renewalDate.setDate(this.renewalDate.getDate() + renewalPeriods[this.frequency])
    }

    // Auto update subscription status if renewal date has passed
    if (this.status !== 'cancelled' && this.renewalDate < new Date()){
        this.status = 'expired';
    }
})

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export default Subscription;
