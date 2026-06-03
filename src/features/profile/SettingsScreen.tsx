import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { API_BASE_URL } from '../../api/client';
import { Card } from '../../components/cards/Card';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { Button } from '../../components/ui/Button';
import { useTheme } from '../../context/ThemeContext';
import { ensurePushNotificationsRegistered } from '../../notifications/pushNotifications';
import { useAuth } from '../../store/auth';
import { theme } from '../../theme/theme';

export function SettingsScreen() {
  const { themeMode, setTheme } = useTheme();
  const { user } = useAuth();
  const [pushLoading, setPushLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState('Push-уведомления можно подключить на реальном устройстве.');

  const registerPush = async () => {
    setPushLoading(true);
    const token = await ensurePushNotificationsRegistered(user?.id, { requestPermission: true });
    setPushStatus(
      token
        ? 'Push-уведомления подключены к ManagerSL.'
        : 'Не удалось подключить push. Проверьте разрешения iOS/Android или запустите на реальном устройстве.'
    );
    setPushLoading(false);
  };

  return (
    <ScreenContainer>
      <Header
        title="Настройки"
        subtitle="Базовые параметры мобильного приложения."
        showBack
        parentFallback="/(app)/(tabs)/more"
      />

      <Card style={styles.card}>
        <Text style={styles.label}>API base URL</Text>
        <Text style={styles.value}>{API_BASE_URL}</Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.label}>Тема</Text>
        <Text style={styles.value}>{themeMode === 'dark' ? 'Тёмная' : 'Светлая'}</Text>
        <Button
          title={themeMode === 'dark' ? 'Включить светлую' : 'Включить тёмную'}
          variant="secondary"
          onPress={() => setTheme(themeMode === 'dark' ? 'light' : 'dark')}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.label}>Push-уведомления</Text>
        <Text style={styles.value}>{pushStatus}</Text>
        <Button
          title="Подключить push"
          variant="primary"
          loading={pushLoading}
          onPress={registerPush}
        />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.md,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  value: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 22,
  },
});
