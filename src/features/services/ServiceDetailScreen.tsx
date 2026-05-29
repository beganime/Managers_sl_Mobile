import { useLocalSearchParams } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getService } from '../../api/services';
import { Card } from '../../components/cards/Card';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
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

export function ServiceDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const loadService = useCallback(() => getService(id), [id]);
  const { data, loading, error, reload } = useAsyncResource(loadService);

  if (loading && !data) {
    return (
      <ScreenContainer>
        <Header title="Услуга" showBack />
        <LoadingState title="Открываем услугу" />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer>
        <Header title="Услуга" showBack />
        <ErrorState message={error} actionTitle="Повторить" onAction={reload} />
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <Header title="Услуга" showBack />
        <EmptyState title="Услуга не найдена" />
      </ScreenContainer>
    );
  }

  const prices = getEntityArray<ApiListItem>(data, 'prices');

  return (
    <ScreenContainer>
      <Header
        title="Услуга"
        subtitle={getEntityString(data, ['category_name'])}
        showBack
        parentFallback="/(app)/services-v2"
      />

      <Card glass style={styles.hero}>
        <Text style={styles.heroKicker}>{getEntityString(data, ['code'], 'Service')}</Text>
        <Text style={styles.heroTitle}>{getEntityTitle(data, 'Услуга')}</Text>
        <Text style={styles.heroText}>
          {stripHtml(getEntityString(data, ['description'])) || 'Описание пока не заполнено.'}
        </Text>
        <View style={styles.pills}>
          <StatusPill
            label={getEntityString(data, ['is_active'], 'true') === 'false' ? 'Неактивна' : 'Активна'}
            tone={getEntityString(data, ['is_active'], 'true') === 'false' ? 'muted' : 'success'}
          />
          <StatusPill label={getEntityString(data, ['currency_code'], 'валюта не указана')} tone="primary" />
        </View>
      </Card>

      <SectionTitle title="Прайс" />
      {prices.length ? (
        <View style={styles.stack}>
          {prices.map((price) => (
            <Card key={String(getEntityId(price))} style={styles.block}>
              <Text style={styles.price}>
                {[getEntityString(price, ['price', 'amount']), getEntityString(price, ['currency_code', 'currency_symbol'])]
                  .filter(Boolean)
                  .join(' ')}
              </Text>
              <Text style={styles.rowSubtitle}>
                {[formatEntityDate(price.valid_from), formatEntityDate(price.valid_to)].filter(Boolean).join(' - ')}
              </Text>
              <Text style={styles.rowSubtitle}>{getEntityString(price, ['notes'], 'Без примечаний')}</Text>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState title="Цены пока не добавлены" />
      )}
    </ScreenContainer>
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
  block: {
    gap: theme.spacing.sm,
  },
  price: {
    color: theme.colors.accent,
    fontSize: 20,
    fontWeight: '900',
  },
  rowSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});
