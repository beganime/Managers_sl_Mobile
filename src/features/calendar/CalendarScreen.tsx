import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { listCalendarEvents } from '../../api/calendar';
import { Card } from '../../components/cards/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Header } from '../../components/layout/Header';
import { LoadingState } from '../../components/ui/LoadingState';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { StatusPill } from '../../components/ui/StatusPill';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { theme } from '../../theme/theme';

export function CalendarScreen() {
  const loadEvents = useCallback(() => listCalendarEvents(), []);
  const { loading, error, reload } = useAsyncResource(loadEvents);

  return (
    <ScreenContainer>
      <Header
        title="Календарь"
        subtitle="Мобильный shell готов, backend endpoint пока не смонтирован."
        showBack
      />

      <Card glass style={styles.hero}>
        <Text style={styles.heroKicker}>Calendar</Text>
        <Text style={styles.heroTitle}>Сегодня, задачи и встречи</Text>
        <Text style={styles.heroText}>
          Раздел подготовлен под события, дедлайны проектов и рабочий день. Сейчас приложение не вызывает неподтверждённые URL.
        </Text>
        <View style={styles.pills}>
          <StatusPill label="Нужен GET /api/v1/calendar/events/" tone="warning" />
          <StatusPill label="UI готов" tone="success" />
        </View>
      </Card>

      {loading ? <LoadingState title="Проверяем календарный endpoint" /> : null}
      {error ? (
        <ErrorState
          title="Раздел скоро будет доступен"
          message={error}
          actionTitle="Проверить снова"
          onAction={reload}
        />
      ) : null}

      <SectionTitle title="Что будет подключено" />
      <View style={styles.stack}>
        <RoadmapCard title="События" text="Встречи, звонки, дедлайны поступлений и напоминания CRM." />
        <RoadmapCard title="Задачи" text="Дедлайны из /api/v1/projects/tasks/ уже готовы к объединению с календарём." />
        <RoadmapCard title="Рабочий день" text="Старт, закрытие и отчёт рабочего дня из attendance API." />
      </View>
    </ScreenContainer>
  );
}

function RoadmapCard({ title, text }: { title: string; text: string }) {
  return (
    <Card style={styles.roadmap}>
      <Text style={styles.roadmapTitle}>{title}</Text>
      <Text style={styles.roadmapText}>{text}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
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
  stack: {
    gap: theme.spacing.md,
  },
  roadmap: {
    gap: theme.spacing.sm,
  },
  roadmapTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  roadmapText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});
