import User from '../models/user.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { uploadOnCloudinary } from '../utils/cloudinary.js';

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
    try {
        const { fullName, email, password, mobileNumber } = req.body;

        // Validation
        if (!fullName || !email || !password || !mobileNumber) {
            return res.status(400).json({ success: false, message: 'Please provide all required fields' });
        }

        if (mobileNumber.length !== 10) {
            return res.status(400).json({ success: false, message: 'Mobile number must be 10 digits' });
        }

        const emailRegex = /.+\@.+\..+/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Please provide a valid email' });
        }

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user with forced role 'user'
        const user = await User.create({
            fullName,
            email,
            password: hashedPassword,
            mobileNumber,
            role: 'user', // Enforce 'user' role for public registration
            // address and location are optional and can be updated later
        });

        if (user) {
            // Generate token for immediate login
            const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
                expiresIn: '30d',
            });

            const options = {
                expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                httpOnly: true,
            };

            const userObj = user.toObject();
            delete userObj.password;

            res.status(201).cookie('token', token, options).json({
                success: true,
                token,
                message: 'User registered successfully',
                data: userObj,
            });
        } else {
            res.status(400).json({ success: false, message: 'Invalid user data' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate email & password
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        // Check for user
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Check if password matches
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Create token
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
            expiresIn: '30d',
        });

        const options = {
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            httpOnly: true,
        };

        const userObj = user.toObject();
        delete userObj.password;

        res.status(200).cookie('token', token, options).json({
            success: true,
            token,
            data: userObj,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Logout user / Clear cookie
// @route   GET /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
    });

    res.status(200).json({
        success: true,
        data: {},
    });
};

// @desc    Update user location
// @route   PUT /api/auth/update-location
// @access  Public (simplified)
export const updateLocation = async (req, res) => {
    try {
        const { userId, latitude, longitude, address } = req.body;
        
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }
        
        const updateQuery = {};
        
        if (latitude !== undefined && longitude !== undefined) {
            updateQuery.location = {
                type: 'Point',
                coordinates: [Number(longitude), Number(latitude)]
            };
        }
        
        if (address) {
            updateQuery['address.fullAddress'] = address;
        }

        // Use $set to update specific fields without overwriting everything
        const user = await User.findByIdAndUpdate(
            userId, 
            { $set: updateQuery }, 
            { new: true, runValidators: false } // Avoid validation errors on subfields
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        res.status(200).json({ 
            success: true, 
            message: 'Location updated successfully', 
            user 
        });
    } catch (error) {
        console.error('Update Location Error:', error);
        res.status(500).json({ success: false, message: 'Server error updating location' });
    }
};

// @desc    Update user profile picture
// @route   PUT /api/auth/update-profile-picture
// @access  Public (simplified)
export const updateProfilePicture = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image provided' });
        }

        const uploaded = await uploadOnCloudinary(req.file.path);
        if (!uploaded) {
            return res.status(500).json({ success: false, message: 'Failed to upload image' });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { profilePic: uploaded.secure_url },
            { new: true, runValidators: false }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Profile picture updated successfully',
            user
        });
    } catch (error) {
        console.error('Update Profile Picture Error:', error);
        res.status(500).json({ success: false, message: 'Server error updating profile picture' });
    }
};
// @desc    Update push token
// @route   PUT /api/auth/update-push-token
// @access  Public (simplified)
export const updatePushToken = async (req, res) => {
    try {
        const { userId, pushToken } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { pushToken },
            { new: true, runValidators: false }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Push token updated successfully'
        });
    } catch (error) {
        console.error('Update Push Token Error:', error);
        res.status(500).json({ success: false, message: 'Server error updating push token' });
    }
};
