import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { extractCount, extractItems } from '../../api/client';
import { listPrograms, listUniversities } from '../../api/education';
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

export function EducationScreen() {
  const loadEducation = useCallback(async () => {
    const [universities, programs] = await Promise.all([
      listUniversities({ limit: 20 }),
      listPrograms({ limit: 1 }),
    ]);

    return {
      universities: extractItems<ApiListItem>(universities),
      universityCount: extractCount(universities),
      programCount: extractCount(programs),
    };
  }, []);

  const { data, loading, error, reload } = useAsyncResource(loadEducation);

  return (
    <ScreenContainer>
      <Header title="Вузы" subtitle="Новый каталог образования через /api/v1/education/." />

      {loading && !data ? <LoadingState /> : null}
      {error && !data ? <ErrorState message={error} actionTitle="Повторить" onAction={reload} /> : null}

      {data ? (
        <>
          <View style={styles.stats}>
            <StatCard label="Вузы" value={data.universityCount} tone="primary" />
            <StatCard label="Программы" value={data.programCount} tone="accent" />
          </View>

          <SectionTitle title="Университеты" />
          <ResourceList items={data.universities} emptyTitle="Университетов пока нет" />
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
