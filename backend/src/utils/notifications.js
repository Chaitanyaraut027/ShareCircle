import admin from '../config/firebase.config.js';

/**
 * Sends a push notification to a specific user using Firebase Cloud Messaging (FCM).
 */
export const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  if (!fcmToken) {
    console.log('FCM Token not found for user. Skipping.');
    return;
  }

  const message = {
    notification: {
      title: title,
      body: body,
    },
    data: data,
    token: fcmToken,
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'default',
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Successfully sent Firebase message:', response);
  } catch (error) {
    if (error.code === 'messaging/invalid-argument' || error.code === 'messaging/registration-token-not-registered') {
        console.warn('FCM token is invalid or expired. Consider refreshing it on the client.');
    } else {
        console.error('Error sending Firebase notification:', error);
    }
  }
};

/**
 * Sends notification to multiple tokens at once
 */
export const sendBulkNotifications = async (tokens, title, body, data = {}) => {
    const validTokens = tokens.filter(t => t && t.length > 10);
    if (validTokens.length === 0) return;

    const message = {
        notification: { title, body },
        data: data,
        tokens: validTokens,
    };

    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`Successfully sent ${response.successCount} Firebase messages out of ${validTokens.length}`);
    } catch (e) {
        console.error('Error sending bulk Firebase messages:', e);
    }
};
