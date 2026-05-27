import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { listApplications, listClients, listLeads } from '../../api/crm';
import { extractCount, extractItems } from '../../api/client';
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

type CrmData = {
  counts: {
    leads: number;
    clients: number;
    applications: number;
  };
  leads: ApiListItem[];
  clients: ApiListItem[];
};

export function CrmScreen() {
  const loadCrm = useCallback(async (): Promise<CrmData> => {
    const [leads, clients, applications] = await Promise.all([
      listLeads({ limit: 5 }),
      listClients({ limit: 5 }),
      listApplications({ limit: 1 }),
    ]);

    return {
      counts: {
        leads: extractCount(leads),
        clients: extractCount(clients),
        applications: extractCount(applications),
      },
      leads: extractItems<ApiListItem>(leads),
      clients: extractItems<ApiListItem>(clients),
    };
  }, []);

  const { data, loading, error, reload } = useAsyncResource(loadCrm);

  return (
    <ScreenContainer>
      <Header title="CRM" subtitle="Лиды, клиенты и заявки из новой CRM ManagerSL." />

      {loading && !data ? <LoadingState /> : null}
      {error && !data ? <ErrorState message={error} actionTitle="Повторить" onAction={reload} /> : null}

      {data ? (
        <>
          <View style={styles.stats}>
            <StatCard label="Лиды" value={data.counts.leads} tone="primary" />
            <StatCard label="Клиенты" value={data.counts.clients} tone="accent" />
            <StatCard label="Заявки" value={data.counts.applications} tone="warning" />
          </View>

          <SectionTitle title="Свежие лиды" />
          <ResourceList
            items={data.leads}
            emptyTitle="Лидов нет"
            emptyMessage="Новые лиды появятся здесь после синхронизации с CRM."
          />

          <SectionTitle title="Клиенты" />
          <ResourceList items={data.clients} emptyTitle="Клиентов нет" />
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
