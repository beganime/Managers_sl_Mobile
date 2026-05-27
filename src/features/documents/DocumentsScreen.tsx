import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { extractCount, extractItems } from '../../api/client';
import { listDocumentTemplates, listGeneratedDocuments } from '../../api/documents';
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

export function DocumentsScreen() {
  const loadDocuments = useCallback(async () => {
    const [templates, generated] = await Promise.all([
      listDocumentTemplates({ limit: 10 }),
      listGeneratedDocuments({ limit: 10 }),
    ]);

    return {
      templates: extractItems<ApiListItem>(templates),
      generated: extractItems<ApiListItem>(generated),
      templateCount: extractCount(templates),
      generatedCount: extractCount(generated),
    };
  }, []);

  const { data, loading, error, reload } = useAsyncResource(loadDocuments);

  return (
    <ScreenContainer>
      <Header title="Документы" subtitle="Шаблоны и сформированные документы ERP." />

      {loading && !data ? <LoadingState /> : null}
      {error && !data ? <ErrorState message={error} actionTitle="Повторить" onAction={reload} /> : null}

      {data ? (
        <>
          <View style={styles.stats}>
            <StatCard label="Шаблоны" value={data.templateCount} tone="primary" />
            <StatCard label="Создано" value={data.generatedCount} tone="accent" />
          </View>
          <SectionTitle title="Шаблоны" />
          <ResourceList items={data.templates} emptyTitle="Шаблонов пока нет" />
          <SectionTitle title="Созданные документы" />
          <ResourceList items={data.generated} emptyTitle="Документов пока нет" />
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
