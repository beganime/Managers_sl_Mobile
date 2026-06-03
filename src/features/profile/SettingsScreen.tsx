import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { API_BASE_URL } from '../../api/client';
import { Card } from '../../components/cards/Card';
import { Header } from '../../components/layout/Header';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { Button } from '../../components/ui/Button';
import { useTheme } from '../../context/ThemeContext';
import { ensurePushNotificationsRegistered } from '../../notifications/pushNotifications';
import { useAuth } from '../../store/auth';
import { theme } from '../../theme/theme';
import { getUserDisplayName } from '../../utils/format';

export function SettingsScreen() {
  const router = useRouter();
  const { themeMode, setTheme } = useTheme();
  const { user } = useAuth();
  const [pushLoading, setPushLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState('Готово к подключению на реальном устройстве.');

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
        subtitle="Профиль, внешний вид, уведомления и системные параметры."
        showBack
        parentFallback="/(app)/(tabs)/more"
      />

      <LinearGradient
        colors={theme.gradients.hero as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <ProfileAvatar user={user} size={78} />
        <View style={styles.heroText}>
          <Text style={styles.kicker}>Students Life Program for Managers</Text>
          <Text style={styles.name}>{getUserDisplayName(user)}</Text>
          <Text style={styles.meta}>{user?.email || 'Email не указан'}</Text>
        </View>
      </LinearGradient>

      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Система</Text>
            <Text style={styles.cardSubtitle}>Backend и mobile API.</Text>
          </View>
          <View style={styles.okBadge}>
            <Text style={styles.okText}>Online</Text>
          </View>
        </View>
        <InfoRow label="API base URL" value={API_BASE_URL} />
        <InfoRow label="Profile endpoint" value="/api/v1/me/" />
        <InfoRow label="Calendar endpoint" value="/api/v1/calendar/events/" />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Внешний вид</Text>
        <Text style={styles.cardSubtitle}>
          Сейчас включена {themeMode === 'dark' ? 'тёмная' : 'светлая'} тема.
        </Text>
        <View style={styles.toggleRow}>
          <ThemeOption active={themeMode === 'light'} title="Light" onPress={() => setTheme('light')} />
          <ThemeOption active={themeMode === 'dark'} title="Dark" onPress={() => setTheme('dark')} />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Push-уведомления</Text>
        <Text style={styles.cardSubtitle}>{pushStatus}</Text>
        <Button
          title="Подключить push"
          variant="primary"
          loading={pushLoading}
          onPress={registerPush}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Быстрое управление</Text>
        <SettingsAction icon="person-circle-outline" title="Открыть профиль" onPress={() => router.push('/(app)/profile-v2' as any)} />
        <SettingsAction icon="notifications-outline" title="Уведомления" onPress={() => router.push('/(app)/notifications' as any)} />
        <SettingsAction icon="calendar-outline" title="Календарь" onPress={() => router.push('/(app)/calendar' as any)} />
      </Card>
    </ScreenContainer>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  return (
    <Pressable onPress={onPress} style={[styles.themeOption, active && styles.themeOptionActive]}>
      <Text style={[styles.themeText, active && styles.themeTextActive]}>{title}</Text>
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
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={theme.colors.primary} />
      </View>
      <Text style={styles.actionText}>{title}</Text>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
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
    gap: 4,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
