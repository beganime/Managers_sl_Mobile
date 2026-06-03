import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NotificationBell } from '../notifications/NotificationBell';
import { theme } from '../../theme/theme';

type HeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  showBack?: boolean;
  onBack?: () => void;
  parentFallback?: string;
  showNotifications?: boolean;
};

export function Header({
  title,
  subtitle,
  eyebrow = 'ManagerSL',
  showBack = false,
  onBack,
  parentFallback,
  showNotifications = true,
}: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (parentFallback) {
      router.replace(parentFallback as any);
      return;
    }

    const cleanPath = pathname.split('?')[0].replace(/\/$/, '');
    const parentPath = cleanPath.split('/').slice(0, -1).join('/');

    if (parentPath && parentPath !== '/(app)' && parentPath !== '/(app)/crm') {
      router.replace(parentPath as any);
      return;
    }

    router.replace('/(app)/(tabs)/more' as any);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <View style={styles.leftRow}>
          {showBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Назад"
              hitSlop={10}
              onPress={handleBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={22} color={theme.colors.primary} />
            </Pressable>
          ) : null}
          <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text>
        </View>
        {showNotifications ? <NotificationBell /> : null}
      </View>
      <Text style={styles.title}>{title}</Text>
      {Boolean(subtitle) && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  topRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  leftRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
    ...theme.shadow.card,
  },
  pressed: {
    opacity: 0.72,
  },
  eyebrow: {
    flexShrink: 1,
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.colors.text,
    fontSize: 27,
    fontWeight: '900',
    lineHeight: 33,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
