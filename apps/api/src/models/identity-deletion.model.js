import mongoose from 'mongoose';

const identityDeletionSchema = new mongoose.Schema({
    identityProvider: {
        type: String,
        enum: ['clerk'],
        required: true,
    },
    providerSubject: {
        type: String,
        required: true,
    },
}, { timestamps: true });

identityDeletionSchema.index(
    { identityProvider: 1, providerSubject: 1 },
    { name: 'unique_deleted_provider_subject', unique: true },
);

const IdentityDeletion = mongoose.model('IdentityDeletion', identityDeletionSchema);

export default IdentityDeletion;
