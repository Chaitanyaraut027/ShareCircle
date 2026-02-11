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
        enum: ['pending', 'approved', 'available', 'completed', 'rejected'],
        default: 'pending',
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
}, { timestamps: true });

// Index for geospatial queries
donationSchema.index({ location: '2dsphere' });

export default mongoose.model('Donation', donationSchema);
