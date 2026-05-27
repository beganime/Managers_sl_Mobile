import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getClient } from '../../api/crm';
import { ApiListItem } from '../../types';
import { Button } from '../../components/ui/Button';
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

export function ClientDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const loadClient = useCallback(() => getClient(id), [id]);
  const { data, loading, error, reload } = useAsyncResource<ApiListItem>(loadClient);

  return (
    <ScreenContainer>
      <Header title="Карточка клиента" subtitle="Профиль, контакты и документы клиента." showBack />

      {loading && !data ? <LoadingState /> : null}
      {error && !data ? <ErrorState message={error} actionTitle="Повторить" onAction={reload} /> : null}

      {data ? (
        <>
          <Card glass style={styles.hero}>
            <Text style={styles.name}>{String(data.full_name || 'Клиент')}</Text>
            <Text style={styles.status}>{statusLabel(data.status_display || data.status)}</Text>
            <Text style={styles.manager}>
              {data.manager_name ? `Ответственный: ${data.manager_name}` : 'Ответственный не указан'}
            </Text>
          </Card>

          <View style={styles.actions}>
            <Button
              title="Редактировать"
              onPress={() => router.push(`/(app)/crm/clients/${id}/edit` as any)}
            />
            <Button
              title="Timeline"
              variant="secondary"
              onPress={() => router.push(`/(app)/crm/clients/${id}/timeline` as any)}
            />
            <Button
              title="Создать документ"
              variant="secondary"
              onPress={() => router.push('/(app)/documents-v2' as any)}
            />
          </View>

          <SectionTitle title="Контакты" />
          <Card>
            <DetailRow label="Телефон" value={data.phone} />
            <DetailRow label="Email" value={data.email} />
            <DetailRow label="Дата рождения" value={data.dob} />
            <DetailRow label="Гражданство" value={data.citizenship} />
            <DetailRow label="Город" value={data.city} />
            <DetailRow label="Адрес" value={data.address} />
            <DetailRow label="Адрес регистрации" value={data.registration_address} />
          </Card>

          <SectionTitle title="Обучение" />
          <Card>
            <DetailRow label="Направление" value={data.direction} />
            <DetailRow label="Интересующая страна" value={data.interested_country} />
            <DetailRow label="Интересующий вуз" value={data.interested_university} />
            <DetailRow label="Интересующая программа" value={data.interested_program} />
          </Card>

          <SectionTitle title="Документы" />
          <Card>
            <DetailRow label="Паспорт" value={data.passport_local_num} />
            <DetailRow label="Загранпаспорт" value={data.passport_inter_num} />
            <DetailRow label="Кем выдан паспорт" value={data.passport_issued_by} />
            <DetailRow label="Дата выдачи" value={data.passport_issued_date} />
            <DetailRow label="Срок действия" value={data.passport_valid_until} />
            <DetailRow label="Комментарий" value={data.comments} />
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
  manager: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  actions: {
    gap: theme.spacing.md,
  },
});
