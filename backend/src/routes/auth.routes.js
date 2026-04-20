import express from 'express';
import { register, login, logout, updateLocation, updateProfilePicture, updatePushToken, updateProfile } from '../controllers/auth.controller.js';

import { protect } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/multer.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/logout', protect, logout);
router.put('/update-location', updateLocation);
router.put('/update-push-token', updatePushToken);
router.put('/update-profile', updateProfile);


// New profile picture upload route
router.put('/update-profile-picture', upload.single('image'), updateProfilePicture);

export default router;
