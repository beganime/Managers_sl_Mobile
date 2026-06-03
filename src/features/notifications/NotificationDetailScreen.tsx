import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { getNotification, markNotificationRead } from '../../api/notifications';
import { toApiError } from '../../api/client';
import { Card } from '../../components/cards/Card';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { StatusPill } from '../../components/ui/StatusPill';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { theme } from '../../theme/theme';
import { ApiListItem } from '../../types';
import {
  formatEntityDate,
  getEntityArray,
  getEntityId,
  getEntityString,
  getEntityTitle,
  stripHtml,
} from '../../utils/entity';

export function NotificationDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const [saving, setSaving] = useState(false);

  const loader = useCallback(() => getNotification(id), [id]);
  const { data, loading, error, reload } = useAsyncResource(loader);

  const markRead = async () => {
    setSaving(true);

    try {
      await markNotificationRead(id);
      await reload();
    } catch (requestError) {
      Alert.alert('Уведомление', toApiError(requestError).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <ScreenContainer>
        <Header title="Уведомление" showBack />
        <LoadingState title="Открываем уведомление" />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer>
        <Header title="Уведомление" showBack />
        <ErrorState message={error} actionTitle="Повторить" onAction={reload} />
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <Header title="Уведомление" showBack />
        <EmptyState title="Уведомление не найдено" />
      </ScreenContainer>
    );
  }

  const item = data as ApiListItem;
  const logs = getEntityArray<ApiListItem>(item, 'logs');

  return (
    <ScreenContainer>
      <Header
        title="Уведомление"
        subtitle={formatEntityDate(item.created_at)}
        showBack
        parentFallback="/(app)/notifications"
      />

      <Card glass style={styles.hero}>
        <Text style={styles.heroKicker}>{getEntityString(item, ['type_display', 'notification_type'], 'Notification')}</Text>
        <Text style={styles.heroTitle}>{getEntityTitle(item, 'Уведомление')}</Text>
        <Text style={styles.heroText}>{stripHtml(getEntityString(item, ['body', 'message', 'text'])) || 'Без текста'}</Text>
        <View style={styles.pills}>
          <StatusPill label={getEntityString(item, ['status_display', 'status'], 'Статус')} tone="accent" />
          <StatusPill label={getEntityString(item, ['priority_display', 'priority'], 'Обычный')} tone="primary" />
          <StatusPill label={getEntityString(item, ['channel_display', 'channel'], 'in-app')} tone="muted" />
        </View>
        <Button title="Отметить прочитанным" loading={saving} onPress={markRead} />
      </Card>

      <SectionTitle title="Детали" />
      <View style={styles.metaGrid}>
        <Meta label="Отправитель" value={getEntityString(item, ['sender_name'], 'Система')} />
        <Meta label="Получатель" value={getEntityString(item, ['recipient_name'], 'Не указан')} />
        <Meta label="Шаблон" value={getEntityString(item, ['template_name'], 'Не указан')} />
        <Meta label="Пакет" value={getEntityString(item, ['batch_title'], 'Не указан')} />
        <Meta label="Отправлено" value={formatEntityDate(item.sent_at) || 'Не отправлено'} />
        <Meta label="Прочитано" value={formatEntityDate(item.read_at) || 'Не прочитано'} />
      </View>

      {logs.length ? (
        <>
          <SectionTitle title="Логи доставки" />
          <View style={styles.stack}>
            {logs.map((log) => (
              <Card key={String(getEntityId(log))} style={styles.block}>
                <Text style={styles.rowTitle}>{getEntityString(log, ['channel_display', 'channel'], 'Канал')}</Text>
                <Text style={styles.rowSubtitle}>
                  {[getEntityString(log, ['status_display', 'status']), formatEntityDate(log.created_at)]
                    .filter(Boolean)
                    .join(' - ')}
                </Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}
    </ScreenContainer>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
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
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  meta: {
    flex: 1,
    minWidth: 145,
    gap: 5,
    paddingVertical: theme.spacing.md,
  },
  metaLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metaValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 19,
  },
  stack: {
    gap: theme.spacing.md,
  },
  block: {
    gap: theme.spacing.sm,
  },
  rowTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  rowSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});
