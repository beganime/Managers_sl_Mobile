import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { memo, useCallback } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

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
import { formatEntityDate, getStatusLabel } from '../../utils/entity';

export function CalendarScreen() {
  const router = useRouter();
  const loadEvents = useCallback(() => listCalendarEvents(), []);
  const { data, loading, error, reload } = useAsyncResource(loadEvents);
  const items = data?.items || [];

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
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            onRefresh={reload}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <Header
              title="Календарь"
              subtitle="Agenda из задач, дедлайнов и рабочего дня."
              showBack
              parentFallback="/(app)/(tabs)/more"
            />

            <Card glass style={styles.hero}>
              <Text style={styles.heroKicker}>Calendar</Text>
              <Text style={styles.heroTitle}>Сегодня, задачи и встречи</Text>
              <Text style={styles.heroText}>
                Мобильный календарь использует подтверждённые endpoints: проекты и attendance. Portal events подключатся после API.
              </Text>
              <View style={styles.pills}>
                <StatusPill label={`${items.length} событий`} tone="success" />
                <StatusPill label="Без неподтверждённых URL" tone="primary" />
              </View>
            </Card>

            {data?.warnings?.length ? (
              <Card style={styles.warningCard}>
                <Text style={styles.warningTitle}>Backend notes</Text>
                {data.warnings.map((warning) => (
                  <Text key={warning} style={styles.warningText}>
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

            <SectionTitle title="Ближайшее" />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState title="Собираем календарь" />
          ) : (
            <EmptyState
              title="Пока нет событий"
              message="Добавьте дедлайны задач или начните рабочий день, и они появятся здесь."
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
  const isTask = item.type === 'task';

  return (
    <Pressable
      disabled={!item.route}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Card style={styles.agendaCard}>
        <View style={styles.iconBubble}>
          <Ionicons
            name={isTask ? 'checkbox-outline' : 'briefcase-outline'}
            size={20}
            color={isTask ? theme.colors.accent : theme.colors.primary}
          />
        </View>
        <View style={styles.agendaBody}>
          <Text style={styles.agendaDate}>{formatEntityDate(item.date)}</Text>
          <Text style={styles.agendaTitle}>{item.title}</Text>
          {item.subtitle ? <Text style={styles.agendaSubtitle}>{item.subtitle}</Text> : null}
          <View style={styles.pills}>
            <StatusPill label={isTask ? 'Задача' : 'Рабочий день'} tone={isTask ? 'accent' : 'primary'} />
            <StatusPill label={getStatusLabel(item.status)} tone="muted" />
          </View>
        </View>
        {item.route ? <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} /> : null}
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
