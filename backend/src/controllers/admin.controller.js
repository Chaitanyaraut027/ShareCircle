import User from '../models/user.model.js';
import Donation from '../models/donation.model.js';

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
        const donation = await Donation.findById(donationId);
        
        if (!donation) {
            return res.status(404).json({ success: false, message: 'Donation not found' });
        }

        await Donation.findByIdAndDelete(donationId);
        
        res.status(200).json({ success: true, message: 'Donation deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
export const getAdminStats = async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const donationCount = await Donation.countDocuments();
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
                pendingRequests: pendingRequests[0]?.count || 0
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
