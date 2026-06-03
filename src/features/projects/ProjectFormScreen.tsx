import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { createProject, getProject, updateProject } from '../../api/projects';
import { toApiError } from '../../api/client';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { theme } from '../../theme/theme';
import { getEntityId, getEntityString } from '../../utils/entity';
import { projectFormStatusOptions } from './projectHelpers';

export function ProjectFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;

  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [status, setStatus] = useState('active');
  const [saving, setSaving] = useState(false);
  const [loadedEditId, setLoadedEditId] = useState<string | null>(null);

  const loadProject = useCallback(
    () => (editId ? getProject(editId) : Promise.resolve(null)),
    [editId]
  );

  const { data, loading, error, reload } = useAsyncResource(loadProject);

  useEffect(() => {
    if (!data || loadedEditId === editId) return;

    setTitle(getEntityString(data, ['title', 'name']));
    setCode(getEntityString(data, ['code']));
    setDescription(getEntityString(data, ['description']));
    setDeadline(getEntityString(data, ['deadline']));
    setStatus(getEntityString(data, ['status'], 'active'));
    setLoadedEditId(editId || null);
  }, [data, editId, loadedEditId]);

  const submit = async () => {
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      Alert.alert('Проект', 'Введите название проекта.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        title: cleanTitle,
        code: code.trim(),
        description: description.trim(),
        deadline: deadline.trim() || null,
        status,
      };

      const saved = editId ? await updateProject(editId, payload) : await createProject(payload);
      router.replace(`/(app)/projects-v2/${getEntityId(saved) || editId}` as any);
    } catch (requestError) {
      Alert.alert('Проект', toApiError(requestError).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && editId && !data) {
    return (
      <ScreenContainer>
        <Header title="Редактировать проект" showBack />
        <LoadingState title="Готовим форму" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Header
        title={editId ? 'Редактировать проект' : 'Новый проект'}
        subtitle="Создайте проект и назначьте ответственных."
        showBack
        parentFallback="/(app)/(tabs)/tasks"
      />

      {error ? <ErrorState message={error} actionTitle="Повторить" onAction={reload} /> : null}

      <Card glass style={styles.form}>
        <Input
          label="Название"
          placeholder="Например: Набор на осенний intake"
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label="Код"
          placeholder="CRM-2026-01"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
        />
        <Input
          label="Описание"
          placeholder="Цель проекта и основной результат"
          value={description}
          onChangeText={setDescription}
          multiline
          style={styles.textarea}
        />
        <Input
          label="Срок"
          placeholder="YYYY-MM-DD"
          value={deadline}
          onChangeText={setDeadline}
        />

        <SectionTitle title="Статус" />
        <SegmentedControl options={projectFormStatusOptions} value={status} onChange={setStatus} />

        <Button
          title={editId ? 'Сохранить проект' : 'Создать проект'}
          loading={saving}
          onPress={submit}
        />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: theme.spacing.lg,
  },
  textarea: {
    minHeight: 112,
    paddingTop: theme.spacing.md,
    textAlignVertical: 'top',
  },
});
