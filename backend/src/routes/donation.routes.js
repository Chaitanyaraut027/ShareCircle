import express from 'express';
import { 
    createDonation, 
    generateAIDescription, 
    getNearbyDonations,
    requestItem,
    getReceivedRequests,
    getSentRequests,
    acceptRequest,
    getNotificationCount
} from '../controllers/donation.controller.js';
import { upload } from '../middleware/multer.js';

const router = express.Router();

router.post('/', upload.single('image'), createDonation);
router.post('/generate-description', generateAIDescription);
router.get('/nearby', getNearbyDonations);
router.post('/:id/request', requestItem);
router.get('/received-requests/:userId', getReceivedRequests);
router.get('/sent-requests/:userId', getSentRequests);
router.post('/:id/accept', acceptRequest);
router.get('/notifications/count/:userId', getNotificationCount);

export default router;
