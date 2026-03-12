// src/utils/notifications.ts
import * as Notifications from 'expo-notifications';

// Запрос разрешений у пользователя (особенно важно для iOS)
export async function requestNotificationPermissions() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    
    return finalStatus === 'granted';
}

// Планирование локального уведомления (напоминания)
export async function scheduleTaskReminder(title: string, description: string, date: Date) {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
        console.log("Нет разрешения на отправку уведомлений");
        return null;
    }

    // Если время в прошлом — не планируем
    if (date <= new Date()) {
        return null;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
            title: `⏰ Напоминание: ${title}`,
            body: description || 'Пришло время выполнить эту задачу!',
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
            date: date, // Точная дата и время срабатывания
        },
    });

    console.log(`Уведомление запланировано на ${date.toLocaleString()}`);
    return notificationId;
}