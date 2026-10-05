import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minLength: 2,
        maxLength: 20

    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/\S+@\S+\.\S+/, 'Please fill a valid email address'],
    },
    password: {
        type: String,
        required: [
            function requireLegacyPassword() {
                return !this.identityProvider && !this.providerSubject;
            },
            'Password is required',
        ],
        minLength: 6,
    },
    identityProvider: {
        type: String,
        enum: ['clerk'],
        immutable: true,
        required: function requireProviderForSubject() {
            return Boolean(this.providerSubject);
        },
    },
    providerSubject: {
        type: String,
        trim: true,
        immutable: true,
        required: function requireSubjectForProvider() {
            return Boolean(this.identityProvider);
        },
    },
    // Set when account deletion starts; blocks new owned writes and re-provisioning.
    deletionStartedAt: {
        type: Date,
    },
},{ timestamps: true });

userSchema.path('password').validate(function rejectProviderPassword(password) {
    return !(this.identityProvider && password);
}, 'Provider-associated users cannot have a password');

userSchema.index(
    { identityProvider: 1, providerSubject: 1 },
    {
        name: 'unique_provider_subject',
        unique: true,
        partialFilterExpression: {
            identityProvider: { $type: 'string' },
            providerSubject: { $type: 'string' },
        },
    },
);

export const serializeUser = (user) => {
    if (!user) return null;

    const source = typeof user.toObject === 'function' ? user.toObject() : { ...user };

    return {
        _id: source._id,
        name: source.name,
        email: source.email,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
    };
};

const User = mongoose.model('User', userSchema);

export default User;



