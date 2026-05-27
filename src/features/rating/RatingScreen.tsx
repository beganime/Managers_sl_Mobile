import React, { useCallback } from 'react';

import { extractItems } from '../../api/client';
import { getRating } from '../../api/rating';
import { ApiListItem } from '../../types';
import { ErrorState } from '../../components/ui/ErrorState';
import { Header } from '../../components/layout/Header';
import { LoadingState } from '../../components/ui/LoadingState';
import { ResourceList } from '../../components/layout/ResourceList';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { useAsyncResource } from '../../hooks/useAsyncResource';

export function RatingScreen() {
  const loadRating = useCallback(async () => {
    const payload = await getRating({ limit: 20 });
    return extractItems<ApiListItem>(payload);
  }, []);

  const { data, loading, error, reload } = useAsyncResource(loadRating);

  return (
    <ScreenContainer>
      <Header title="Рейтинг" subtitle="Командный рейтинг ManagerSL." />
      {loading && !data ? <LoadingState /> : null}
      {error && !data ? <ErrorState message={error} actionTitle="Повторить" onAction={reload} /> : null}
      {data ? (
        <>
          <SectionTitle title="Участники" />
          <ResourceList items={data} emptyTitle="Рейтинг пока пуст" />
        </>
      ) : null}
    </ScreenContainer>
  );
}
