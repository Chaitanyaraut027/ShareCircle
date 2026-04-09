import Request from '../models/request.model.js';
import Donation from '../models/donation.model.js';

export const acceptRequest = async (req, res) => {
    try {
        const requestId = req.params.id;
        const { donorId } = req.body; // In realism, this would from req.user
        
        const request = await Request.findById(requestId).populate('requester');
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Request is no longer pending' });
        }

        request.status = 'fulfilled';
        request.fulfilledBy = donorId;
        await request.save();

        // 🚨 Here is where an AI filtering or Notification Service would trigger 🚨
        // We simulate returning WhatsApp/Contact info of the Requester to the Donor
        const contactInfo = {
            name: request.requester.fullName,
            phone: request.requester.mobileNumber || '+1234567890',
            message: `Match triggered! Reach out via WhatsApp.`,
        };

        return res.status(200).json({
            success: true,
            message: 'Request successfully accepted!',
            contact: contactInfo,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const acceptDonation = async (req, res) => {
    try {
        const donationId = req.params.id;
        const { receiverId } = req.body; // In realism, from req.user

        const donation = await Donation.findById(donationId).populate('donor');
        if (!donation) {
            return res.status(404).json({ success: false, message: 'Donation not found' });
        }

        if (donation.status !== 'available' && donation.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Donation is no longer available' });
        }

        donation.status = 'completed';
        // Simplified request array addition
        donation.requests.push({
            requester: receiverId,
            status: 'accepted',
            message: 'Automatically accepted match'
        });
        await donation.save();

        // Simulate returning contact info
        const contactInfo = {
            name: donation.donor.fullName,
            phone: donation.donor.mobileNumber || '+0987654321',
            address: donation.pickupAddress || 'Shared upon contact',
        };

        return res.status(200).json({
            success: true,
            message: 'Donation claimed!',
            contact: contactInfo,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
