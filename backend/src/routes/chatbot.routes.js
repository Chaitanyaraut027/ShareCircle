import express from 'express';
import { handleChat } from '../controllers/chatbot.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/chat', protect, handleChat);

export default router;
