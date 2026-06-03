import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import {
  confirmExpense,
  confirmIncome,
  getDeal,
  getExpense,
  getIncome,
  getTransaction,
  rejectIncome,
} from '../../api/finance';
import { toApiError } from '../../api/client';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
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
  getEntityString,
  getEntityTitle,
  stripHtml,
} from '../../utils/entity';
import {
  displayFinanceStatus,
  financeStatusTone,
  getMoneyAmount,
  getUsdAmount,
} from './financeHelpers';

function loadFinanceItem(section: string, id: string) {
  if (section === 'expenses') return getExpense(id);
  if (section === 'deals') return getDeal(id);
  if (section === 'transactions') return getTransaction(id);
  return getIncome(id);
}

function getSectionTitle(section: string) {
  if (section === 'expenses') return 'Расход';
  if (section === 'deals') return 'Сделка';
  if (section === 'transactions') return 'Транзакция';
  return 'Доход';
}

export function FinanceDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section: string; id: string }>();
  const section = params.section || 'incomes';
  const id = params.id;
  const [saving, setSaving] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loader = useCallback(() => loadFinanceItem(section, id), [id, section]);
  const { data, loading, error, reload } = useAsyncResource(loader);

  const runAction = async (action: 'confirm' | 'reject') => {
    setSaving(action);

    try {
      if (section === 'expenses') {
        await confirmExpense(id);
      } else if (action === 'reject') {
        await rejectIncome(id, rejectReason.trim());
      } else {
        await confirmIncome(id);
      }

      await reload();
    } catch (requestError) {
      Alert.alert(getSectionTitle(section), toApiError(requestError).message);
    } finally {
      setSaving(null);
    }
  };

  if (loading && !data) {
    return (
      <ScreenContainer>
        <Header title={getSectionTitle(section)} showBack />
        <LoadingState title="Открываем финансовую запись" />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer>
        <Header title={getSectionTitle(section)} showBack />
        <ErrorState message={error} actionTitle="Повторить" onAction={reload} />
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <Header title={getSectionTitle(section)} showBack />
        <EmptyState title="Запись не найдена" />
      </ScreenContainer>
    );
  }

  const item = data as ApiListItem;
  const statusKey = getEntityString(
    item,
    ['status', 'payment_status', 'transaction_type'],
    getEntityString(item, ['is_confirmed']) === 'true' ? 'confirmed' : 'pending'
  );
  const canConfirm = section === 'incomes' || section === 'expenses';
  const isConfirmed = statusKey === 'confirmed' || getEntityString(item, ['is_confirmed']) === 'true';

  return (
    <ScreenContainer>
      <Header
        title={getSectionTitle(section)}
        subtitle={formatEntityDate(item.date || item.payment_date || item.created_at)}
        showBack
        parentFallback="/(app)/(tabs)/finance"
      />

      <Card glass style={styles.hero}>
        <Text style={styles.heroKicker}>ManagerSL finance</Text>
        <Text style={styles.heroTitle}>{getEntityTitle(item, getSectionTitle(section))}</Text>
        <Text style={styles.amount}>{getMoneyAmount(item)}</Text>
        <View style={styles.pills}>
          <StatusPill
            label={displayFinanceStatus(item, ['status', 'payment_status', 'transaction_type'])}
            tone={financeStatusTone(statusKey)}
          />
          <StatusPill label={getUsdAmount(item)} tone="primary" />
        </View>
        {canConfirm ? (
          <View style={styles.actions}>
            <Button
              title={isConfirmed ? 'Уже подтверждено' : 'Подтвердить'}
              disabled={isConfirmed}
              loading={saving === 'confirm'}
              onPress={() => runAction('confirm')}
            />
            {section === 'incomes' && !isConfirmed ? (
              <Button
                title="Отклонить"
                variant="danger"
                loading={saving === 'reject'}
                onPress={() => runAction('reject')}
              />
            ) : null}
          </View>
        ) : null}
      </Card>

      {section === 'incomes' && !isConfirmed ? (
        <Card style={styles.block}>
          <Input
            label="Причина отклонения"
            placeholder="Заполните перед нажатием «Отклонить»"
            value={rejectReason}
            onChangeText={setRejectReason}
          />
        </Card>
      ) : null}

      <SectionTitle title="Детали" />
      <View style={styles.metaGrid}>
        <Meta label="Касса" value={getEntityString(item, ['cashbox_name'], 'Не указана')} />
        <Meta label="Клиент" value={getEntityString(item, ['client_name'], 'Не указан')} />
        <Meta label="Сделка" value={getEntityString(item, ['deal_title'], 'Не указана')} />
        <Meta label="Менеджер" value={getEntityString(item, ['manager_name', 'employee_name'], 'Не указан')} />
        <Meta label="Компания" value={getEntityString(item, ['company_name'], 'Не указана')} />
        <Meta label="Офис" value={getEntityString(item, ['office_name'], 'Не указан')} />
      </View>

      <SectionTitle title="Комментарий" />
      <Card style={styles.block}>
        <Text style={styles.bodyText}>
          {stripHtml(getEntityString(item, ['comment', 'source', 'description'])) || 'Комментарий не заполнен.'}
        </Text>
      </Card>

      <Button title="Назад к финансам" variant="secondary" onPress={() => router.replace('/(app)/(tabs)/finance' as any)} />
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
  amount: {
    color: theme.colors.accent,
    fontSize: 24,
    fontWeight: '900',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  block: {
    gap: theme.spacing.md,
  },
  bodyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
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
});
