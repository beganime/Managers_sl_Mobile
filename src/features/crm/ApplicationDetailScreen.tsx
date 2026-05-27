import { useLocalSearchParams } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, Text } from 'react-native';

import { getApplication } from '../../api/crm';
import { ApiListItem } from '../../types';
import { Card } from '../../components/cards/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Header } from '../../components/layout/Header';
import { LoadingState } from '../../components/ui/LoadingState';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { theme } from '../../theme/theme';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { DetailRow } from './components';
import { statusLabel } from './constants';

export function ApplicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const loadApplication = useCallback(() => getApplication(id), [id]);
  const { data, loading, error, reload } = useAsyncResource<ApiListItem>(loadApplication);

  return (
    <ScreenContainer>
      <Header title="Карточка заявки" subtitle="Заявка клиента на поступление." showBack />
      {loading && !data ? <LoadingState /> : null}
      {error && !data ? <ErrorState message={error} actionTitle="Повторить" onAction={reload} /> : null}
      {data ? (
        <>
          <Card glass style={styles.hero}>
            <Text style={styles.name}>{String(data.client_name || data.full_name || 'Заявка')}</Text>
            <Text style={styles.status}>{statusLabel(data.status_display || data.status)}</Text>
          </Card>
          <SectionTitle title="Детали" />
          <Card>
            <DetailRow label="Клиент" value={data.client_name} />
            <DetailRow label="Вуз" value={data.university_name} />
            <DetailRow label="Программа" value={data.program_name} />
            <DetailRow label="Менеджер" value={data.manager_name} />
            <DetailRow label="Дата подачи" value={data.submitted_at} />
            <DetailRow label="Дата решения" value={data.decision_at} />
            <DetailRow label="Комментарий" value={data.comment} />
          </Card>
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: theme.spacing.sm,
  },
  name: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  status: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '900',
  },
});
