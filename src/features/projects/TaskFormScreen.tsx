import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  createProjectTask,
  getProjectTask,
  listProjects,
  updateProjectTask,
} from '../../api/projects';
import { extractItems, toApiError } from '../../api/client';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { ApiListItem, EntityId } from '../../types';
import { getEntityId, getEntityString, getEntityTitle } from '../../utils/entity';
import { taskFormStatusOptions, taskPriorityOptions } from './projectHelpers';

function normalizeId(value: string): EntityId {
  const parsed = Number(value);
  return Number.isFinite(parsed) && String(parsed) === value ? parsed : value;
}

export function TaskFormScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const params = useLocalSearchParams<{ id?: string; project?: string }>();
  const editId = params.id;
  const initialProject = params.project || '';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(initialProject);
  const [deadline, setDeadline] = useState('');
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('medium');
  const [saving, setSaving] = useState(false);
  const [loadedEditId, setLoadedEditId] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    const [projectsPayload, task] = await Promise.all([
      listProjects({ limit: 50 }).catch(() => []),
      editId ? getProjectTask(editId) : Promise.resolve(null),
    ]);

    return {
      projects: extractItems<ApiListItem>(projectsPayload),
      task,
    };
  }, [editId]);

  const { data, loading, error, reload } = useAsyncResource(loadInitial);

  useEffect(() => {
    if (!data?.task || loadedEditId === editId) return;

    const task = data.task;
    setTitle(getEntityString(task, ['title', 'name']));
    setDescription(getEntityString(task, ['description']));
    setProjectId(getEntityString(task, ['project']));
    setDeadline(getEntityString(task, ['deadline']));
    setStatus(getEntityString(task, ['status'], 'todo'));
    setPriority(getEntityString(task, ['priority'], 'medium'));
    setLoadedEditId(editId || null);
  }, [data?.task, editId, loadedEditId]);

  const selectedProjectTitle = useMemo(() => {
    const selected = data?.projects.find((project) => String(getEntityId(project)) === String(projectId));
    return selected ? getEntityTitle(selected, 'Проект') : '';
  }, [data?.projects, projectId]);

  const submit = async () => {
    const cleanTitle = title.trim();
    const cleanProjectId = projectId.trim();

    if (!cleanTitle) {
      Alert.alert('Задача', 'Введите название задачи.');
      return;
    }

    if (!cleanProjectId) {
      Alert.alert('Задача', 'Выберите проект. Backend требует поле project.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        title: cleanTitle,
        description: description.trim(),
        project: normalizeId(cleanProjectId),
        deadline: deadline.trim() || null,
        status,
        priority,
      };

      const saved = editId
        ? await updateProjectTask(editId, payload)
        : await createProjectTask(payload);

      router.replace(`/(app)/tasks-v2/${getEntityId(saved) || editId}` as any);
    } catch (requestError) {
      Alert.alert('Задача', toApiError(requestError).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <ScreenContainer>
        <Header title={editId ? 'Редактировать задачу' : 'Новая задача'} showBack />
        <LoadingState title="Готовим форму" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Header
        title={editId ? 'Редактировать задачу' : 'Новая задача'}
        subtitle="Задача создаётся в существующем проекте."
        showBack
        parentFallback="/(app)/(tabs)/tasks"
      />

      {error ? <ErrorState message={error} actionTitle="Повторить" onAction={reload} /> : null}

      <Card glass style={styles.form}>
        <Input
          label="Название"
          placeholder="Например: Подготовить договор"
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label="Описание"
          placeholder="Контекст, результат, ссылки"
          value={description}
          onChangeText={setDescription}
          multiline
          style={styles.textarea}
        />

        <SectionTitle title="Проект" subtitle={selectedProjectTitle || 'Выберите проект для задачи'} />
        {data?.projects.length ? (
          <View style={styles.projectChips}>
            {data.projects.map((project) => {
              const id = String(getEntityId(project));
              const active = id === String(projectId);

              return (
                <Pressable
                  key={id}
                  onPress={() => setProjectId(id)}
                  style={({ pressed }) => [
                    styles.projectChip,
                    {
                      borderColor: active ? appTheme.colors.primary : appTheme.colors.border,
                      backgroundColor: active ? appTheme.colors.primary : appTheme.colors.surfaceSoft,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.projectChipText,
                      { color: active ? appTheme.colors.white : appTheme.colors.textMuted },
                    ]}
                  >
                    {getEntityTitle(project, 'Проект')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState
            title="Проектов не найдено"
            message="Создайте проект, затем вернитесь к созданию задачи."
          />
        )}

        <Input
          label="ID проекта"
          placeholder="Можно ввести вручную, если проекта нет в первых 50"
          value={projectId}
          onChangeText={setProjectId}
          keyboardType="number-pad"
        />

        <Input
          label="Срок"
          placeholder="YYYY-MM-DD"
          value={deadline}
          onChangeText={setDeadline}
        />

        <SectionTitle title="Статус" />
        <SegmentedControl options={taskFormStatusOptions} value={status} onChange={setStatus} />

        <SectionTitle title="Приоритет" />
        <SegmentedControl options={taskPriorityOptions} value={priority} onChange={setPriority} />

        <Button
          title={editId ? 'Сохранить задачу' : 'Создать задачу'}
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
  projectChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  projectChip: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  projectChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  projectChipText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  projectChipTextActive: {
    color: theme.colors.white,
  },
  pressed: {
    opacity: 0.72,
  },
});
