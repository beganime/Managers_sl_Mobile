import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type LeadStatus = 'new' | 'contacted' | 'converted' | 'rejected';

export type LeadItem = {
  id: number;
  full_name: string;
  email?: string | null;
  phone: string;
  country?: string;
  education?: string;
  age?: number | null;
  relation?: string;
  direction?: string;
  student_name?: string;
  parent_name?: string;
  has_passport?: string;
  passport_expiry?: string | null;
  travel_month?: string;
  travel_date?: string | null;
  departure_city?: string;
  arrival_city?: string;
  luggage?: string;
  current_education?: string;
  current_university?: string;
  current_country?: string;
  manager?: number | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
};

type ThemeLike = {
  surface: string;
  border: string;
  divider: string;
  blue: string;
  blueSoft: string;
  text: string;
  textSecondary: string;
  textMuted?: string;
  backgroundSoft: string;
};

type Props = {
  lead: LeadItem;
  theme: ThemeLike;
  onPress: (lead: LeadItem) => void;
};

function LeadIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Rect
        x="3.5"
        y="4"
        width="17"
        height="16"
        rx="4"
        stroke={color}
        strokeWidth={2}
        fill="none"
      />
      <Path
        d="M7 8h10M7 12h6M7 16h4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx="17.5" cy="16.5" r="1.2" fill={color} />
    </Svg>
  );
}

function getStatusMeta(status: LeadStatus, theme: ThemeLike) {
  switch (status) {
    case 'new':
      return {
        label: 'Новая',
        bg: theme.blueSoft,
        color: theme.blue,
      };
    case 'contacted':
      return {
        label: 'В работе',
        bg: 'rgba(245, 158, 11, 0.14)',
        color: '#F59E0B',
      };
    case 'converted':
      return {
        label: 'Клиент',
        bg: 'rgba(34, 197, 94, 0.14)',
        color: '#22C55E',
      };
    case 'rejected':
      return {
        label: 'Отказ',
        bg: 'rgba(239, 68, 68, 0.14)',
        color: '#EF4444',
      };
    default:
      return {
        label: status,
        bg: theme.backgroundSoft,
        color: theme.textSecondary,
      };
  }
}

function formatDirection(direction?: string) {
  if (!direction) return 'Без направления';

  const map: Record<string, string> = {
    admission: 'Поступление',
    translation: 'Переводы',
    umrah: 'Умра / Хадж',
    visa: 'Виза',
    tickets: 'Билеты',
    tours: 'Туры',
    work_visa: 'Рабочая виза',
  };

  return map[direction] || direction;
}

export default function LeadCard({ lead, theme, onPress }: Props) {
  const statusMeta = getStatusMeta(lead.status, theme);

  return (
    <Pressable
      onPress={() => onPress(lead)}
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: '#000',
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: theme.blueSoft }]}>
          <LeadIcon color={theme.blue} />
        </View>

        <View style={styles.topMain}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {lead.full_name || 'Без имени'}
            </Text>

            <View style={[styles.badge, { backgroundColor: statusMeta.bg }]}>
              <Text style={[styles.badgeText, { color: statusMeta.color }]}>
                {statusMeta.label}
              </Text>
            </View>
          </View>

          <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
            {lead.phone || 'Без телефона'}
            {lead.country ? ` · ${lead.country}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={[styles.metaChip, { backgroundColor: theme.backgroundSoft }]}>
          <Text style={[styles.metaChipText, { color: theme.textSecondary }]}>
            {formatDirection(lead.direction)}
          </Text>
        </View>

        <Text style={[styles.dateText, { color: theme.textSecondary }]}>
          {new Date(lead.created_at).toLocaleDateString('ru-RU')}
        </Text>
      </View>

      {!!lead.student_name && (
        <Text style={[styles.extra, { color: theme.textSecondary }]} numberOfLines={1}>
          Студент: {lead.student_name}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    gap: 12,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topMain: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  sub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '72%',
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  extra: {
    fontSize: 12,
    fontWeight: '600',
  },
});