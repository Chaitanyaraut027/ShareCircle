import axios from 'axios';
import { API_URL } from '../utils/constants';
console.log("🌐 API BASE URL:", API_URL);


const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to attach auth token if available (later)
// api.interceptors.request.use(async (config) => {
//   // const token = await AsyncStorage.getItem('token');
//   // if (token) {
//   //   config.headers.Authorization = `Bearer ${token}`;
//   // }
//   return config;
// });

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

export const getNearbyItems = async (lng, lat, type) => {
    try {
        const response = await api.get(`/dashboard/nearby?lng=${lng}&lat=${lat}&type=${type}`);
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

export default api;
