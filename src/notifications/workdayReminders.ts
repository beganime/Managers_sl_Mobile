import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getToken, saveToken } from '../utils/storage';

const STORAGE_KEY = 'daily_workday_reminder_ids_v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('daily-reminders', {
    name: 'Daily reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#3B82F6',
    sound: 'default',
  });
}

async function requestNotificationPermission() {
  if (Platform.OS === 'web') return false;

  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return (
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function scheduleDailyReminder(
  title: string,
  body: string,
  hour: number,
  minute: number
) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
    },
    trigger: {
      hour,
      minute,
      repeats: true,
      channelId: 'daily-reminders',
    } as any,
  });
}

export async function ensureWorkdayRemindersScheduled() {
  if (Platform.OS === 'web') return;

  await ensureAndroidChannel();

  const permitted = await requestNotificationPermission();
  if (!permitted) return;

  const existing = await getToken(STORAGE_KEY);
  if (existing) return;

  const morningId = await scheduleDailyReminder(
    'Напоминание',
    'Не забудьте отметиться о приходе на работу.',
    8,
    45
  );

  const eveningId = await scheduleDailyReminder(
    'Напоминание',
    'Не забудьте отметить уход и написать ежедневный отчёт.',
    17,
    45
  );

  await saveToken(STORAGE_KEY, JSON.stringify([morningId, eveningId]));
}

export async function resetWorkdayReminders() {
  const raw = await getToken(STORAGE_KEY);
  if (raw) {
    try {
      const ids: string[] = JSON.parse(raw);
      for (const id of ids) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
    } catch {
      // ignore
    }
  }

  await saveToken(STORAGE_KEY, '');
}