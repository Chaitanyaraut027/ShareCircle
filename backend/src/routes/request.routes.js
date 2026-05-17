import express from 'express';
import {
    createRequest,
    getNearbyRequests,
    offerFulfillment,
    acceptOffer,
    getMyRequests,
    getMyOffers
} from '../controllers/request.controller.js';

const router = express.Router();

router.post('/', createRequest);
router.get('/nearby', getNearbyRequests);
router.post('/:id/offer', offerFulfillment);
router.post('/:id/accept-offer', acceptOffer);
router.get('/my/:userId', getMyRequests);
router.get('/offers/:userId', getMyOffers);

export default router;
