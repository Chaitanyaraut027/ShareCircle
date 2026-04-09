import Request from '../models/request.model.js';
import Donation from '../models/donation.model.js';

export const getNearbyItems = async (req, res) => {
    try {
        const { lng, lat, type } = req.query; // type: 'requests' or 'donations'

        if (!lng || !lat) {
            return res.status(400).json({ success: false, message: 'Please provide longitude and latitude' });
        }

        const coordinates = [parseFloat(lng), parseFloat(lat)];
        const maxDistance = 10000; // 10km radius

        const Model = type === 'requests' ? Request : Donation;

        const items = await Model.find({
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates,
                    },
                    $maxDistance: maxDistance,
                },
            },
            status: { $in: ['pending', 'available'] } // Only fetch open requests/donations
        }).populate(type === 'requests' ? 'requester' : 'donor', 'fullName profilePic');

        return res.status(200).json({
            success: true,
            data: items,
        });

    } catch (error) {
        console.error('Error fetching nearby items:', error);
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};
