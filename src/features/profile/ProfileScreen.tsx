import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/cards/Card';
import { Header } from '../../components/layout/Header';
import { ProfileAvatar } from '../../components/profile/ProfileAvatar';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../store/auth';
import { theme } from '../../theme/theme';
import { getUserDisplayName, getUserPosition } from '../../utils/format';
import { ScreenContainer } from '../../components/layout/ScreenContainer';

export function ProfileScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const salary = user?.managersalary;
  const office = user?.office;
  const position = getUserPosition(user);

  const confirmLogout = () => {
    Alert.alert('Выход', 'Завершить текущую сессию на этом устройстве?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: () => {
          void logout().then(() => router.replace('/login' as any));
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <Header
        title="Профиль"
        subtitle="Students Life Program for Managers"
        showBack
        parentFallback="/(app)/(tabs)/more"
      />

      <LinearGradient
        colors={theme.gradients.hero as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <ProfileAvatar user={user} size={86} />
          <View style={styles.info}>
            <Text style={styles.kicker}>ManagerSL ERP/CRM workspace</Text>
            <Text style={styles.name}>{getUserDisplayName(user)}</Text>
            <Text style={styles.meta}>{user?.email || 'Email не указан'}</Text>
          </View>
        </View>
        <View style={styles.heroPills}>
          <HeroPill icon="ribbon-outline" text={position} />
          <HeroPill icon="shield-checkmark-outline" text={user?.role_display || user?.role || 'Роль не указана'} />
          <HeroPill icon="business-outline" text={office?.city || 'Офис не указан'} />
        </View>
      </LinearGradient>

      <View style={styles.stats}>
        <ProfileStat label="Баланс" value={`${salary?.current_balance || 0} USD`} />
        <ProfileStat label="План" value={`${salary?.monthly_plan || 0} USD`} />
        <ProfileStat label="Статус" value={user?.work_status || 'working'} />
      </View>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Рабочие данные</Text>
        <ProfileRow label="Имя" value={getUserDisplayName(user)} />
        <ProfileRow label="Должность" value={position} />
        <ProfileRow label="Телефон офиса" value={office?.phone} />
        <ProfileRow label="Адрес офиса" value={office?.address} />
        <ProfileRow label="Описание работы" value={user?.job_description} />
      </Card>

      <Card style={styles.actions}>
        <Text style={styles.cardTitle}>Управление</Text>
        <ActionRow icon="reader-outline" title="Мои отчёты" onPress={() => router.push('/(app)/reports-history' as any)} />
        <ActionRow icon="settings-outline" title="Настройки приложения" onPress={() => router.push('/(app)/settings' as any)} />
        <ActionRow icon="notifications-outline" title="Уведомления" onPress={() => router.push('/(app)/notifications' as any)} />
        <ActionRow icon="calendar-outline" title="Календарь" onPress={() => router.push('/(app)/calendar' as any)} />
      </Card>

      <Button title="Выйти" variant="danger" onPress={confirmLogout} />
    </ScreenContainer>
  );
}

function HeroPill({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.heroPill}>
      <Ionicons name={icon} size={15} color={theme.colors.white} />
      <Text style={styles.heroPillText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function ProfileStat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>{String(value)}</Text>
    </Card>
  );
}

function ProfileRow({ label, value }: { label: string; value?: unknown }) {
  if (!value) return null;

  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text style={styles.profileValue}>{String(value)}</Text>
    </View>
  );
}

function ActionRow({
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
    overflow: 'hidden',
    gap: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    ...theme.shadow.floating,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  info: {
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
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 26,
  },
  meta: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '700',
  },
  heroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  heroPill: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
  },
  heroPillText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  stat: {
    flex: 1,
    minWidth: 104,
    gap: 5,
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  statValue: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  card: {
    gap: theme.spacing.sm,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  profileRow: {
    gap: 3,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  profileLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  profileValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  actions: {
    gap: theme.spacing.sm,
  },
  actionRow: {
    minHeight: 54,
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
