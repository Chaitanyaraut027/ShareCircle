import mongoose from 'mongoose';

const requestSchema = new mongoose.Schema({
    requester: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    title: {
        type: String,
        required: [true, 'Please add a title'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    category: {
        type: String,
        required: [true, 'Please add a category'],
    },
    quantity: {
        type: String,
        required: [true, 'Please add a quantity'],
    },
    status: {
        type: String,
        enum: ['pending', 'fulfilled', 'cancelled', 'under_review', 'rejected'],
        default: 'pending',
    },
    moderationResult: {
        status: {
            type: String,
            enum: ['approved', 'under_review', 'rejected'],
            default: 'approved',
        },
        aiVerdict: String,
        aiReason: String,
        aiScores: Object,
        adminNote: String,
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        reviewedAt: Date,
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            index: '2dsphere',
        },
    },
    fulfilledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    offers: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
            createdAt: { type: Date, default: Date.now },
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });

// Index for geospatial queries
requestSchema.index({ location: '2dsphere' });

export default mongoose.model('Request', requestSchema);
