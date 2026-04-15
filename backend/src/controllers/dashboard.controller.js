import Request from '../models/request.model.js';
import Donation from '../models/donation.model.js';

export const getNearbyItems = async (req, res) => {
    try {
        const { lng, lat, type, radius = 10, query = '' } = req.query; // type: 'requests' or 'donations'

        if (!lng || !lat) {
            return res.status(400).json({ success: false, message: 'Please provide longitude and latitude' });
        }

        const coordinates = [parseFloat(lng), parseFloat(lat)];
        const maxDistance = parseFloat(radius) * 1000; // Adjustable radius
        
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
        
        let queryFilter = { 
            status: { $in: ['pending', 'available', 'approved'] },
            $or: [
                { category: { $ne: 'Food' } },
                { category: 'Food', createdAt: { $gte: twelveHoursAgo } }
            ]
        };
        if (query) {
            queryFilter.title = { $regex: query, $options: 'i' };
        }

        const Model = type === 'requests' ? Request : Donation;
        const creatorField = type === 'requests' ? 'requester' : 'donor';
        const { excludeUserId } = req.query;

        if (excludeUserId) {
            queryFilter[creatorField] = { $ne: excludeUserId };
        }

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
            ...queryFilter // Include status, optional text search, and exclude user
        }).populate(creatorField, 'fullName profilePic mobileNumber');

        return res.status(200).json({
            success: true,
            data: items,
        });

    } catch (error) {
        console.error('Error fetching nearby items:', error);
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};
