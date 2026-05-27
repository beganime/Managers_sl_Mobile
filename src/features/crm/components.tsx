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
import { getItemTitle } from '../../utils/format';
import { statusLabel } from './constants';

export function SearchInput(props: TextInputProps) {
  return (
    <View style={styles.searchWrap}>
      <Ionicons name="search" size={18} color={theme.colors.textMuted} />
      <TextInput
        placeholderTextColor={theme.colors.textSoft}
        style={styles.searchInput}
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
  return (
    <View style={styles.chips}>
      {items.map((item) => {
        const active = value === item.value;
        return (
          <Pressable
            key={item.value || 'all'}
            onPress={() => onChange(item.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
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
  const title = getItemTitle(item);
  const phone = String(item.phone || '');
  const email = String(item.email || '');
  const manager = String(item.manager_name || item.manager || '');
  const status = statusLabel(item.status);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{title.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.cardMain}>
            <Text numberOfLines={1} style={styles.cardTitle}>{title}</Text>
            <Text numberOfLines={1} style={styles.cardMeta}>
              {[phone, email].filter(Boolean).join(' · ') || 'Контакты не указаны'}
            </Text>
          </View>
          <View style={[styles.badge, type === 'lead' && styles.badgeRed]}>
            <Text style={[styles.badgeText, type === 'lead' && styles.badgeTextRed]}>{status}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text numberOfLines={1} style={styles.manager}>
            {manager ? `Ответственный: ${manager}` : 'Ответственный не указан'}
          </Text>
          <Text style={styles.action}>{actionLabel || 'Открыть'}</Text>
        </View>
      </Card>
    </Pressable>
  );
});

export function DetailRow({ label, value }: { label: string; value?: unknown }) {
  if (value === undefined || value === null || value === '') return null;

  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{String(value)}</Text>
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
