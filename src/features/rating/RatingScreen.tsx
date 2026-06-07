import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { memo, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getRating } from '../../api/rating';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { StatusPill } from '../../components/ui/StatusPill';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePagedResource } from '../../hooks/usePagedResource';
import { useAuth } from '../../store/auth';
import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { ApiListItem } from '../../types';
import { getEntityId, getEntityNumber, getEntityString, getEntityTitle, getEntityValue } from '../../utils/entity';
import { resolveMediaUrl } from '../../utils/media';

const roleOptions = [
  { label: 'Все', value: 'all' },
  { label: 'Менеджеры', value: 'manager' },
  { label: 'Админы', value: 'admin' },
];

const visibilityOptions = [
  { label: 'Показываемые', value: 'visible' },
  { label: 'Скрытые', value: 'hidden' },
  { label: 'Все', value: 'all' },
];

function getNestedValue(entity: ApiListItem, paths: string[]) {
  for (const path of paths) {
    const value = path.split('.').reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[key];
    }, entity);

    if (value !== undefined && value !== null && value !== '') return value;
  }

  return undefined;
}

function isHiddenFromRating(item: ApiListItem) {
  const value = getNestedValue(item, [
    'can_be_in_leaderboard',
    'is_in_leaderboard',
    'show_in_rating',
    'rating_enabled',
    'employee.access.can_be_in_leaderboard',
    'employee_profile.access.can_be_in_leaderboard',
    'access_profile.can_be_in_leaderboard',
  ]);

  if (value === undefined) return false;
  if (typeof value === 'boolean') return !value;
  const normalized = String(value).toLowerCase();
  return ['false', '0', 'no', 'hidden', 'disabled'].includes(normalized);
}

function getOfficeKey(item: ApiListItem) {
  return String(
    getNestedValue(item, ['office.id', 'office_id', 'employee.office.id', 'employee.office_id']) ||
      getEntityString(item, ['office_name', 'office_city', 'office']) ||
      ''
  ).trim();
}

function getRatingScore(item: ApiListItem) {
  const value = getEntityValue(item, ['rating_score', 'points', 'score', 'total_score', 'kpi_score', 'rating']);
  if (value === null || value === undefined || value === '') return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getRatingAvatarUrl(item: ApiListItem) {
  const value = getNestedValue(item, [
    'avatar_url',
    'avatar',
    'photo_url',
    'photo',
    'image_url',
    'image',
    'user.avatar_url',
    'user.avatar',
    'employee.avatar_url',
    'employee.avatar',
    'profile.avatar_url',
    'profile.avatar',
  ]);

  if (typeof value === 'string') return resolveMediaUrl(value);

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const nested = value as Record<string, unknown>;
    const nestedValue = nested.url || nested.file || nested.path;
    if (typeof nestedValue === 'string') return resolveMediaUrl(nestedValue);
  }

  return null;
}

function getRatingInitials(item: ApiListItem) {
  const title = getEntityTitle(item, 'SL').trim();
  const parts = title.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('') || 'SL';
}

export function RatingScreen() {
  const appTheme = useAppTheme();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [visibility, setVisibility] = useState('visible');
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');
  const userOfficeKey = String(user?.office?.id || user?.office?.city || '').trim();

  const loader = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) =>
      getRating({
        limit,
        offset,
        search: debouncedSearch || undefined,
        role: role === 'all' ? undefined : role,
        include_hidden: isAdmin && visibility !== 'visible' ? 1 : undefined,
      }),
    [debouncedSearch, isAdmin, role, visibility]
  );

  const { items, count, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePagedResource<ApiListItem>(loader);

  const displayItems = items.filter((item) => {
    const hidden = isHiddenFromRating(item);

    if (!isAdmin && hidden) return false;

    if (!isAdmin && userOfficeKey) {
      const itemOfficeKey = getOfficeKey(item);
      if (itemOfficeKey && itemOfficeKey !== userOfficeKey) return false;
    }

    if (isAdmin && visibility === 'hidden') return hidden;
    if (isAdmin && visibility === 'visible') return !hidden;

    return true;
  });
  const podiumItems = displayItems.filter((item) => !isHiddenFromRating(item)).slice(0, 3);

  const renderItem = useCallback(
    ({ item, index }: { item: ApiListItem; index: number }) => (
      <RatingRow item={item} fallbackRank={index + 1} hidden={isHiddenFromRating(item)} />
    ),
    []
  );

  return (
    <ScreenContainer scroll={false} style={styles.screen}>
      <FlatList
        data={displayItems}
        keyExtractor={(item, index) => String(getEntityId(item) || index)}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={appTheme.colors.primary}
            colors={[appTheme.colors.primary]}
            onRefresh={refresh}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <Header
              title="Рейтинг"
              eyebrow="ManagerSL"
              subtitle="Список сотрудников, KPI и фильтр по должностям."
            />

            <Card glass style={styles.hero}>
              <View style={[styles.heroIcon, { backgroundColor: appTheme.colors.accentSoft }]}>
                <Ionicons name="trophy-outline" size={26} color={appTheme.colors.accent} />
              </View>
              <View style={styles.heroTextWrap}>
                <Text style={[styles.heroKicker, { color: appTheme.colors.accent }]}>Students Life Program for Managers</Text>
                <Text style={[styles.heroTitle, { color: appTheme.colors.text }]}>Командный рейтинг</Text>
                <Text style={[styles.heroText, { color: appTheme.colors.textMuted }]}>
                  В списке {displayItems.length} из {count} сотрудников. Можно искать по имени, email, офису или должности.
                </Text>
              </View>
            </Card>

            {podiumItems.length ? <Podium items={podiumItems} /> : null}

            <SegmentedControl options={roleOptions} value={role} onChange={setRole} />
            {isAdmin ? <SegmentedControl options={visibilityOptions} value={visibility} onChange={setVisibility} /> : null}

            <Input
              label="Поиск"
              placeholder="Сотрудник, должность, email или офис"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />

            {error ? <ErrorState message={error} actionTitle="Повторить" onAction={refresh} /> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState title="Загружаем рейтинг" />
          ) : (
            <EmptyState title="Рейтинг пока пуст" message="Данные появятся после расчёта KPI сотрудников." />
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={appTheme.colors.primary} /> : null}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

function Podium({ items }: { items: ApiListItem[] }) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.podium}>
      {items.map((item, index) => {
        const rank = getEntityNumber(item, ['rank', 'position_index'], index + 1);
        const score = getRatingScore(item);

        return (
          <Card key={String(getEntityId(item) || index)} glass style={[styles.podiumCard, rank === 1 && styles.podiumFirst]}>
            <View style={[styles.podiumRank, { backgroundColor: appTheme.colors.accent }]}>
              <Text style={styles.podiumRankText}>{rank}</Text>
            </View>
            <RatingAvatar item={item} size={54} />
            <Text style={[styles.podiumName, { color: appTheme.colors.text }]} numberOfLines={2}>
              {getEntityTitle(item, 'Сотрудник')}
            </Text>
            <Text style={[styles.podiumScore, { color: appTheme.colors.accent }]}>
              {score === null ? 'Баллы: нет данных' : `${score.toLocaleString('ru-RU')} баллов`}
            </Text>
          </Card>
        );
      })}
    </View>
  );
}

function RatingAvatar({ item, size = 48 }: { item: ApiListItem; size?: number }) {
  const appTheme = useAppTheme();
  const avatarUrl = getRatingAvatarUrl(item);

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: appTheme.colors.primarySoft,
          borderColor: appTheme.colors.border,
        },
      ]}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" transition={180} />
      ) : (
        <Text style={[styles.avatarText, { color: appTheme.colors.primary }]}>{getRatingInitials(item)}</Text>
      )}
    </View>
  );
}

const RatingRow = memo(function RatingRow({
  item,
  fallbackRank,
  hidden,
}: {
  item: ApiListItem;
  fallbackRank: number;
  hidden: boolean;
}) {
  const appTheme = useAppTheme();
  const rank = getEntityNumber(item, ['rank', 'position_index'], fallbackRank);
  const score = getRatingScore(item);
  const revenue = getEntityNumber(item, ['revenue', 'revenue_usd', 'current_month_revenue'], 0);
  const leads = getEntityNumber(item, ['leads', 'leads_count', 'lead_count'], 0);
  const clients = getEntityNumber(item, ['clients', 'clients_count', 'client_count'], 0);
  const workdays = getEntityNumber(item, ['workdays', 'workdays_count', 'closed_workdays'], 0);
  const office = getEntityString(item, ['office_name', 'office_city', 'office']);
  const position = getEntityString(item, ['position', 'role_display', 'role'], 'Должность не указана');

  return (
    <Card style={styles.row}>
      <View
        style={[
          styles.rank,
          { backgroundColor: rank <= 3 ? appTheme.colors.accent : appTheme.colors.primarySoft },
        ]}
      >
        <Text style={[styles.rankText, { color: rank <= 3 ? appTheme.colors.white : appTheme.colors.primary }]}>{rank}</Text>
      </View>
      <RatingAvatar item={item} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: appTheme.colors.text }]}>{getEntityTitle(item, 'Сотрудник')}</Text>
        <Text style={[styles.rowSubtitle, { color: appTheme.colors.accent }]}>{position}</Text>
        <Text style={[styles.rowMeta, { color: appTheme.colors.textMuted }]}>{office || getEntityString(item, ['email'], 'Офис не указан')}</Text>
        <View style={styles.pills}>
          <StatusPill label={score === null ? 'Баллы: нет данных' : `${score.toLocaleString('ru-RU')} баллов`} tone={rank <= 3 ? 'accent' : 'primary'} />
          <StatusPill label={`${leads.toLocaleString('ru-RU')} лидов`} tone="primary" />
          <StatusPill label={`${clients.toLocaleString('ru-RU')} клиентов`} tone="accent" />
          <StatusPill label={`${revenue.toLocaleString('ru-RU')} USD`} tone="success" />
          <StatusPill label={`${workdays.toLocaleString('ru-RU')} дней`} tone="muted" />
          {hidden ? <StatusPill label="Скрыт из рейтинга" tone="warning" /> : null}
        </View>
      </View>
      <Ionicons name={rank <= 3 ? 'trophy' : 'trending-up-outline'} size={22} color={rank <= 3 ? appTheme.colors.accent : appTheme.colors.textMuted} />
    </Card>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  listContent: {
    gap: theme.spacing.md,
    paddingBottom: 116,
  },
  headerStack: {
    gap: theme.spacing.lg,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentSoft,
  },
  heroTextWrap: {
    flex: 1,
    gap: 5,
  },
  heroKicker: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 29,
  },
  heroText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  podium: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  podiumCard: {
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.sm,
    minWidth: 96,
  },
  podiumFirst: {
    transform: [{ translateY: -4 }],
  },
  podiumRank: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  podiumRankText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  podiumName: {
    fontSize: 13,
    fontWeight: '900',
    minHeight: 34,
    textAlign: 'center',
  },
  podiumScore: {
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  rank: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  rankTop: {
    backgroundColor: theme.colors.accent,
  },
  rankText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  avatar: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    ...StyleSheet.absoluteFillObject,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '900',
  },
  rankTopText: {
    color: theme.colors.white,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  rowSubtitle: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '900',
  },
  rowMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: 4,
  },
});
