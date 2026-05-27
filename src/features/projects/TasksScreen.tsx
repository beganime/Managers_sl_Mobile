import React, { useCallback } from 'react';

import { listProjectTasks } from '../../api/projects';
import { extractItems } from '../../api/client';
import { ApiListItem } from '../../types';
import { ErrorState } from '../../components/ui/ErrorState';
import { Header } from '../../components/layout/Header';
import { LoadingState } from '../../components/ui/LoadingState';
import { ResourceList } from '../../components/layout/ResourceList';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { useAsyncResource } from '../../hooks/useAsyncResource';

export function TasksScreen() {
  const loadTasks = useCallback(async () => {
    const payload = await listProjectTasks({ limit: 20 });
    return extractItems<ApiListItem>(payload);
  }, []);

  const { data, loading, error, reload } = useAsyncResource(loadTasks);

  return (
    <ScreenContainer>
      <Header title="Задачи" subtitle="Проектные задачи из /api/v1/projects/tasks/." />

      {loading && !data ? <LoadingState /> : null}
      {error && !data ? <ErrorState message={error} actionTitle="Повторить" onAction={reload} /> : null}

      {data ? (
        <>
          <SectionTitle title="Список задач" />
          <ResourceList items={data} emptyTitle="Открытых задач нет" />
        </>
      ) : null}
    </ScreenContainer>
  );
}
