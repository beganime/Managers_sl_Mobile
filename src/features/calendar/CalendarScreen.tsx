import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CalendarAgendaItem, listCalendarEvents } from '../../api/calendar';
import { Card } from '../../components/cards/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Header } from '../../components/layout/Header';
import { LoadingState } from '../../components/ui/LoadingState';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { StatusPill } from '../../components/ui/StatusPill';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { formatEntityDate, getStatusLabel } from '../../utils/entity';

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatMonth(date: Date) {
  return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

const EMPTY_AGENDA_ITEMS: CalendarAgendaItem[] = [];

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toDateKey(value?: string) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return formatDateKey(date);
}

function getMonthDays(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const days = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: days }, (_, index) => {
    const current = new Date(year, month, index + 1);
    return {
      date: formatDateKey(current),
      day: index + 1,
      weekDay: current.toLocaleDateString('ru-RU', { weekday: 'short' }),
    };
  });
}

export function CalendarScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(new Date()));
  const calendarParams = useMemo(
    () => ({ month: monthDate.getMonth() + 1, year: monthDate.getFullYear() }),
    [monthDate]
  );
  const loadEvents = useCallback(() => listCalendarEvents(calendarParams), [calendarParams]);
  const { data, loading, error, reload } = useAsyncResource(loadEvents);
  const items = data?.items || EMPTY_AGENDA_ITEMS;
  const monthDays = useMemo(() => getMonthDays(monthDate), [monthDate]);
  const selectedItems = useMemo(
    () => items.filter((item) => toDateKey(item.date) === selectedDate),
    [items, selectedDate]
  );
  const eventCountByDay = useMemo(() => {
    const map = new Map<string, number>();

    items.forEach((item) => {
      const key = toDateKey(item.date);
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    });

    return map;
  }, [items]);

  useEffect(() => {
    const sameMonth = selectedDate.startsWith(`${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`);
    if (!sameMonth) {
      const today = new Date();
      const todayKey = formatDateKey(today);
      const sameAsViewedMonth = today.getFullYear() === monthDate.getFullYear() && today.getMonth() === monthDate.getMonth();
      setSelectedDate(sameAsViewedMonth ? todayKey : formatDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)));
    }
  }, [monthDate, selectedDate]);

  const renderItem = useCallback(
    ({ item }: { item: CalendarAgendaItem }) => (
      <AgendaCard
        item={item}
        onPress={() => {
          if (item.route) {
            router.push(item.route as any);
          }
        }}
      />
    ),
    [router]
  );

  return (
    <ScreenContainer scroll={false}>
      <FlatList
        data={selectedItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            tintColor={appTheme.colors.primary}
            colors={[appTheme.colors.primary]}
            onRefresh={reload}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <Header
              title="Календарь"
              subtitle="События, дедлайны, дни рождения и важные даты."
              showBack
              parentFallback="/(app)/(tabs)/more"
            />

            <Card glass style={styles.hero}>
              <Text style={[styles.heroKicker, { color: appTheme.colors.accent }]}>Calendar</Text>
              <Text style={[styles.heroTitle, { color: appTheme.colors.text }]}>Полная повестка месяца</Text>
              <Text style={[styles.heroText, { color: appTheme.colors.textMuted }]}>
                Загружаем события месяца через API календаря. Если endpoint ещё не доступен, показываем дедлайны задач.
              </Text>
              <View style={styles.monthRow}>
                <Pressable
                  onPress={() => setMonthDate((current) => addMonths(current, -1))}
                  style={[styles.monthButton, { backgroundColor: appTheme.colors.primarySoft }]}
                >
                  <Ionicons name="chevron-back" size={18} color={appTheme.colors.primary} />
                </Pressable>
                <Text style={[styles.monthTitle, { color: appTheme.colors.text }]}>{formatMonth(monthDate)}</Text>
                <Pressable
                  onPress={() => setMonthDate((current) => addMonths(current, 1))}
                  style={[styles.monthButton, { backgroundColor: appTheme.colors.primarySoft }]}
                >
                  <Ionicons name="chevron-forward" size={18} color={appTheme.colors.primary} />
                </Pressable>
              </View>
              <View style={styles.pills}>
                <StatusPill label={`${items.length} событий`} tone="success" />
                <StatusPill label={`${selectedItems.length} за день`} tone="accent" />
                <StatusPill label="Pull-to-refresh" tone="primary" />
              </View>
            </Card>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
              {monthDays.map((day) => {
                const active = day.date === selectedDate;
                const count = eventCountByDay.get(day.date) || 0;

                return (
                  <Pressable
                    key={day.date}
                    onPress={() => setSelectedDate(day.date)}
                    style={[
                      styles.dayChip,
                      {
                        borderColor: active ? appTheme.colors.accent : appTheme.colors.border,
                        backgroundColor: active ? appTheme.colors.accentSoft : appTheme.colors.surfaceStrong,
                      },
                    ]}
                  >
                    <Text style={[styles.dayWeek, { color: active ? appTheme.colors.accent : appTheme.colors.textMuted }]}>
                      {day.weekDay}
                    </Text>
                    <Text style={[styles.dayNumber, { color: active ? appTheme.colors.accent : appTheme.colors.text }]}>
                      {day.day}
                    </Text>
                    {count ? (
                      <View style={[styles.dayDot, { backgroundColor: appTheme.colors.success }]}>
                        <Text style={styles.dayDotText}>{count}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            {data?.warnings?.length ? (
              <Card style={[styles.warningCard, { borderColor: appTheme.colors.warningSoft }]}>
                <Text style={[styles.warningTitle, { color: appTheme.colors.warning }]}>Backend notes</Text>
                {data.warnings.map((warning) => (
                  <Text key={warning} style={[styles.warningText, { color: appTheme.colors.textMuted }]}>
                    {warning}
                  </Text>
                ))}
              </Card>
            ) : null}

            {error ? (
              <ErrorState
                title="Календарь временно недоступен"
                message={error}
                actionTitle="Проверить снова"
                onAction={reload}
              />
            ) : null}

            <SectionTitle title="События выбранного дня" subtitle={formatEntityDate(selectedDate)} />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState title="Собираем календарь" />
          ) : (
            <EmptyState
              title="Пока нет событий"
              message="На выбранный день событий нет. Проверьте другой день месяца или обновите календарь."
            />
          )
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const AgendaCard = memo(function AgendaCard({
  item,
  onPress,
}: {
  item: CalendarAgendaItem;
  onPress: () => void;
}) {
  const appTheme = useAppTheme();
  const isTask = item.type === 'task';

  return (
    <Pressable
      disabled={!item.route}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Card glass style={styles.agendaCard}>
        <View style={[styles.iconBubble, { backgroundColor: appTheme.colors.primarySoft }]}>
          <Ionicons
            name={isTask ? 'checkbox-outline' : 'calendar-outline'}
            size={20}
            color={isTask ? appTheme.colors.accent : appTheme.colors.success}
          />
        </View>
        <View style={styles.agendaBody}>
          <Text style={[styles.agendaDate, { color: appTheme.colors.accent }]}>{formatEntityDate(item.date)}</Text>
          <Text style={[styles.agendaTitle, { color: appTheme.colors.text }]}>{item.title}</Text>
          {item.subtitle ? <Text style={[styles.agendaSubtitle, { color: appTheme.colors.textMuted }]}>{item.subtitle}</Text> : null}
          <View style={styles.pills}>
            <StatusPill label={isTask ? 'Задача' : 'Событие'} tone={isTask ? 'accent' : 'success'} />
            <StatusPill label={getStatusLabel(item.status)} tone="muted" />
          </View>
        </View>
        {item.route ? <Ionicons name="chevron-forward" size={20} color={appTheme.colors.textMuted} /> : null}
      </Card>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  listContent: {
    gap: theme.spacing.md,
    paddingBottom: 116,
  },
  headerStack: {
    gap: theme.spacing.lg,
  },
  hero: {
    gap: theme.spacing.md,
  },
  heroKicker: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  heroText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  monthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  monthButton: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  monthTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  warningCard: {
    gap: theme.spacing.sm,
    borderColor: theme.colors.warningSoft,
  },
  warningTitle: {
    color: theme.colors.warning,
    fontSize: 14,
    fontWeight: '900',
  },
  warningText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  dayStrip: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.lg,
  },
  dayChip: {
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: 3,
    minHeight: 74,
    minWidth: 56,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  dayWeek: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '900',
  },
  dayDot: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dayDotText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  agendaCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  agendaBody: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  agendaDate: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  agendaTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
  },
  agendaSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.72,
  },
});
