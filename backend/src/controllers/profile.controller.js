import Request from '../models/request.model.js';
import Donation from '../models/donation.model.js';

export const getProfileHistory = async (req, res) => {
    try {
        const userId = req.params.userId;

        // Fetch donations made by the user
        const donations = await Donation.find({ donor: userId });

        // Fetch requests made by the user
        const requests = await Request.find({ requester: userId });

        // Fetch donations the user has received (where they are in requests array as accepted)
        const receivedDonations = await Donation.find({
            requests: {
                $elemMatch: {
                    requester: userId,
                    status: 'accepted'
                }
            }
        });

        // Fetch requests fulfilled by user
        const fulfilledRequests = await Request.find({ fulfilledBy: userId });

        const mapDonations = (list) => list.map(i => ({...i._doc, itemType: 'donation'}));
        const mapNeeds = (list) => list.map(i => ({...i._doc, itemType: 'need'}));

        return res.status(200).json({
            success: true,
            data: {
                donated: [...mapDonations(donations), ...mapNeeds(fulfilledRequests)],
                received: [...mapNeeds(requests), ...mapDonations(receivedDonations)]
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error fetching history' });
    }
};
