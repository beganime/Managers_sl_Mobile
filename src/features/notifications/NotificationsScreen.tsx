import React, { useCallback } from 'react';

import { extractItems } from '../../api/client';
import { listNotifications } from '../../api/notifications';
import { ApiListItem } from '../../types';
import { ErrorState } from '../../components/ui/ErrorState';
import { Header } from '../../components/layout/Header';
import { LoadingState } from '../../components/ui/LoadingState';
import { ResourceList } from '../../components/layout/ResourceList';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { useAsyncResource } from '../../hooks/useAsyncResource';

export function NotificationsScreen() {
  const loadNotifications = useCallback(async () => {
    const payload = await listNotifications({ limit: 30 });
    return extractItems<ApiListItem>(payload);
  }, []);

  const { data, loading, error, reload } = useAsyncResource(loadNotifications);

  return (
    <ScreenContainer>
      <Header title="Уведомления" subtitle="Последние уведомления из ERP." />
      {loading && !data ? <LoadingState /> : null}
      {error && !data ? <ErrorState message={error} actionTitle="Повторить" onAction={reload} /> : null}
      {data ? (
        <>
          <SectionTitle title="Лента" />
          <ResourceList items={data} emptyTitle="Уведомлений пока нет" />
        </>
      ) : null}
    </ScreenContainer>
  );
}
