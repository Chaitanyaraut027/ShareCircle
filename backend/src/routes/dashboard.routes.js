import express from 'express';
import { getNearbyItems } from '../controllers/dashboard.controller.js';
// We should protect routes with auth middleware, assuming a simple implementation for now.

const router = express.Router();

// GET /api/dashboard/nearby?lng=...&lat=...&type=donations
router.get('/nearby', getNearbyItems);

export default router;
