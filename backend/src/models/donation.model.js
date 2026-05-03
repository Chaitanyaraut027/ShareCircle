import mongoose from 'mongoose';

const donationSchema = new mongoose.Schema({
    donor: {
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
    image: {
        type: String, // URL
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'available', 'completed', 'rejected', 'under_review'],
        default: 'pending',
    },
    moderationResult: {
        status: {
            type: String,
            enum: ['approved', 'rejected', 'under_review', 'pending'],
            default: 'pending',
        },
        aiVerdict: String,        // 'safe' | 'unsafe' | 'uncertain' | 'error'
        aiReason: String,         // Human-readable reason from Gemini
        aiScores: {
            nudity: { type: Number, default: 0 },
            violence: { type: Number, default: 0 },
            weapons_drugs: { type: Number, default: 0 },
            spam_text: { type: Number, default: 0 },
            context_mismatch: { type: Number, default: 0 },
        },
        adminNote: String,        // Note left by admin when reviewing
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        reviewedAt: Date,
    },
    pickupAddress: {
        type: String,
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
    requests: [{
        requester: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'rejected'],
            default: 'pending',
        },
        message: String,
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    expiresAt: {
        type: Date,
        index: { expires: 0 }
    }
}, { timestamps: true });

// Index for geospatial queries
donationSchema.index({ location: '2dsphere' });

export default mongoose.model('Donation', donationSchema);
