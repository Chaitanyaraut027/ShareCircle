import express from 'express';
import { getProfileHistory } from '../controllers/profile.controller.js';

const router = express.Router();

// GET /api/profile/history/:userId
router.get('/history/:userId', getProfileHistory);

export default router;
