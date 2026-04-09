import express from 'express';
import { 
    acceptRequest, 
    acceptDonation 
} from '../controllers/match.controller.js';

const router = express.Router();

// POST /api/match/accept-request/:id
// Donor accepting a Receiver's request
router.post('/accept-request/:id', acceptRequest);

// POST /api/match/accept-donation/:id
// Receiver accepting a Donor's donation
router.post('/accept-donation/:id', acceptDonation);

export default router;
