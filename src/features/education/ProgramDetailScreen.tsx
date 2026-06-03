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
import { formatMoneyValue, formatRateToUsd } from '../../utils/money';

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
          {stripHtml(getEntityString(data, ['description'])) ||
            getEntityString(data, ['faculty'], 'Описание пока не заполнено.')}
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
            <FeeCard key={String(getEntityId(fee))} fee={fee} />
          ))}
        </View>
      ) : (
        <EmptyState title="Стоимость пока не указана" />
      )}

      <SectionTitle title="Наборы / Intakes" />
      {intakes.length ? (
        <View style={styles.stack}>
          {intakes.map((intake) => (
            <Card key={String(getEntityId(intake))} style={styles.block}>
              <Text style={styles.rowTitle}>{getEntityTitle(intake, 'Intake')}</Text>
              <Text style={styles.rowSubtitle}>
                {[
                  formatEntityDate(intake.start_date),
                  formatEntityDate(intake.application_deadline),
                ]
                  .filter(Boolean)
                  .join(' - ')}
              </Text>
              <Text style={styles.rowSubtitle}>{stripHtml(getEntityString(intake, ['notes']))}</Text>
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
                <StatusPill
                  label={getEntityString(doc, ['is_mandatory'], 'true') === 'false' ? 'Опционально' : 'Обязательно'}
                  tone="accent"
                />
              </Card>
            ))}
          </View>
        </>
      ) : null}
    </ScreenContainer>
  );
}

function FeeCard({ fee }: { fee: ApiListItem }) {
  const currency = getEntityString(fee, ['currency_code'], 'USD').toUpperCase();
  const rate = formatRateToUsd(getEntityString(fee, ['currency_rate_to_usd']), currency);

  return (
    <Card style={styles.block}>
      <Text style={styles.rowTitle}>Стоимость программы</Text>
      <FeeRow label="Обучение" value={formatOfficialAndUsd(fee, 'tuition_fee', 'tuition_fee_usd', currency)} />
      <FeeRow label="Услуги компании" value={formatMoneyValue(getEntityString(fee, ['service_fee_usd']), 'USD')} />
      <FeeRow label="Application fee" value={formatOfficialAndUsd(fee, 'application_fee', 'application_fee_usd', currency)} />
      <FeeRow label="Общежитие" value={formatOfficialAndUsd(fee, 'dormitory_fee', 'dormitory_fee_usd', currency)} />
      <FeeRow label="Страховка" value={formatOfficialAndUsd(fee, 'insurance_fee', 'insurance_fee_usd', currency)} />
      {rate ? <Text style={styles.rowSubtitle}>{rate}</Text> : null}
      {getEntityString(fee, ['notes']) ? (
        <Text style={styles.rowSubtitle}>{stripHtml(getEntityString(fee, ['notes']))}</Text>
      ) : null}
    </Card>
  );
}

function FeeRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;

  return (
    <View style={styles.feeRow}>
      <Text style={styles.feeLabel}>{label}</Text>
      <Text style={styles.feeValue}>{value}</Text>
    </View>
  );
}

function formatOfficialAndUsd(
  fee: ApiListItem,
  officialKey: string,
  usdKey: string,
  currency: string
) {
  const official = formatMoneyValue(getEntityString(fee, [officialKey]), currency);
  const usd = formatMoneyValue(getEntityString(fee, [usdKey]), 'USD');

  if (!official) return '';
  if (!usd || currency === 'USD') return official;

  return `${official} / ${usd}`;
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
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  feeLabel: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  feeValue: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
});
