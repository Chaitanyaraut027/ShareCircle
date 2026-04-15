import express from 'express';
import { 
    getAllUsers, 
    deleteUser, 
    getAllDonations, 
    deleteDonation,
    getAdminStats
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

export default router;
