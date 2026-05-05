import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../utils/constants';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const registerForPushNotificationsAsync = async () => {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'ShareCircle Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4CAF50',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }
    
    // Get the actual Device Push Token (FCM token)
    // IMPORTANT: This requires a physical device and a Development Build for remote notifications in SDK 53
    try {
        const deviceToken = (await Notifications.getDevicePushTokenAsync()).data;
        console.log('✅ Native Device Push Token:', deviceToken);
        token = deviceToken;
    } catch (e) {
        console.warn('❌ Push Notifications: Unable to get NATIVE device token.');
        console.warn('💡 Reason: You are likely in Expo Go. Direct Firebase notifications require a Development Build or Standalone APK.');
        console.warn('💡 To test notifications: Build an APK or use "npx expo run:android"');
        return null;
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
};

export const savePushToken = async (userId, token) => {
  try {
    if (!userId || !token) return;
    await axios.put(`${API_URL}/auth/update-push-token`, {
      userId,
      pushToken: token
    });
    console.log('Push token saved to backend');
  } catch (error) {
    console.error('Error saving push token:', error);
  }
};

/**
 * Hook to initialize notifications in the app
 */
export const initNotifications = (navigation) => {
    // This listener is fired whenever a notification is received while the app is foregrounded
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification Received in foreground:', notification);
    });

    // This listener is fired whenever a user taps on or interacts with a notification
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data;
        console.log('Notification interaction:', data);

        if (data.type === 'request') {
            navigation.navigate('Requests', { tab: 'received' });
        } else if (data.donationId) {
            // Need to fetch donation detail or navigate to detail screen
            // navigation.navigate('DonationDetail', { id: data.donationId });
        }
    });

    return () => {
        notificationListener.remove();
        responseListener.remove();
    };
};
