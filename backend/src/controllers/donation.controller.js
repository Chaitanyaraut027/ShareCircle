import Donation from '../models/donation.model.js';
import User from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { moderateImage, generateDescriptionFromImage } from '../utils/geminiModeration.js';
import fs from 'fs';
import { sendPushNotification, sendBulkNotifications } from '../utils/notifications.js';

// @desc    Create a new donation (with AI image moderation)
// @route   POST /api/donations
// @access  Private
export const createDonation = async (req, res) => {
    try {
        let { donorId, title, description, category, quantity, homeNo, street, fullAddress, longitude, latitude } = req.body;
        
        // Build the pickupAddress string from individual fields
        const pickupAddress = [homeNo, street, fullAddress].filter(Boolean).join(', ');

        let imageUrl = '';

        if (req.file) {
            // ═══════════════════════════════════════════
            //  STEP 1: AI MODERATION (before Cloudinary)
            // ═══════════════════════════════════════════
            console.log('🛡️ Running AI moderation on uploaded image...');
            const moderationResult = await moderateImage(req.file.path, {
                title,
                category,
                quantity,
                description,
            });

            console.log('🛡️ Moderation verdict:', moderationResult.verdict);

            // ── UNSAFE → Reject immediately ──
            if (moderationResult.verdict === 'unsafe') {
                // Clean up temp file (don't upload to Cloudinary)
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

                console.log('🚫 Donation REJECTED by AI moderation:', moderationResult.reason);
                return res.status(400).json({
                    success: false,
                    moderation: true,
                    message: `Your image was flagged as inappropriate: ${moderationResult.reason}. Please upload a different image.`,
                    moderationDetail: {
                        verdict: 'unsafe',
                        reason: moderationResult.reason,
                        scores: moderationResult.scores,
                    }
                });
            }

            // ── STEP 2: AI DESCRIPTION (if empty) ──
            if (!description || description.trim() === '') {
                console.log('🛡️ Description is empty, generating with AI...');
                const aiDesc = await generateDescriptionFromImage(req.file.path, { title, category });
                if (aiDesc) {
                    description = `[AI Generated] ${aiDesc}`;
                    console.log('🛡️ Generated description:', description);
                }
            }

            // ── SAFE or UNCERTAIN or ERROR → Upload to Cloudinary ──
            const uploaded = await uploadOnCloudinary(req.file.path);
            if (uploaded) {
                imageUrl = uploaded.secure_url;
            } else {
                return res.status(500).json({ success: false, message: 'Image upload failed' });
            }

            // ── Determine donation status based on moderation ──
            let donationStatus = 'approved';      // default for safe
            let moderationStatus = 'approved';

            if (moderationResult.verdict === 'uncertain') {
                donationStatus = 'under_review';
                moderationStatus = 'under_review';
            } else if (moderationResult.verdict === 'error') {
                donationStatus = 'under_review';
                moderationStatus = 'under_review';
            }
            // 'safe' → stays approved

            let expiresAt = null;
            if (category === 'Food') {
                expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 12);
            }

            const donation = new Donation({
                donor: donorId,
                title,
                description,
                category,
                quantity,
                pickupAddress,
                image: imageUrl,
                status: donationStatus,
                expiresAt,
                location: {
                    type: 'Point',
                    coordinates: [parseFloat(longitude) || 0, parseFloat(latitude) || 0]
                },
                moderationResult: {
                    status: moderationStatus,
                    aiVerdict: moderationResult.verdict,
                    aiReason: moderationResult.reason,
                    aiScores: moderationResult.scores || {},
                },
            });

            await donation.save();

            // Update user's donation count and reward points
            await User.findByIdAndUpdate(donorId, {
                $inc: { donationCount: 1, rewardPoints: 10 } 
            });

            // ── SAFE → Broadcast to all users ──
            if (donationStatus === 'approved') {
                try {
                    console.log(`📣 Broadcasting new donation: ${title} from donor: ${donorId}`);
                    const allUsersWithToken = await User.find({
                        pushToken: { $exists: true, $ne: null, $ne: '' }
                    }).select('pushToken');

                    const tokens = allUsersWithToken
                        .map(u => u.pushToken)
                        .filter(t => t && typeof t === 'string' && t.length > 10);

                    console.log(`📱 Found ${tokens.length} valid FCM tokens for broadcasting.`);

                    if (tokens.length > 0) {
                        await sendBulkNotifications(
                            tokens,
                            '🎁 New Donation Posted!',
                            `"${title}" was just posted nearby. Tap to check it out!`,
                            { donationId: String(donation._id), type: 'new_donation' }
                        );
                    }
                } catch (e) {
                    console.error('❌ Error in broadcasting notification:', e);
                }

                return res.status(201).json({
                    success: true,
                    data: donation,
                    message: 'Donation created successfully! ✅',
                    moderationVerdict: 'safe',
                });
            }

            // ── UNDER REVIEW → Notify user + admin ──
            if (donationStatus === 'under_review') {
                // Notify the donor
                try {
                    const donor = await User.findById(donorId).select('pushToken');
                    if (donor && donor.pushToken) {
                        const reviewReason = moderationResult.verdict === 'error'
                            ? 'Our AI verification system is temporarily unavailable.'
                            : `Our AI flagged a minor concern: ${moderationResult.reason}`;

                        await sendPushNotification(
                            donor.pushToken,
                            '🔍 Donation Under Review',
                            `Your donation "${title}" is being reviewed by our team. ${reviewReason} We'll notify you once it's approved. Thank you for your patience!`,
                            { donationId: String(donation._id), type: 'under_review' }
                        );
                    }
                } catch (e) {
                    console.error('❌ Error notifying donor about review:', e);
                }

                // Notify all admins
                try {
                    const admins = await User.find({
                        role: 'admin',
                        pushToken: { $exists: true, $ne: null, $ne: '' }
                    }).select('pushToken');

                    const adminTokens = admins
                        .map(a => a.pushToken)
                        .filter(t => t && typeof t === 'string' && t.length > 10);

                    console.log(`📱 Found ${adminTokens.length} admin tokens for review notification.`);

                    if (adminTokens.length > 0) {
                        const adminReason = moderationResult.verdict === 'error'
                            ? 'AI moderation failed — manual review required.'
                            : `AI flagged: ${moderationResult.reason}`;

                        await sendBulkNotifications(
                            adminTokens,
                            '⚠️ Donation Needs Review',
                            `"${title}" requires manual review. ${adminReason}`,
                            { donationId: String(donation._id), type: 'admin_review' }
                        );
                    }
                } catch (e) {
                    console.error('❌ Error notifying admins about review:', e);
                }

                return res.status(201).json({
                    success: true,
                    data: donation,
                    message: 'Your donation has been submitted and is under review. Our team will verify it shortly — you\'ll receive a notification once approved! 🙏',
                    moderationVerdict: 'under_review',
                });
            }
        }

        // ── No image uploaded — save normally ──
        let expiresAt = null;
        if (category === 'Food') {
            expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 12);
        }

        const donation = new Donation({
            donor: donorId,
            title,
            description,
            category,
            quantity,
            pickupAddress,
            image: imageUrl,
            status: 'approved',
            expiresAt,
            location: {
                type: 'Point',
                coordinates: [parseFloat(longitude) || 0, parseFloat(latitude) || 0]
            },
            moderationResult: {
                status: 'approved',
                aiVerdict: 'safe',
                aiReason: 'No image uploaded — text-only donation',
            },
        });

        await donation.save();

        await User.findByIdAndUpdate(donorId, {
            $inc: { donationCount: 1, rewardPoints: 10 } 
        });

        // Broadcast
        try {
            const allUsersWithToken = await User.find({
                pushToken: { $exists: true, $ne: null, $ne: '' }
            }).select('pushToken');

            const tokens = allUsersWithToken
                .map(u => u.pushToken)
                .filter(t => t && typeof t === 'string' && t.length > 10);

            console.log(`📱 Found ${tokens.length} valid FCM tokens for broadcasting (no-image).`);

            if (tokens.length > 0) {
                await sendBulkNotifications(
                    tokens,
                    '🎁 New Donation Posted!',
                    `"${title}" was just posted nearby. Tap to check it out!`,
                    { donationId: String(donation._id), type: 'new_donation' }
                );
            }
        } catch (e) {
            console.error('❌ Error in broadcasting notification:', e);
        }

        res.status(201).json({
            success: true,
            data: donation,
            message: 'Donation created successfully!'
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
        const { title, category, quantity } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            console.error('❌ GEMINI_API_KEY is not set in environment variables!');
            return res.status(503).json({ success: false, message: 'AI service not configured. GEMINI_API_KEY missing on server.' });
        }

        if (!title || !category) {
            return res.status(400).json({ success: false, message: 'Title and category are required' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        let text = "";
        let success = false;
        let lastErrorMsg = "";

        try {
            console.log(`🔄 Trying Gemini model: gemini-flash-lite-latest...`);
            const model = genAI.getGenerativeModel({ 
                model: "gemini-flash-lite-latest",
                generationConfig: {
                    maxOutputTokens: 60, // Restrict output to save tokens
                    temperature: 0.7,
                }
            });
            // Keep prompt extremely brief to save input tokens
            const prompt = `Write exactly 1 friendly sentence for a donation description. It MUST explicitly state the item name ("${title}"), its category ("${category}"), and the quantity (${quantity || '1'}).`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            text = response.text();

            if (text && text.trim().length > 0) {
                success = true;
                console.log(`✅ Success with model: gemini-flash-lite-latest`);
            }
        } catch (err) {
            console.warn(`❌ Model gemini-flash-lite-latest failed: ${err.message}`);
            lastErrorMsg = err.message;
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

        let findQuery = {
            // Only show donations that passed moderation (hide under_review + rejected)
            status: { $nin: ['under_review', 'rejected'] }
        };

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
                    '\uD83D\uDCCB New Request Received!',
                    `${requester?.fullName || 'Someone'} has requested your "${donation.title}".`,
                    { donationId: String(donation._id), type: 'request' }   // MUST be strings
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
                    '\uD83C\uDF89 Request Accepted!',
                    `Your request for "${donation.title}" was accepted! Coordinate the pickup now.`,
                    { donationId: String(donation._id), type: 'accepted' }  // MUST be strings
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
