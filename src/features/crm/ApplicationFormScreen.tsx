import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { createApplication } from '../../api/crm';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { theme } from '../../theme/theme';
import { toApiError } from '../../api/client';

export function ApplicationFormScreen() {
  const router = useRouter();
  const [client, setClient] = useState('');
  const [universityName, setUniversityName] = useState('');
  const [programName, setProgramName] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const validation = useMemo(() => {
    if (!client.trim()) return 'Укажите ID клиента.';
    return null;
  }, [client]);

  const submit = useCallback(async () => {
    if (validation) {
      Alert.alert('Проверьте форму', validation);
      return;
    }

    setSaving(true);

    try {
      const application = await createApplication({
        client: Number(client),
        university_name: universityName.trim(),
        program_name: programName.trim(),
        comment: comment.trim(),
      });
      router.replace(`/(app)/crm/applications/${application.id}` as any);
    } catch (requestError) {
      Alert.alert('Не удалось создать заявку', toApiError(requestError).message);
    } finally {
      setSaving(false);
    }
  }, [client, comment, programName, router, universityName, validation]);

  return (
    <ScreenContainer>
      <Header title="Создать заявку" subtitle="Создание заявки на поступление для клиента." showBack />
      <Card style={styles.form}>
        <Input label="ID клиента" value={client} onChangeText={setClient} keyboardType="numeric" />
        <Input label="Название вуза" value={universityName} onChangeText={setUniversityName} />
        <Input label="Программа" value={programName} onChangeText={setProgramName} />
        <Input label="Комментарий" value={comment} onChangeText={setComment} multiline />
        <Button title="Создать заявку" loading={saving} onPress={submit} />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: theme.spacing.md,
  },
});
