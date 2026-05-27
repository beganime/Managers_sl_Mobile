import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { extractCount, extractItems } from '../../api/client';
import { listServiceCategories, listServicePrices, listServices } from '../../api/services';
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

export function ServicesScreen() {
  const loadServices = useCallback(async () => {
    const [categories, services, prices] = await Promise.all([
      listServiceCategories({ limit: 1 }),
      listServices({ limit: 10 }),
      listServicePrices({ limit: 1 }),
    ]);

    return {
      services: extractItems<ApiListItem>(services),
      categoryCount: extractCount(categories),
      serviceCount: extractCount(services),
      priceCount: extractCount(prices),
    };
  }, []);

  const { data, loading, error, reload } = useAsyncResource(loadServices);

  return (
    <ScreenContainer>
      <Header title="Услуги" subtitle="Категории, услуги и прайс-листы." />
      {loading && !data ? <LoadingState /> : null}
      {error && !data ? <ErrorState message={error} actionTitle="Повторить" onAction={reload} /> : null}
      {data ? (
        <>
          <View style={styles.stats}>
            <StatCard label="Категории" value={data.categoryCount} tone="primary" />
            <StatCard label="Услуги" value={data.serviceCount} tone="accent" />
            <StatCard label="Цены" value={data.priceCount} tone="warning" />
          </View>
          <SectionTitle title="Услуги" />
          <ResourceList items={data.services} emptyTitle="Услуг пока нет" />
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
