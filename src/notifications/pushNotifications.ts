import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import apiClient from '../api/apiClient';
import { getToken, saveToken } from '../utils/storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getPlatformName() {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return 'unknown';
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'ManagerSL',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2563EB',
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function requestNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

export async function ensurePushNotificationsRegistered(userId?: number | string | null) {
  try {
    if (!Device.isDevice) return null;
    if (!userId) return null;

    const granted = await requestNotificationPermission();
    if (!granted) return null;

    await ensureAndroidChannel();

    const nativeTokenResponse = await Notifications.getDevicePushTokenAsync();
    const nativeToken = String(nativeTokenResponse?.data || '').trim();

    if (!nativeToken) return null;

    const cacheKey = `firebase_native_push_token_${userId}`;
    const cached = await getToken(cacheKey);

    if (cached === nativeToken) return nativeToken;

    await apiClient.post('notifications/devices/register/', {
      token: nativeToken,
      platform: getPlatformName(),
      device_name: `${Device.manufacturer || ''} ${Device.modelName || ''}`.trim(),
    });

    await saveToken(cacheKey, nativeToken);
    return nativeToken;
  } catch (error) {
    console.log('Push notification register error', error);
    return null;
  }
}