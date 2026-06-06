import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { convertLead, getLead } from '../../api/crm';
import { ApiListItem } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/cards/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Header } from '../../components/layout/Header';
import { LoadingState } from '../../components/ui/LoadingState';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { toApiError } from '../../api/client';
import { DetailRow } from './components';
import { statusLabel } from './constants';

export function LeadDetailScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [converting, setConverting] = useState(false);
  const loadLead = useCallback(() => getLead(id), [id]);
  const { data, loading, error, reload } = useAsyncResource<ApiListItem>(loadLead);

  const handleConvert = async () => {
    if (!id) return;

    setConverting(true);

    try {
      const client = await convertLead(id);
      Alert.alert('Готово', 'Лид конвертирован в клиента.');
      router.replace(`/(app)/crm/clients/${client.id}` as any);
    } catch (requestError) {
      Alert.alert('Не удалось конвертировать', toApiError(requestError).message);
    } finally {
      setConverting(false);
    }
  };

  return (
    <ScreenContainer>
      <Header title="Карточка лида" subtitle="Контакт и статус потенциального клиента." showBack />

      {loading && !data ? <LoadingState /> : null}
      {error && !data ? <ErrorState message={error} actionTitle="Повторить" onAction={reload} /> : null}

      {data ? (
        <>
          <Card glass style={styles.hero}>
            <Text style={[styles.name, { color: appTheme.colors.text }]}>{String(data.full_name || data.name || 'Лид')}</Text>
            <Text style={[styles.status, { color: appTheme.colors.accent }]}>{statusLabel(data.status)}</Text>
          </Card>

          <View style={styles.actions}>
            <Button title="Создать клиента" loading={converting} onPress={handleConvert} />
            <Button
              title="Редактировать"
              variant="secondary"
              onPress={() => router.push(`/(app)/crm/leads/${id}/edit` as any)}
            />
          </View>

          <SectionTitle title="Контакты" />
          <Card>
            <DetailRow label="ФИО" value={data.full_name} />
            <DetailRow label="Телефон" value={data.phone} />
            <DetailRow label="Email" value={data.email} />
            <DetailRow label="Город" value={data.city} />
            <DetailRow label="Направление" value={data.direction} />
            <DetailRow label="Страна интереса" value={data.interested_country} />
            <DetailRow label="Программа" value={data.interested_program} />
            <DetailRow label="Ответственный" value={data.manager_name} />
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
  actions: {
    gap: theme.spacing.md,
  },
});
