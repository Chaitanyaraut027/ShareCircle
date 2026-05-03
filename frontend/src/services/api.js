import axios from 'axios';
import { API_URL } from '../utils/constants';
console.log("🌐 API BASE URL:", API_URL);


const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to attach auth token if available
api.interceptors.request.use(async (config) => {
  try {
     const token = await AsyncStorage.getItem('token');
     if (token) {
       config.headers.Authorization = `Bearer ${token}`;
     }
  } catch(e) { /* ignore */ }
  return config;
});

export const loginUser = async (email, password) => {
    try {
        const response = await api.post('/auth/login', { email, password });
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data : { message: 'Network Error' };
    }
};

export const registerUser = async (userData) => {
    try {
        const response = await api.post('/auth/register', userData);
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data : { message: 'Network Error' };
    }
};

export const getNearbyItems = async (lng, lat, type, radius = 50, excludeUserId = null) => {
    try {
        let url = `/dashboard/nearby?lng=${lng}&lat=${lat}&type=${type}&radius=${radius}`;
        if (excludeUserId) {
            url += `&excludeUserId=${excludeUserId}`;
        }
        const response = await api.get(url);
        return response.data;
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, data: [] };
    }
};

export const acceptRequestMatch = async (requestId, donorId) => {
    try {
        const response = await api.post(`/match/accept-request/${requestId}`, { donorId });
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data : { message: 'Network Error' };
    }
};

export const acceptDonationMatch = async (donationId, receiverId) => {
    try {
        const response = await api.post(`/match/accept-donation/${donationId}`, { receiverId });
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data : { message: 'Network Error' };
    }
};

export const getUserHistory = async (userId) => {
    try {
        const response = await api.get(`/profile/history/${userId}`);
        return response.data;
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, data: { donated: [], received: [] } };
    }
};

export const updateUserLocation = async (userId, latitude, longitude, address, homeNo = '', street = '', landmark = '', city = '', state = '') => {
    try {
        const response = await api.put('/auth/update-location', { 
            userId, latitude, longitude, address, homeNo, street, landmark, city, state 
        });
        return response.data;
    } catch (error) {
        console.error('API Error updating location:', error);
        return { success: false };
    }
};

export const updateProfilePicture = async (userId, imageUri) => {
    try {
        const formData = new FormData();
        formData.append('userId', userId);
        const filename = imageUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;
        formData.append('image', { uri: imageUri, name: filename, type });

        const response = await api.put('/auth/update-profile-picture', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    } catch (error) {
        console.error('API Error updating profile picture:', error);
        return { success: false };
    }
};

export const getNotificationCount = async (userId) => {
    try {
        const response = await api.get(`/donations/notifications/count/${userId}`);
        return response.data;
    } catch (error) {
        console.error('API Error fetching notification count:', error);
        return { success: false, count: 0 };
    }
};

// ADMIN API CALLS
export const getAdminStats = async () => {
    try {
        const res = await api.get('/admin/stats');
        return res.data;
    } catch (e) {
        return { success: false };
    }
};

export const getAdminUsers = async () => {
    try {
        const res = await api.get('/admin/users');
        return res.data;
    } catch (e) {
        return { success: false, data: [] };
    }
};

export const deleteAdminUser = async (userId) => {
    try {
        const res = await api.delete(`/admin/users/${userId}`);
        return res.data;
    } catch (e) {
        return { success: false };
    }
};

export const getAdminDonations = async () => {
    try {
        const res = await api.get('/admin/donations');
        return res.data;
    } catch (e) {
        return { success: false, data: [] };
    }
};

export const deleteAdminDonation = async (donationId, reason = '') => {
    try {
        const res = await api.delete(`/admin/donations/${donationId}`, { data: { reason } });
        return res.data;
    } catch (e) {
        return { success: false };
    }
};

// ADMIN — AI MODERATION REVIEW QUEUE
export const getReviewQueue = async () => {
    try {
        const res = await api.get('/admin/review-queue');
        return res.data;
    } catch (e) {
        return { success: false, data: [] };
    }
};

export const approveReviewDonation = async (donationId, adminNote = '') => {
    try {
        const res = await api.put(`/admin/review/${donationId}/approve`, { adminNote });
        return res.data;
    } catch (e) {
        return { success: false };
    }
};

export const rejectReviewDonation = async (donationId, adminNote = '') => {
    try {
        const res = await api.put(`/admin/review/${donationId}/reject`, { adminNote });
        return res.data;
    } catch (e) {
        return { success: false };
    }
};

export default api;
