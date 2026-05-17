import User from '../models/user.model.js';
import Donation from '../models/donation.model.js';
import Request from '../models/request.model.js';
import { sendPushNotification, sendBulkNotifications } from '../utils/notifications.js';

// @desc    Get all users with basic stats
// @route   GET /api/admin/users
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Delete a user and their associated donations
// @route   DELETE /api/admin/users/:id
export const deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Prevent deleting other admins if necessary, but for now allow full control
        
        // Remove all donations by this user
        await Donation.deleteMany({ donor: userId });
        
        // Remove the user
        await User.findByIdAndDelete(userId);

        res.status(200).json({ success: true, message: 'User and their donations removed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get all donations
// @route   GET /api/admin/donations
export const getAllDonations = async (req, res) => {
    try {
        const donations = await Donation.find({})
            .populate('donor', 'fullName email mobileNumber profilePic')
            .populate('requests.requester', 'fullName email mobileNumber')
            .sort({ createdAt: -1 })
            .lean();
            
        const requests = await Request.find({})
            .populate('requester', 'fullName email mobileNumber profilePic')
            .sort({ createdAt: -1 })
            .lean();

        const formattedDonations = donations.map(d => ({ ...d, itemType: 'donation' }));
        const formattedRequests = requests.map(r => ({ ...r, donor: r.requester, itemType: 'need', image: null }));
        
        const combined = [...formattedDonations, ...formattedRequests].sort((a,b) => b.createdAt - a.createdAt);

        res.status(200).json({ success: true, count: combined.length, data: combined });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Delete any donation
// @route   DELETE /api/admin/donations/:id
export const deleteDonation = async (req, res) => {
    try {
        const donationId = req.params.id;
        const { reason } = req.body || {};
        
        let item = await Donation.findById(donationId);
        let isNeed = false;
        if (!item) {
            item = await Request.findById(donationId);
            if (item) isNeed = true;
        }
        
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        const title = item.title;
        const donorId = isNeed ? item.requester : item.donor;

        if (isNeed) {
            await Request.findByIdAndDelete(donationId);
        } else {
            await Donation.findByIdAndDelete(donationId);
        }
        
        // Notify the user about deletion
        try {
            const donor = await User.findById(donorId).select('pushToken');
            if (donor && donor.pushToken) {
                const deletionReason = reason ? `Reason: ${reason}` : 'It was removed by an administrator.';
                const typeName = isNeed ? 'Need Request' : 'Donation';
                await sendPushNotification(
                    donor.pushToken,
                    `🗑️ ${typeName} Deleted`,
                    `Your ${typeName.toLowerCase()} "${title}" has been deleted. ${deletionReason}`,
                    { type: 'item_deleted' }
                );
            }
        } catch (e) {
            console.error('Error sending deletion notification:', e);
        }

        res.status(200).json({ success: true, message: 'Item deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get admin dashboard stats (includes review queue count)
// @route   GET /api/admin/stats
export const getAdminStats = async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const donationCount = await Donation.countDocuments();
        const reviewQueueCount = await Donation.countDocuments({ status: 'under_review' });
        const pendingRequests = await Donation.aggregate([
            { $unwind: "$requests" },
            { $match: { "requests.status": "pending" } },
            { $count: "count" }
        ]);

        res.status(200).json({
            success: true,
            data: {
                users: userCount,
                donations: donationCount,
                pendingRequests: pendingRequests[0]?.count || 0,
                reviewQueue: reviewQueueCount,
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// ═══════════════════════════════════════════════════════
//  AI MODERATION — ADMIN REVIEW QUEUE
// ═══════════════════════════════════════════════════════

// @desc    Get all donations pending admin review
// @route   GET /api/admin/review-queue
export const getReviewQueue = async (req, res) => {
    try {
        const donations = await Donation.find({ status: 'under_review' })
            .populate('donor', 'fullName email mobileNumber profilePic')
            .sort({ createdAt: -1 })
            .lean();

        const requests = await Request.find({ status: 'under_review' })
            .populate('requester', 'fullName email mobileNumber profilePic')
            .sort({ createdAt: -1 })
            .lean();

        const formattedDonations = donations.map(d => ({ ...d, itemType: 'donation' }));
        const formattedRequests = requests.map(r => ({ ...r, donor: r.requester, itemType: 'need', image: null }));

        const combined = [...formattedDonations, ...formattedRequests].sort((a,b) => b.createdAt - a.createdAt);

        res.status(200).json({ success: true, count: combined.length, data: combined });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Admin approves a donation from review queue
// @route   PUT /api/admin/review/:id/approve
export const approveDonation = async (req, res) => {
    try {
        const donationId = req.params.id;
        const { adminNote } = req.body;

        let item = await Donation.findById(donationId);
        let isNeed = false;
        
        if (!item) {
            item = await Request.findById(donationId);
            if (item) isNeed = true;
        }

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        if (item.status !== 'under_review') {
            return res.status(400).json({ success: false, message: 'This item is not in the review queue' });
        }

        // Update status to approved (pending for needs is the "approved" state)
        item.status = isNeed ? 'pending' : 'approved';
        item.moderationResult.status = 'approved';
        item.moderationResult.adminNote = adminNote || 'Approved by admin after manual review';
        item.moderationResult.reviewedBy = req.user._id;
        item.moderationResult.reviewedAt = new Date();
        await item.save();

        // Notify the user — their item is approved!
        const ownerId = isNeed ? item.requester : item.donor;
        const typeName = isNeed ? 'Need Request' : 'Donation';
        
        try {
            const owner = await User.findById(ownerId).select('pushToken fullName');
            if (owner && owner.pushToken) {
                await sendPushNotification(
                    owner.pushToken,
                    `✅ ${typeName} Approved!`,
                    `Great news! Your ${typeName.toLowerCase()} "${item.title}" has been reviewed and approved. It's now visible to everyone on ShareCircle!`,
                    { itemId: String(item._id), type: 'moderation_approved' }
                );
            }
        } catch (e) {
            console.error('❌ Error notifying user about approval:', e);
        }

        // Broadcast to all users — new item available!
        try {
            let query = {
                _id: { $ne: ownerId },
                pushToken: { $exists: true, $ne: null, $ne: '' }
            };

            if (item.location && item.location.coordinates && item.location.coordinates.length === 2) {
                const lng = item.location.coordinates[0];
                const lat = item.location.coordinates[1];
                if (lng !== 0 && lat !== 0) {
                    query.location = {
                        $geoWithin: {
                            $centerSphere: [[lng, lat], 100 / 6378.1] // 100 km radius
                        }
                    };
                }
            }

            const allUsersWithToken = await User.find(query).select('pushToken');

            const tokens = allUsersWithToken
                .map(u => u.pushToken)
                .filter(t => t && typeof t === 'string' && t.length > 10);

            if (tokens.length > 0) {
                const broadcastTitle = isNeed ? '📢 New Need Request!' : '🎁 New Donation Posted!';
                const broadcastBody = isNeed 
                    ? `Someone nearby needs "${item.title}". Tap to see if you can help!`
                    : `"${item.title}" was just posted nearby. Tap to check it out!`;
                
                await sendBulkNotifications(
                    tokens,
                    broadcastTitle,
                    broadcastBody,
                    { itemId: String(item._id), type: isNeed ? 'new_request' : 'new_donation' }
                );
            }
        } catch (e) {
            console.error('❌ Error broadcasting approved item:', e);
        }

        res.status(200).json({
            success: true,
            message: `${typeName} "${item.title}" approved and is now live!`,
            data: item
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Admin rejects a donation from review queue
// @route   PUT /api/admin/review/:id/reject
export const rejectDonation = async (req, res) => {
    try {
        const donationId = req.params.id;
        const { adminNote } = req.body;

        let item = await Donation.findById(donationId);
        let isNeed = false;
        
        if (!item) {
            item = await Request.findById(donationId);
            if (item) isNeed = true;
        }

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        if (item.status !== 'under_review') {
            return res.status(400).json({ success: false, message: 'This item is not in the review queue' });
        }

        // Update status to rejected
        item.status = 'rejected';
        item.moderationResult.status = 'rejected';
        item.moderationResult.adminNote = adminNote || 'Rejected by admin after manual review';
        item.moderationResult.reviewedBy = req.user._id;
        item.moderationResult.reviewedAt = new Date();
        await item.save();

        const ownerId = isNeed ? item.requester : item.donor;
        const typeName = isNeed ? 'Need Request' : 'Donation';

        // Notify the user — their item was rejected
        try {
            const owner = await User.findById(ownerId).select('pushToken fullName');
            if (owner && owner.pushToken) {
                const reason = adminNote
                    ? `Reason: ${adminNote}`
                    : 'It did not meet our community guidelines.';

                await sendPushNotification(
                    owner.pushToken,
                    `❌ ${typeName} Not Approved`,
                    `We're sorry, but your ${typeName.toLowerCase()} "${item.title}" was not approved after review. ${reason}`,
                    { itemId: String(item._id), type: 'moderation_rejected' }
                );
            }
        } catch (e) {
            console.error('❌ Error notifying user about rejection:', e);
        }

        res.status(200).json({
            success: true,
            message: `${typeName} "${item.title}" has been rejected.`,
            data: item
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
