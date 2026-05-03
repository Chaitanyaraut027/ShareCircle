import express from 'express';
import { 
    getAllUsers, 
    deleteUser, 
    getAllDonations, 
    deleteDonation,
    getAdminStats,
    getReviewQueue,
    approveDonation,
    rejectDonation
} from '../controllers/admin.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes here require being logged in and having the 'admin' role
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getAdminStats);
router.get('/users', getAllUsers);
router.delete('/users/:id', deleteUser);
router.get('/donations', getAllDonations);
router.delete('/donations/:id', deleteDonation);

// AI Moderation — Review Queue
router.get('/review-queue', getReviewQueue);
router.put('/review/:id/approve', approveDonation);
router.put('/review/:id/reject', rejectDonation);

export default router;
