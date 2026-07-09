import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  API_BASE_URL,
  API_PRIMARY_BASE_URL,
  getSelectedApiBaseUrl,
  resetSelectedApiBaseUrl,
  saveSelectedApiBaseUrl,
} from '../../api/client';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { Button } from '../../components/ui/Button';
import { useTheme } from '../../context/ThemeContext';
import { ensurePushNotificationsRegistered } from '../../notifications/pushNotifications';
import { useAuth } from '../../store/auth';
import { theme } from '../../theme/theme';
import { getUserDisplayName, getUserPosition } from '../../utils/format';

export function SettingsScreen() {
  const router = useRouter();
  const { appTheme, themeMode, themePreference, setTheme } = useTheme();
  const { user } = useAuth();
  const [pushLoading, setPushLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState('Готово к подключению на реальном устройстве.');
  const [serverUrl, setServerUrl] = useState(API_BASE_URL);
  const [serverSaving, setServerSaving] = useState(false);

  useEffect(() => {
    getSelectedApiBaseUrl()
      .then(setServerUrl)
      .catch(() => setServerUrl(API_BASE_URL));
  }, []);

  const registerPush = async () => {
    setPushLoading(true);
    const token = await ensurePushNotificationsRegistered(user?.id, { requestPermission: true });
    setPushStatus(
      token
        ? 'Push-уведомления подключены к ManagerSL.'
        : 'Не удалось подключить push. Проверьте разрешения iOS/Android или запустите приложение на реальном устройстве.'
    );
    setPushLoading(false);
  };

  const saveServer = async (value = serverUrl) => {
    const normalized = value.trim().replace(/\/+$/, '');

    if (!/^https?:\/\/.+/i.test(normalized)) {
      Alert.alert('Неверный адрес', 'Укажите полный адрес сервера, например https://students-life.ru/api1');
      return;
    }

    setServerSaving(true);

    try {
      const saved = await saveSelectedApiBaseUrl(normalized);
      setServerUrl(saved);
      Alert.alert(
        'Сервер обновлён',
        'Новые запросы будут идти через выбранный адрес. Если авторизация использует другой сервер, выполните выход и войдите заново.'
      );
    } catch {
      Alert.alert('Ошибка', 'Не удалось сохранить адрес сервера.');
    } finally {
      setServerSaving(false);
    }
  };

  const resetServer = async () => {
    setServerSaving(true);

    try {
      const saved = await resetSelectedApiBaseUrl();
      setServerUrl(saved);
      Alert.alert('Сервер сброшен', 'Приложение снова использует основной proxy по умолчанию.');
    } catch {
      Alert.alert('Ошибка', 'Не удалось сбросить адрес сервера.');
    } finally {
      setServerSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <Header
        title="Настройки"
        subtitle="Профиль, внешний вид, уведомления и управление приложением."
        showBack
        parentFallback="/(app)/(tabs)/more"
      />

      <LinearGradient
        colors={appTheme.gradients.hero as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <ProfileAvatar user={user} size={78} />
        <View style={styles.heroText}>
          <Text style={styles.kicker}>Students Life Program for Managers</Text>
          <Text style={styles.name}>{getUserDisplayName(user)}</Text>
          <Text style={styles.meta}>{getUserPosition(user)}</Text>
        </View>
      </LinearGradient>

      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.cardTitle, { color: appTheme.colors.text }]}>Состояние приложения</Text>
            <Text style={[styles.cardSubtitle, { color: appTheme.colors.textMuted }]}>Кабинет готов к работе.</Text>
          </View>
          <View style={[styles.okBadge, { backgroundColor: appTheme.colors.successSoft }]}>
            <Text style={[styles.okText, { color: appTheme.colors.success }]}>Online</Text>
          </View>
        </View>
        <InfoRow icon="shield-checkmark-outline" label="Сессия" value="Защищённый вход активен" />
        <InfoRow icon="phone-portrait-outline" label="Устройство" value="Мобильный кабинет ManagerSL" />
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: appTheme.colors.text }]}>Внешний вид</Text>
        <Text style={[styles.cardSubtitle, { color: appTheme.colors.textMuted }]}>
          Сейчас включена {themeMode === 'dark' ? 'тёмная' : 'светлая'} тема.
        </Text>
        <View style={styles.toggleRow}>
          <ThemeOption active={themePreference === 'system'} title="System" onPress={() => setTheme('system')} />
          <ThemeOption active={themePreference === 'light'} title="Light" onPress={() => setTheme('light')} />
          <ThemeOption active={themePreference === 'dark'} title="Dark" onPress={() => setTheme('dark')} />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: appTheme.colors.text }]}>Push-уведомления</Text>
        <Text style={[styles.cardSubtitle, { color: appTheme.colors.textMuted }]}>{pushStatus}</Text>
        <Button
          title="Подключить push"
          variant="primary"
          loading={pushLoading}
          onPress={registerPush}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: appTheme.colors.text }]}>Сервер API</Text>
        <Text style={[styles.cardSubtitle, { color: appTheme.colors.textMuted }]}>
          По умолчанию приложение подключается к новому proxy. Здесь можно временно вернуть оригинальный домен или указать другой proxy.
        </Text>

        <View style={styles.serverPresetRow}>
          <ServerOption
            active={serverUrl.replace(/\/+$/, '') === API_BASE_URL}
            title="Новый proxy"
            subtitle={API_BASE_URL}
            onPress={() => {
              setServerUrl(API_BASE_URL);
              void saveServer(API_BASE_URL);
            }}
          />
          <ServerOption
            active={serverUrl.replace(/\/+$/, '') === API_PRIMARY_BASE_URL}
            title="Оригинал"
            subtitle={API_PRIMARY_BASE_URL}
            onPress={() => {
              setServerUrl(API_PRIMARY_BASE_URL);
              void saveServer(API_PRIMARY_BASE_URL);
            }}
          />
        </View>

        <Input
          label="Адрес сервера"
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="https://students-life.ru/api1"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <View style={styles.serverActions}>
          <Button title="Сохранить сервер" loading={serverSaving} onPress={() => saveServer()} />
          <Button title="Сбросить" variant="secondary" disabled={serverSaving} onPress={resetServer} />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: appTheme.colors.text }]}>Быстрое управление</Text>
        <SettingsAction icon="person-circle-outline" title="Открыть профиль" onPress={() => router.push('/(app)/profile-v2' as any)} />
        <SettingsAction icon="reader-outline" title="Мои отчёты" onPress={() => router.push('/(app)/reports-history' as any)} />
        <SettingsAction icon="notifications-outline" title="Уведомления" onPress={() => router.push('/(app)/notifications' as any)} />
        <SettingsAction icon="calendar-outline" title="Календарь" onPress={() => router.push('/(app)/calendar' as any)} />
      </Card>
    </ScreenContainer>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { appTheme } = useTheme();

  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: appTheme.colors.primarySoft }]}>
        <Ionicons name={icon} size={18} color={appTheme.colors.primary} />
      </View>
      <View style={styles.infoText}>
        <Text style={[styles.infoLabel, { color: appTheme.colors.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: appTheme.colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function ThemeOption({
  active,
  title,
  onPress,
}: {
  active: boolean;
  title: string;
  onPress: () => void;
}) {
  const { appTheme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.themeOption,
        {
          borderColor: active ? appTheme.colors.primary : appTheme.colors.border,
          backgroundColor: active ? appTheme.colors.primary : appTheme.colors.surfaceSoft,
        },
      ]}
    >
      <Text style={[styles.themeText, { color: active ? appTheme.colors.white : appTheme.colors.textMuted }]}>
        {title}
      </Text>
    </Pressable>
  );
}

function ServerOption({
  active,
  title,
  subtitle,
  onPress,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { appTheme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.serverOption,
        {
          borderColor: active ? appTheme.colors.primary : appTheme.colors.border,
          backgroundColor: active ? appTheme.colors.primarySoft : appTheme.colors.surfaceStrong,
        },
      ]}
    >
      <Text style={[styles.serverOptionTitle, { color: active ? appTheme.colors.primary : appTheme.colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.serverOptionSubtitle, { color: appTheme.colors.textMuted }]} numberOfLines={2}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

function SettingsAction({
  icon,
  title,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
}) {
  const { appTheme } = useTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
      <View style={[styles.actionIcon, { backgroundColor: appTheme.colors.primarySoft }]}>
        <Ionicons name={icon} size={20} color={appTheme.colors.primary} />
      </View>
      <Text style={[styles.actionText, { color: appTheme.colors.text }]}>{title}</Text>
      <Ionicons name="chevron-forward" size={20} color={appTheme.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    ...theme.shadow.floating,
  },
  heroText: {
    flex: 1,
    gap: 5,
  },
  kicker: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  name: {
    color: theme.colors.white,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 25,
  },
  meta: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    gap: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  cardSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  okBadge: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.successSoft,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 7,
  },
  okText: {
    color: theme.colors.success,
    fontSize: 12,
    fontWeight: '900',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: 8,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  infoText: {
    flex: 1,
    gap: 3,
  },
  infoLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  infoValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  themeOption: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
  },
  themeOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  themeText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '900',
  },
  themeTextActive: {
    color: theme.colors.white,
  },
  serverPresetRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  serverOption: {
    flex: 1,
    minHeight: 82,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    gap: 5,
    padding: theme.spacing.md,
  },
  serverOptionTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  serverOptionSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  serverActions: {
    gap: theme.spacing.sm,
  },
  actionRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  actionText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
