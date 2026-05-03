import User from '../models/user.model.js';
import Donation from '../models/donation.model.js';
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
            .sort({ createdAt: -1 });
            
        res.status(200).json({ success: true, count: donations.length, data: donations });
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
        const donation = await Donation.findById(donationId);
        
        if (!donation) {
            return res.status(404).json({ success: false, message: 'Donation not found' });
        }

        const title = donation.title;
        const donorId = donation.donor;

        await Donation.findByIdAndDelete(donationId);
        
        // Notify the user about deletion
        try {
            const donor = await User.findById(donorId).select('pushToken');
            if (donor && donor.pushToken) {
                const deletionReason = reason ? `Reason: ${reason}` : 'It was removed by an administrator.';
                await sendPushNotification(
                    donor.pushToken,
                    '🗑️ Donation Deleted',
                    `Your donation "${title}" has been deleted. ${deletionReason}`,
                    { type: 'donation_deleted' }
                );
            }
        } catch (e) {
            console.error('Error sending deletion notification:', e);
        }

        res.status(200).json({ success: true, message: 'Donation deleted successfully' });
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
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: donations.length, data: donations });
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

        const donation = await Donation.findById(donationId);
        if (!donation) {
            return res.status(404).json({ success: false, message: 'Donation not found' });
        }

        if (donation.status !== 'under_review') {
            return res.status(400).json({ success: false, message: 'This donation is not in the review queue' });
        }

        // Update status to approved
        donation.status = 'approved';
        donation.moderationResult.status = 'approved';
        donation.moderationResult.adminNote = adminNote || 'Approved by admin after manual review';
        donation.moderationResult.reviewedBy = req.user._id;
        donation.moderationResult.reviewedAt = new Date();
        await donation.save();

        // Notify the donor — their donation is approved!
        try {
            const donor = await User.findById(donation.donor).select('pushToken fullName');
            if (donor && donor.pushToken) {
                await sendPushNotification(
                    donor.pushToken,
                    '✅ Donation Approved!',
                    `Great news! Your donation "${donation.title}" has been reviewed and approved. It's now visible to everyone on ShareCircle!`,
                    { donationId: String(donation._id), type: 'moderation_approved' }
                );
            }
        } catch (e) {
            console.error('❌ Error notifying donor about approval:', e);
        }

        // Broadcast to all users — new donation available!
        try {
            const allUsersWithToken = await User.find({
                _id: { $ne: donation.donor },
                pushToken: { $exists: true, $ne: null, $ne: '' }
            }).select('pushToken');

            const tokens = allUsersWithToken
                .map(u => u.pushToken)
                .filter(t => t && typeof t === 'string' && t.length > 10);

            if (tokens.length > 0) {
                await sendBulkNotifications(
                    tokens,
                    '🎁 New Donation Posted!',
                    `"${donation.title}" was just posted nearby. Tap to check it out!`,
                    { donationId: String(donation._id), type: 'new_donation' }
                );
            }
        } catch (e) {
            console.error('❌ Error broadcasting approved donation:', e);
        }

        res.status(200).json({
            success: true,
            message: `Donation "${donation.title}" approved and is now live!`,
            data: donation
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

        const donation = await Donation.findById(donationId);
        if (!donation) {
            return res.status(404).json({ success: false, message: 'Donation not found' });
        }

        if (donation.status !== 'under_review') {
            return res.status(400).json({ success: false, message: 'This donation is not in the review queue' });
        }

        // Update status to rejected
        donation.status = 'rejected';
        donation.moderationResult.status = 'rejected';
        donation.moderationResult.adminNote = adminNote || 'Rejected by admin after manual review';
        donation.moderationResult.reviewedBy = req.user._id;
        donation.moderationResult.reviewedAt = new Date();
        await donation.save();

        // Notify the donor — their donation was rejected
        try {
            const donor = await User.findById(donation.donor).select('pushToken fullName');
            if (donor && donor.pushToken) {
                const reason = adminNote
                    ? `Reason: ${adminNote}`
                    : 'It did not meet our community guidelines.';

                await sendPushNotification(
                    donor.pushToken,
                    '❌ Donation Not Approved',
                    `We're sorry, but your donation "${donation.title}" was not approved after review. ${reason} You can try posting again with a different image.`,
                    { donationId: String(donation._id), type: 'moderation_rejected' }
                );
            }
        } catch (e) {
            console.error('❌ Error notifying donor about rejection:', e);
        }

        res.status(200).json({
            success: true,
            message: `Donation "${donation.title}" has been rejected.`,
            data: donation
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
