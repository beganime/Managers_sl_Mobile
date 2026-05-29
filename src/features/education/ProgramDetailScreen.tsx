import { useLocalSearchParams } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getProgram } from '../../api/education';
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

export function ProgramDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const loadProgram = useCallback(() => getProgram(id), [id]);
  const { data, loading, error, reload } = useAsyncResource(loadProgram);

  if (loading && !data) {
    return (
      <ScreenContainer>
        <Header title="Программа" showBack />
        <LoadingState title="Открываем программу" />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer>
        <Header title="Программа" showBack />
        <ErrorState message={error} actionTitle="Повторить" onAction={reload} />
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <Header title="Программа" showBack />
        <EmptyState title="Программа не найдена" />
      </ScreenContainer>
    );
  }

  const fees = getEntityArray<ApiListItem>(data, 'fees');
  const intakes = getEntityArray<ApiListItem>(data, 'intakes');
  const docs = getEntityArray<ApiListItem>(data, 'required_documents');

  return (
    <ScreenContainer>
      <Header
        title="Программа"
        subtitle={getEntityString(data, ['university_name'])}
        showBack
        parentFallback="/(app)/education"
      />

      <Card glass style={styles.hero}>
        <Text style={styles.heroKicker}>{getEntityString(data, ['country_name'], 'Education')}</Text>
        <Text style={styles.heroTitle}>{getEntityTitle(data, 'Программа')}</Text>
        <Text style={styles.heroText}>
          {stripHtml(getEntityString(data, ['description'])) || getEntityString(data, ['faculty'], 'Описание пока не заполнено.')}
        </Text>
        <View style={styles.pills}>
          <StatusPill label={getEntityString(data, ['degree_display', 'degree'], 'Degree не указан')} tone="primary" />
          <StatusPill label={getEntityString(data, ['language'], 'Язык не указан')} tone="accent" />
          <StatusPill label={getEntityString(data, ['duration'], 'Срок не указан')} tone="muted" />
        </View>
      </Card>

      <SectionTitle title="Стоимость" />
      {fees.length ? (
        <View style={styles.stack}>
          {fees.map((fee) => (
            <Card key={String(getEntityId(fee))} style={styles.block}>
              <Text style={styles.rowTitle}>{getEntityTitle(fee, 'Стоимость')}</Text>
              <Text style={styles.rowSubtitle}>
                {[getEntityString(fee, ['amount']), getEntityString(fee, ['currency_code', 'currency_symbol'])]
                  .filter(Boolean)
                  .join(' ')}
              </Text>
              <Text style={styles.rowSubtitle}>{getEntityString(fee, ['fee_type', 'title'])}</Text>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState title="Стоимость пока не указана" />
      )}

      <SectionTitle title="Intakes" />
      {intakes.length ? (
        <View style={styles.stack}>
          {intakes.map((intake) => (
            <Card key={String(getEntityId(intake))} style={styles.block}>
              <Text style={styles.rowTitle}>{getEntityTitle(intake, 'Intake')}</Text>
              <Text style={styles.rowSubtitle}>
                {[formatEntityDate(intake.start_date), formatEntityDate(intake.deadline)].filter(Boolean).join(' - ')}
              </Text>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState title="Intakes пока не добавлены" />
      )}

      {docs.length ? (
        <>
          <SectionTitle title="Документы" />
          <View style={styles.stack}>
            {docs.map((doc) => (
              <Card key={String(getEntityId(doc))} style={styles.block}>
                <Text style={styles.rowTitle}>{getEntityTitle(doc, 'Документ')}</Text>
                <Text style={styles.rowSubtitle}>{stripHtml(getEntityString(doc, ['description']))}</Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}
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
