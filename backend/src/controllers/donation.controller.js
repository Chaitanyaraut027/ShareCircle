import Donation from '../models/donation.model.js';
import User from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sendPushNotification, sendBulkNotifications } from '../utils/notifications.js';

// @desc    Create a new donation
// @route   POST /api/donations
// @access  Private (Assuming auth middleware would be used, but keeping simple for now)
export const createDonation = async (req, res) => {
    try {
        const { donorId, title, description, category, quantity, pickupAddress, longitude, latitude } = req.body;
        
        let imageUrl = '';

        if (req.file) {
            const uploaded = await uploadOnCloudinary(req.file.path);
            if (uploaded) {
                imageUrl = uploaded.secure_url;
            } else {
                return res.status(500).json({ success: false, message: 'Image upload failed' });
            }
        }

        const donation = new Donation({
            donor: donorId,
            title,
            description,
            category,
            quantity,
            pickupAddress,
            image: imageUrl,
            location: {
                type: 'Point',
                coordinates: [parseFloat(longitude) || 0, parseFloat(latitude) || 0]
            }
        });

        await donation.save();

        // Update user's donation count and reward points in real-time
        await User.findByIdAndUpdate(donorId, {
            $inc: { donationCount: 1, rewardPoints: 10 } 
        });

        // NOTIFICATION: Notify all users with a push token about the new donation
        try {
            const allUsersWithToken = await User.find({
                _id: { $ne: donorId },
                pushToken: { $ne: null }
            }).select('pushToken');

            const tokens = allUsersWithToken.map(u => u.pushToken);
            if (tokens.length > 0) {
                await sendBulkNotifications(
                    tokens,
                    'New Donation Posted! 🎁',
                    `A new item "${title}" has been posted in the community. Check it out!`,
                    { donationId: donation._id }
                );
            }
        } catch (e) {
            console.error('Error in broadcasting notification:', e);
        }

        res.status(201).json({
            success: true,
            data: donation,
            message: 'Donation created successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Generate AI description
// @route   POST /api/donations/generate-description
// @access  Public
export const generateAIDescription = async (req, res) => {
    try {
        const { title, category } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            console.error('❌ GEMINI_API_KEY is not set in environment variables!');
            return res.status(503).json({ success: false, message: 'AI service not configured. GEMINI_API_KEY missing on server.' });
        }

        if (!title || !category) {
            return res.status(400).json({ success: false, message: 'Title and category are required' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        // Use pinned stable model IDs to avoid version resolution issues
        const modelNames = [
            "gemini-2.0-flash-001",
            "gemini-2.0-flash",
            "gemini-2.5-flash",
            "gemini-1.5-flash-001",
            "gemini-1.5-flash"
        ];

        let text = "";
        let success = false;
        let lastErrorMsg = "";

        for (const modelName of modelNames) {
            try {
                console.log(`🔄 Trying Gemini model: ${modelName}...`);
                const model = genAI.getGenerativeModel({ model: modelName });
                const prompt = `Write a short, engaging description for an item being donated. The title of the item is "${title}" and it belongs to the category "${category}". Keep it under 3 sentences, sound warm and helpful.`;

                const result = await model.generateContent(prompt);
                const response = await result.response;
                text = response.text();

                if (text && text.trim().length > 0) {
                    success = true;
                    console.log(`✅ Success with model: ${modelName}`);
                    break;
                }
            } catch (err) {
                console.warn(`❌ Model ${modelName} failed: ${err.message}`);
                lastErrorMsg = err.message;
                continue;
            }
        }

        if (!success) {
            console.error('🚫 All Gemini models failed. Last error:', lastErrorMsg);
            throw new Error(lastErrorMsg || "All Gemini models failed to respond.");
        }

        res.status(200).json({
            success: true,
            description: text.trim()
        });
    } catch (error) {
        console.error('Gemini AI Error:', error.message);
        res.status(500).json({
            success: false,
            message: `AI failed: ${error.message || 'Check your Gemini API Key in Render Environment Variables'}`
        });
    }
};

// @desc    Get nearby donations
// @route   GET /api/donations/nearby
// @access  Public
export const getNearbyDonations = async (req, res) => {
    try {
        const { latitude, longitude, radius = 5, query = '' } = req.query;

        let findQuery = {};

        if (latitude && longitude) {
            const lat = parseFloat(latitude);
            const lng = parseFloat(longitude);
            if (!isNaN(lat) && !isNaN(lng)) {
                const maxDistance = parseFloat(radius) * 1000;
                findQuery.location = {
                    $nearSphere: {
                        $geometry: {
                            type: 'Point',
                            coordinates: [lng, lat]
                        },
                        $maxDistance: maxDistance
                    }
                };
            }
        }

        if (query.trim()) {
            findQuery.$or = [
                { title: { $regex: query.trim(), $options: 'i' } },
                { category: { $regex: query.trim(), $options: 'i' } }
            ];
        }

        const donations = await Donation.find(findQuery).populate('donor', 'fullName mobileNumber profilePic');

        res.status(200).json({
            success: true,
            count: donations.length,
            data: donations
        });

    } catch (error) {
        console.error('Error fetching nearby donations:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Request a donation item
// @route   POST /api/donations/:id/request
export const requestItem = async (req, res) => {
    try {
        const { requesterId, message } = req.body;
        const donationId = req.params.id;
        
        const donation = await Donation.findById(donationId);
        if (!donation) return res.status(404).json({ success: false, message: 'Donation not found' });
        
        // Check if already requested
        const alreadyRequested = donation.requests.find(r => r.requester.toString() === requesterId);
        if (alreadyRequested) return res.status(400).json({ success: false, message: 'Already requested' });
        
        donation.requests.push({ requester: requesterId, message: message || '' });
        await donation.save();

        // NOTIFICATION: Notify the donor about the new request
        try {
            const donor = await User.findById(donation.donor).select('pushToken');
            const requester = await User.findById(requesterId).select('fullName');
            if (donor && donor.pushToken) {
                await sendPushNotification(
                    donor.pushToken,
                    'New Request Received! 📋',
                    `${requester.fullName} has requested your item: "${donation.title}".`,
                    { donationId: donation._id, type: 'request' }
                );
            }
        } catch (e) {
            console.error('Error in request notification:', e);
        }
        
        res.status(200).json({ success: true, message: 'Request sent successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get requests received by a donor (includes accepted/completed for history)
// @route   GET /api/donations/received-requests/:userId
export const getReceivedRequests = async (req, res) => {
    try {
        const { userId } = req.params;
        const donations = await Donation.find({ 
            donor: userId, 
            'requests.0': { $exists: true } 
        }).populate('requests.requester', 'fullName profilePic mobileNumber email location address');
        
        res.status(200).json({ success: true, data: donations });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get requests sent by a user
// @route   GET /api/donations/sent-requests/:userId
export const getSentRequests = async (req, res) => {
    try {
        const { userId } = req.params;
        const donations = await Donation.find({ 
            'requests.requester': userId 
        }).populate('donor', 'fullName profilePic mobileNumber email location address');
        
        // Map to include specific status for the user's request
        const results = donations.map(d => {
            const myReq = d.requests.find(r => r.requester && r.requester.toString() === userId);
            return {
                ...d._doc,
                myRequestStatus: myReq ? myReq.status : 'pending'
            };
        });
        
        res.status(200).json({ success: true, data: results });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Accept a request
// @route   POST /api/donations/:id/accept
export const acceptRequest = async (req, res) => {
    try {
        const { requesterId } = req.body;
        const donationId = req.params.id;
        const donation = await Donation.findById(donationId);
        
        if (!donation) return res.status(404).json({ success: false, message: 'Donation not found' });

        donation.status = 'completed';
        donation.requests.forEach(r => {
            if (r.requester.toString() === requesterId) {
                r.status = 'accepted';
            } else {
                r.status = 'rejected';
            }
        });
        
        await donation.save();
        
        // Update donor stats
        await User.findByIdAndUpdate(donation.donor, { $inc: { donationCount: 1, rewardPoints: 25 } });

        // NOTIFICATION: Notify the requester that their request was accepted
        try {
            const requester = await User.findById(requesterId).select('pushToken');
            if (requester && requester.pushToken) {
                await sendPushNotification(
                    requester.pushToken,
                    'Request Accepted! 🎉',
                    `Great news! Your request for "${donation.title}" has been accepted. You can now coordinate the pickup.`,
                    { donationId: donation._id }
                );
            }
        } catch (e) {
            console.error('Error in acceptance notification:', e);
        }

        res.status(200).json({ success: true, message: 'Request accepted and donation completed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get count of new/pending notifications (requests) for a user
// @route   GET /api/donations/notifications/count/:userId
export const getNotificationCount = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Count 1: Pending requests received on user's donations
        const donations = await Donation.find({ 
            donor: userId, 
            'requests.status': 'pending' 
        });
        
        let totalPending = 0;
        donations.forEach(d => {
            // Only count if the donation itself is not completed/rejected
            if (d.status !== 'completed' && d.status !== 'rejected') {
                totalPending += d.requests.filter(r => r.status === 'pending').length;
            }
        });

        res.status(200).json({ success: true, count: totalPending });
    } catch (error) {
        console.error('Error fetching notification count:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
