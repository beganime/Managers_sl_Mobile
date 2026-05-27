import React, { useCallback } from 'react';

import { listCalendarEvents } from '../../api/calendar';
import { ErrorState } from '../../components/ui/ErrorState';
import { Header } from '../../components/layout/Header';
import { LoadingState } from '../../components/ui/LoadingState';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { useAsyncResource } from '../../hooks/useAsyncResource';

export function CalendarScreen() {
  const loadEvents = useCallback(() => listCalendarEvents(), []);
  const { loading, error, reload } = useAsyncResource(loadEvents);

  return (
    <ScreenContainer>
      <Header title="Календарь" subtitle="Раздел готов к подключению после backend endpoint." />
      {loading ? <LoadingState /> : null}
      {error ? (
        <ErrorState
          title="Нужен endpoint календаря"
          message={error}
          actionTitle="Проверить снова"
          onAction={reload}
        />
      ) : null}
    </ScreenContainer>
  );
}
