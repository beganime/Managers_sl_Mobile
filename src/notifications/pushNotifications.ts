import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerDeviceToken } from '../api/notifications';
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

type RegisterPushOptions = {
  requestPermission?: boolean;
};

function getPlatformName() {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return 'unknown';
}

function getDeviceName() {
  return `${Device.manufacturer || ''} ${Device.modelName || Device.deviceName || ''}`.trim();
}

function getLocale() {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  return locale || '';
}

function getTimezone() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timezone || '';
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'ManagerSL',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#981B2E',
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function resolveNotificationPermission(requestPermission: boolean) {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (!requestPermission) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

export async function ensurePushNotificationsRegistered(
  userId?: number | string | null,
  options: RegisterPushOptions = {}
) {
  try {
    if (!Device.isDevice) return null;
    if (!userId) return null;

    const granted = await resolveNotificationPermission(options.requestPermission === true);
    if (!granted) return null;

    await ensureAndroidChannel();

    const nativeTokenResponse = await Notifications.getDevicePushTokenAsync();
    const nativeToken = String(nativeTokenResponse?.data || '').trim();

    if (!nativeToken) return null;

    const cacheKey = `manager_sl_native_push_token_${userId}`;
    const cached = await getToken(cacheKey);

    if (cached === nativeToken) return nativeToken;

    await registerDeviceToken({
      token: nativeToken,
      platform: getPlatformName(),
      device_name: getDeviceName(),
      app_version:
        Constants.expoConfig?.version ||
        (Constants as { manifest2?: { extra?: { expoClient?: { version?: string } } } }).manifest2
          ?.extra?.expoClient?.version ||
        '',
      locale: getLocale(),
      timezone: getTimezone(),
    });

    await saveToken(cacheKey, nativeToken);
    return nativeToken;
  } catch (error) {
    console.log('Push notification register error', error);
    return null;
  }
}
