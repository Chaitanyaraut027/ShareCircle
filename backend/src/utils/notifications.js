import admin from '../config/firebase.config.js';

// Stringify all data values — FCM requires every value in `data` to be a string
const stringifyData = (data = {}) =>
  Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));

/**
 * Sends a push notification to a single user using Firebase Cloud Messaging (FCM).
 */
export const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  if (!fcmToken || fcmToken.length < 10) {
    console.log('FCM Token missing or invalid. Skipping single notification.');
    return;
  }

  const message = {
    notification: { title, body },
    data: stringifyData(data),
    token: fcmToken,
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'default',
        icon: 'ic_notification',
        color: '#4CAF50',
      },
    },
    apns: {
      payload: { aps: { sound: 'default', badge: 1 } },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('✅ FCM single message sent:', response);
  } catch (error) {
    if (
      error.code === 'messaging/invalid-argument' ||
      error.code === 'messaging/registration-token-not-registered' ||
      error.code === 'messaging/invalid-registration-token'
    ) {
      console.warn('⚠️  FCM token invalid/expired:', fcmToken.slice(0, 20) + '...');
    } else {
      console.error('❌ FCM send error:', error.message);
    }
  }
};

/**
 * Sends notification to multiple tokens at once using sendEachForMulticast.
 */
export const sendBulkNotifications = async (tokens, title, body, data = {}) => {
  const validTokens = tokens.filter(t => t && t.length > 10);
  if (validTokens.length === 0) {
    console.log('No valid FCM tokens. Skipping bulk notification.');
    return;
  }

  const message = {
    notification: { title, body },
    data: stringifyData(data),
    tokens: validTokens,
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'default',
        icon: 'ic_notification',
        color: '#4CAF50',
      },
    },
    apns: {
      payload: { aps: { sound: 'default', badge: 1 } },
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✅ FCM bulk: ${response.successCount}/${validTokens.length} sent.`);
    if (response.failureCount > 0) {
      response.responses.forEach((r, i) => {
        if (!r.success) console.warn(`  Token ${i} failed: ${r.error?.message}`);
      });
    }
  } catch (e) {
    console.error('❌ FCM bulk send error:', e.message);
  }
};
