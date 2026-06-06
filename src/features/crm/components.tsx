import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { ApiListItem } from '../../types';
import { Card } from '../../components/cards/Card';
import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { getItemTitle } from '../../utils/format';
import { statusLabel } from './constants';

export function SearchInput(props: TextInputProps) {
  const appTheme = useAppTheme();

  return (
    <View
      style={[
        styles.searchWrap,
        {
          borderColor: appTheme.colors.border,
          backgroundColor: appTheme.colors.surfaceStrong,
        },
      ]}
    >
      <Ionicons name="search" size={18} color={appTheme.colors.textMuted} />
      <TextInput
        placeholderTextColor={appTheme.colors.textSoft}
        selectionColor={appTheme.colors.primary}
        cursorColor={appTheme.colors.primary}
        keyboardAppearance={appTheme.dark ? 'dark' : 'light'}
        style={[styles.searchInput, { color: appTheme.colors.text }]}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
      />
    </View>
  );
}

export function FilterChips({
  value,
  items,
  onChange,
}: {
  value: string;
  items: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.chips}>
      {items.map((item) => {
        const active = value === item.value;
        return (
          <Pressable
            key={item.value || 'all'}
            onPress={() => onChange(item.value)}
            style={[
              styles.chip,
              {
                borderColor: active ? appTheme.colors.accent : appTheme.colors.border,
                backgroundColor: active ? appTheme.colors.accentSoft : appTheme.colors.surfaceStrong,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: active ? appTheme.colors.accent : appTheme.colors.textMuted }]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const CrmListCard = memo(function CrmListCard({
  item,
  type,
  onPress,
  actionLabel,
}: {
  item: ApiListItem;
  type: 'lead' | 'client' | 'application';
  onPress: () => void;
  actionLabel?: string;
}) {
  const appTheme = useAppTheme();
  const title = getItemTitle(item);
  const phone = String(item.phone || '');
  const email = String(item.email || '');
  const manager = String(item.manager_name || item.manager || '');
  const status = statusLabel(item.status);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <View style={[styles.avatar, { backgroundColor: appTheme.colors.primarySoft }]}>
            <Text style={[styles.avatarText, { color: appTheme.colors.primary }]}>{title.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.cardMain}>
            <Text numberOfLines={1} style={[styles.cardTitle, { color: appTheme.colors.text }]}>{title}</Text>
            <Text numberOfLines={1} style={[styles.cardMeta, { color: appTheme.colors.textMuted }]}>
              {[phone, email].filter(Boolean).join(' · ') || 'Контакты не указаны'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: type === 'lead' ? appTheme.colors.accentSoft : appTheme.colors.primarySoft }]}>
            <Text style={[styles.badgeText, { color: type === 'lead' ? appTheme.colors.accent : appTheme.colors.primary }]}>{status}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text numberOfLines={1} style={[styles.manager, { color: appTheme.colors.textMuted }]}>
            {manager ? `Ответственный: ${manager}` : 'Ответственный не указан'}
          </Text>
          <Text style={[styles.action, { color: appTheme.colors.accent }]}>{actionLabel || 'Открыть'}</Text>
        </View>
      </Card>
    </Pressable>
  );
});

export function DetailRow({ label, value }: { label: string; value?: unknown }) {
  const appTheme = useAppTheme();

  if (value === undefined || value === null || value === '') return null;

  return (
    <View style={[styles.detailRow, { borderBottomColor: appTheme.colors.border }]}>
      <Text style={[styles.detailLabel, { color: appTheme.colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: appTheme.colors.text }]}>{String(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
    paddingHorizontal: theme.spacing.md,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  chipText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  chipTextActive: {
    color: theme.colors.accent,
  },
  pressed: {
    opacity: 0.78,
  },
  card: {
    gap: theme.spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  avatarText: {
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  cardMain: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  cardMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  badge: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeRed: {
    backgroundColor: theme.colors.accentSoft,
  },
  badgeText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  badgeTextRed: {
    color: theme.colors.accent,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  manager: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  action: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  detailRow: {
    gap: 4,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  detailValue: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
});
