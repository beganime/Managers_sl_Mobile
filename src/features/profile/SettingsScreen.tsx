import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { API_BASE_URL } from '../../api/client';
import { Card } from '../../components/cards/Card';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { theme } from '../../theme/theme';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components/ui/Button';

export function SettingsScreen() {
  const { themeMode, setTheme } = useTheme();

  return (
    <ScreenContainer>
      <Header title="Настройки" subtitle="Базовые параметры мобильного приложения." />

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
  },
});
