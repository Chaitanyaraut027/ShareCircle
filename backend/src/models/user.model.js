import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /.+\@.+\..+/,
      'Please add a valid email',
    ],
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false,
  },
  mobileNumber: {
    type: String,
    required: [true, 'Please add a mobile number'],
    trim: true,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  // Profile fields (can be updated after registration)
  address: {
    street: String,
    city: String,
    state: String,
    zip: String,
    country: String,
    fullAddress: String,
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
  profilePic: {
    type: String,
    default: '',
  },
  // Donor specific stats (tracked for all users)
  donationCount: {
    type: Number,
    default: 0,
  },
  rewardPoints: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Index for geospatial queries
userSchema.index({ location: '2dsphere' });

export default mongoose.model('User', userSchema);
