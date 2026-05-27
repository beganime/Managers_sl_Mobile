import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { extractCount, extractItems } from '../../api/client';
import { listKnowledgeArticles, listKnowledgeFolders } from '../../api/knowledge';
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

export function KnowledgeScreen() {
  const loadKnowledge = useCallback(async () => {
    const [folders, articles] = await Promise.all([
      listKnowledgeFolders({ limit: 10 }),
      listKnowledgeArticles({ limit: 10 }),
    ]);

    return {
      folders: extractItems<ApiListItem>(folders),
      articles: extractItems<ApiListItem>(articles),
      folderCount: extractCount(folders),
      articleCount: extractCount(articles),
    };
  }, []);

  const { data, loading, error, reload } = useAsyncResource(loadKnowledge);

  return (
    <ScreenContainer>
      <Header title="База знаний" subtitle="Папки и статьи из нового knowledge API." />

      {loading && !data ? <LoadingState /> : null}
      {error && !data ? <ErrorState message={error} actionTitle="Повторить" onAction={reload} /> : null}

      {data ? (
        <>
          <View style={styles.stats}>
            <StatCard label="Папки" value={data.folderCount} tone="primary" />
            <StatCard label="Статьи" value={data.articleCount} tone="accent" />
          </View>
          <SectionTitle title="Папки" />
          <ResourceList items={data.folders} emptyTitle="Папок пока нет" />
          <SectionTitle title="Статьи" />
          <ResourceList items={data.articles} emptyTitle="Статей пока нет" />
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
