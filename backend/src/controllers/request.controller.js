import Request from '../models/request.model.js';
import User from '../models/user.model.js';
import { sendPushNotification, sendBulkNotifications } from '../utils/notifications.js';
import { moderateText } from '../utils/geminiModeration.js';

// @desc    Create a new need request
// @route   POST /api/requests
// @access  Private
export const createRequest = async (req, res) => {
    try {
        const { requesterId, title, description, category, quantity, longitude, latitude } = req.body;

        // ── Moderate Text ──
        const moderationResult = await moderateText({ title, category, quantity, description });
        
        if (moderationResult.verdict === 'unsafe') {
            return res.status(400).json({
                success: false,
                message: 'Your request was rejected because it violates community guidelines.',
                reason: moderationResult.reason
            });
        }

        const isUnderReview = moderationResult.verdict === 'uncertain' || moderationResult.verdict === 'error';
        const initialStatus = isUnderReview ? 'under_review' : 'pending';

        const newRequest = new Request({
            requester: requesterId,
            title,
            description,
            category,
            quantity,
            status: initialStatus,
            moderationResult: {
                status: isUnderReview ? 'under_review' : 'approved',
                aiVerdict: moderationResult.verdict,
                aiReason: moderationResult.reason,
                aiScores: moderationResult.scores,
            },
            location: {
                type: 'Point',
                coordinates: [parseFloat(longitude) || 0, parseFloat(latitude) || 0]
            }
        });

        await newRequest.save();

        if (isUnderReview) {
            // Notify User
            const user = await User.findById(requesterId).select('pushToken fullName');
            if (user && user.pushToken) {
                await sendPushNotification(
                    user.pushToken,
                    '🛡️ Request Under Review',
                    'Your need request is being reviewed by our team to ensure it meets community guidelines. We will notify you once it is approved.',
                    { requestId: String(newRequest._id), type: 'moderation_pending' }
                );
            }
            
            // Notify Admins
            const admins = await User.find({ role: 'admin', pushToken: { $exists: true, $ne: null } });
            const adminTokens = admins.map(a => a.pushToken);
            if (adminTokens.length > 0) {
                await sendBulkNotifications(
                    adminTokens,
                    '🛡️ Review Required (Need Request)',
                    `A new need request by ${user.fullName} requires your manual review.`,
                    { requestId: String(newRequest._id), type: 'admin_review_required' }
                );
            }

            return res.status(201).json({
                success: true,
                data: newRequest,
                message: 'Your request has been submitted for manual review.'
            });
        }

        // Broadcast to all other users if safe
        try {
            const lng = parseFloat(longitude) || 0;
            const lat = parseFloat(latitude) || 0;
            
            let query = {
                _id: { $ne: requesterId },
                pushToken: { $exists: true, $ne: null, $ne: '' }
            };

            if (lng !== 0 && lat !== 0) {
                query.location = {
                    $geoWithin: {
                        $centerSphere: [[lng, lat], 100 / 6378.1] // 100 km radius
                    }
                };
            }

            const allUsersWithToken = await User.find(query).select('pushToken');

            const tokens = allUsersWithToken
                .map(u => u.pushToken)
                .filter(t => t && typeof t === 'string' && t.length > 10);

            if (tokens.length > 0) {
                await sendBulkNotifications(
                    tokens,
                    '📢 New Need Request!',
                    `Someone nearby needs "${title}". Tap to see if you can help!`,
                    { requestId: String(newRequest._id), type: 'new_request' }
                );
            }
        } catch (e) {
            console.error('❌ Error in broadcasting need request notification:', e);
        }

        res.status(201).json({
            success: true,
            data: newRequest,
            message: 'Need request posted successfully!'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get nearby requests
// @route   GET /api/requests/nearby
// @access  Public
export const getNearbyRequests = async (req, res) => {
    try {
        const { latitude, longitude, radius = 100, category = 'all' } = req.query;

        let findQuery = {
            status: 'pending' // Only show pending requests
        };

        if (category && category.toLowerCase() !== 'all') {
            findQuery.category = category;
        }

        if (latitude && longitude) {
            const lat = parseFloat(latitude);
            const lng = parseFloat(longitude);
            if (!isNaN(lat) && !isNaN(lng)) {
                // radius is in meters according to frontend requirement "adjust radius upto 100 meters"
                // Actually usually in km, but user said "upto 100 meters". Wait. Let's assume radius query is in km, so 0.1 for 100 meters. Wait, frontend will send radius in km or meters? Let's treat radius parameter as meters directly if the user said "100 meters". Wait, the other APIs use radius in km. Let's check `donation.controller.js`: `const maxDistance = parseFloat(radius) * 1000;`. It expects km.
                // Let's use `maxDistance = parseFloat(radius) * 1000;` assuming radius is in km.
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

        const requests = await Request.find(findQuery)
            .populate('requester', 'fullName mobileNumber profilePic');

        res.status(200).json({
            success: true,
            count: requests.length,
            data: requests
        });

    } catch (error) {
        console.error('Error fetching nearby requests:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Donor offers to fulfill a request
// @route   POST /api/requests/:id/offer
// @access  Private
export const offerFulfillment = async (req, res) => {
    try {
        const { donorId } = req.body;
        const requestId = req.params.id;

        const request = await Request.findById(requestId).populate('requester', 'pushToken');
        if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

        if (request.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Request is no longer pending' });
        }

        const alreadyOffered = request.offers.find(o => o.user.toString() === donorId);
        if (alreadyOffered) return res.status(400).json({ success: false, message: 'You have already offered to fulfill this request' });

        request.offers.push({ user: donorId });
        await request.save();

        // Notify the needful user
        const donor = await User.findById(donorId).select('fullName');
        if (request.requester && request.requester.pushToken) {
            await sendPushNotification(
                request.requester.pushToken,
                '🤝 Help is on the way!',
                `${donor.fullName} is ready to fulfill your need for "${request.title}".`,
                { requestId: String(request._id), type: 'offer_received' }
            );
        }

        res.status(200).json({ success: true, message: 'Offer sent successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Needful user accepts an offer
// @route   POST /api/requests/:id/accept-offer
// @access  Private
export const acceptOffer = async (req, res) => {
    try {
        const { offerUserId } = req.body;
        const requestId = req.params.id;

        const request = await Request.findById(requestId);
        if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

        if (request.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Request already fulfilled or cancelled' });
        }

        const offer = request.offers.find(o => o.user.toString() === offerUserId);
        if (!offer) return res.status(404).json({ success: false, message: 'Offer not found' });

        offer.status = 'accepted';
        request.status = 'fulfilled';
        request.fulfilledBy = offerUserId;

        // Reject other offers
        request.offers.forEach(o => {
            if (o.user.toString() !== offerUserId) {
                o.status = 'rejected';
            }
        });

        await request.save();

        // Notify the donor
        const offerUser = await User.findById(offerUserId).select('pushToken');
        if (offerUser && offerUser.pushToken) {
            await sendPushNotification(
                offerUser.pushToken,
                '🎉 Offer Accepted!',
                `Your offer to fulfill "${request.title}" has been accepted. Coordinate the handover now.`,
                { requestId: String(request._id), type: 'offer_accepted' }
            );
        }

        res.status(200).json({ success: true, message: 'Offer accepted and request fulfilled' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get requests made by user
// @route   GET /api/requests/my/:userId
// @access  Private
export const getMyRequests = async (req, res) => {
    try {
        const { userId } = req.params;
        const requests = await Request.find({ requester: userId })
            .populate('offers.user', 'fullName profilePic mobileNumber location');

        res.status(200).json({ success: true, data: requests });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get offers received by user on requests
// @route   GET /api/requests/offers/:userId
// @access  Private
export const getMyOffers = async (req, res) => {
    try {
        const { userId } = req.params;
        // Find requests where the user has made an offer
        const requests = await Request.find({ 'offers.user': userId })
            .populate('requester', 'fullName profilePic mobileNumber location');

        // Map to include status of the offer
        const results = requests.map(r => {
            const myOffer = r.offers.find(o => o.user.toString() === userId);
            return {
                ...r._doc,
                myOfferStatus: myOffer ? myOffer.status : 'pending'
            };
        });

        res.status(200).json({ success: true, data: results });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
