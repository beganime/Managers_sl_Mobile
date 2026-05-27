import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { extractCount, extractItems } from '../../api/client';
import { listDeals, listExpenses, listIncomes, listTransactions } from '../../api/finance';
import { ApiListItem } from '../../types';
import { ErrorState } from '../../components/ui/ErrorState';
import { Header } from '../../components/layout/Header';
import { LoadingState } from '../../components/ui/LoadingState';
import { ResourceList } from '../../components/layout/ResourceList';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { StatCard } from '../../components/cards/StatCard';
import { theme } from '../../theme/theme';
import { useAsyncResource } from '../../hooks/useAsyncResource';

type FinanceData = {
  counts: {
    deals: number;
    incomes: number;
    expenses: number;
    transactions: number;
  };
  deals: ApiListItem[];
  transactions: ApiListItem[];
};

export function FinanceScreen() {
  const loadFinance = useCallback(async (): Promise<FinanceData> => {
    const [deals, incomes, expenses, transactions] = await Promise.all([
      listDeals({ limit: 5 }),
      listIncomes({ limit: 1 }),
      listExpenses({ limit: 1 }),
      listTransactions({ limit: 5 }),
    ]);

    return {
      counts: {
        deals: extractCount(deals),
        incomes: extractCount(incomes),
        expenses: extractCount(expenses),
        transactions: extractCount(transactions),
      },
      deals: extractItems<ApiListItem>(deals),
      transactions: extractItems<ApiListItem>(transactions),
    };
  }, []);

  const { data, loading, error, reload } = useAsyncResource(loadFinance);

  return (
    <ScreenContainer>
      <Header title="Финансы" subtitle="Сделки, поступления, расходы и транзакции." />

      {loading && !data ? <LoadingState /> : null}
      {error && !data ? <ErrorState message={error} actionTitle="Повторить" onAction={reload} /> : null}

      {data ? (
        <>
          <View style={styles.stats}>
            <StatCard label="Сделки" value={data.counts.deals} tone="primary" />
            <StatCard label="Доходы" value={data.counts.incomes} tone="accent" />
            <StatCard label="Расходы" value={data.counts.expenses} tone="danger" />
            <StatCard label="Транзакции" value={data.counts.transactions} tone="warning" />
          </View>

          <SectionTitle title="Сделки" />
          <ResourceList items={data.deals} emptyTitle="Сделок пока нет" />

          <SectionTitle title="Последние транзакции" />
          <ResourceList items={data.transactions} emptyTitle="Транзакций пока нет" />
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
});
