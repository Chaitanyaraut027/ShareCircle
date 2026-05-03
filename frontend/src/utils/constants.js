import { Platform } from 'react-native';

const getApiUrl = () => {
    // PRODUCTION (Render)
    // return 'https://sharecircle-xjq0.onrender.com/api';
    
    // LOCAL DEVELOPMENT
    if (Platform.OS === 'web') {
        return 'http://localhost:5000/api';
    } else {
        return 'http://192.168.133.117:5000/api';
    }
};

export const API_URL = getApiUrl();

export const TAGLINES = [
    "Share what you have. Change someone’s world.",
    "Your extra can be someone’s essential.",
    "Connecting hearts through giving.",
    "Donate nearby. Help instantly.",
    "Because sharing is humanity."
];

export const COLORS = {
    primary: '#4CAF50', // Green for giving/nature
    secondary: '#2196F3', // Blue for trust
    accent: '#FF9800', // Orange for warmth
    background: '#F5F5F5',
    text: '#333333',
    white: '#FFFFFF',
    error: '#F44336'
};
