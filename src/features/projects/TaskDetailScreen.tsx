import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  addProjectTaskComment,
  completeProjectTask,
  getProjectTask,
  listProjectTaskComments,
  reopenProjectTask,
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
import { SectionTitle } from '../../components/ui/SectionTitle';
import { StatusPill } from '../../components/ui/StatusPill';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { theme } from '../../theme/theme';
import { ApiListItem } from '../../types';
import {
  formatEntityDate,
  getEntityId,
  getEntityNumber,
  getEntityString,
  getEntityTitle,
  stripHtml,
} from '../../utils/entity';
import {
  displayStatus,
  getTaskPriority,
  getTaskStatus,
  priorityTone,
  taskStatusTone,
} from './projectHelpers';

type TaskDetailData = {
  task: ApiListItem;
  comments: ApiListItem[];
};

export function TaskDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const [comment, setComment] = useState('');
  const [savingAction, setSavingAction] = useState<string | null>(null);

  const loadTask = useCallback(async (): Promise<TaskDetailData> => {
    const [task, comments] = await Promise.all([
      getProjectTask(id),
      listProjectTaskComments({ task: id, limit: 20 }).catch(() => []),
    ]);

    return {
      task,
      comments: extractItems<ApiListItem>(comments),
    };
  }, [id]);

  const { data, loading, error, reload } = useAsyncResource(loadTask);

  const runTaskAction = async (action: 'complete' | 'reopen') => {
    setSavingAction(action);

    try {
      if (action === 'complete') {
        await completeProjectTask(id);
      } else {
        await reopenProjectTask(id);
      }

      await reload();
    } catch (requestError) {
      Alert.alert('Задача', toApiError(requestError).message);
    } finally {
      setSavingAction(null);
    }
  };

  const submitComment = async () => {
    const text = comment.trim();

    if (!text) {
      Alert.alert('Комментарий', 'Введите текст комментария.');
      return;
    }

    setSavingAction('comment');

    try {
      await addProjectTaskComment(id, text);
      setComment('');
      await reload();
    } catch (requestError) {
      Alert.alert('Комментарий', toApiError(requestError).message);
    } finally {
      setSavingAction(null);
    }
  };

  if (loading && !data) {
    return (
      <ScreenContainer>
        <Header title="Задача" showBack />
        <LoadingState title="Открываем задачу" />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer>
        <Header title="Задача" showBack />
        <ErrorState message={error} actionTitle="Повторить" onAction={reload} />
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <Header title="Задача" showBack />
        <EmptyState title="Задача не найдена" />
      </ScreenContainer>
    );
  }

  const task = data.task;
  const status = getTaskStatus(task);
  const priority = getTaskPriority(task);
  const projectId = getEntityString(task, ['project']);
  const projectTitle = getEntityString(task, ['project_title'], 'Проект не указан');
  const description = stripHtml(getEntityString(task, ['description']));
  const assignedTo = getEntityString(task, ['assigned_to_data', 'assigned_to_name', 'assigned_to']);
  const isDone = status === 'done';

  return (
    <ScreenContainer>
      <Header
        title="Задача"
        subtitle={projectTitle}
        showBack
        parentFallback="/(app)/(tabs)/tasks"
      />

      <Card glass style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{getEntityTitle(task, 'Задача')}</Text>
            <Text style={styles.heroSubtitle}>{projectTitle}</Text>
          </View>
          <Pressable
            onPress={() => router.push(`/(app)/tasks-v2/${id}/edit` as any)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
          </Pressable>
        </View>

        <View style={styles.pills}>
          <StatusPill
            label={displayStatus(status, getEntityString(task, ['status_display']))}
            tone={taskStatusTone(status)}
          />
          <StatusPill
            label={displayStatus(priority, getEntityString(task, ['priority_display']))}
            tone={priorityTone(priority)}
          />
        </View>

        <View style={styles.actions}>
          {isDone ? (
            <Button
              title="Открыть снова"
              variant="secondary"
              loading={savingAction === 'reopen'}
              onPress={() => runTaskAction('reopen')}
            />
          ) : (
            <Button
              title="Завершить"
              loading={savingAction === 'complete'}
              onPress={() => runTaskAction('complete')}
            />
          )}
          {projectId ? (
            <Button
              title="Проект"
              variant="secondary"
              onPress={() => router.push(`/(app)/projects-v2/${projectId}` as any)}
            />
          ) : null}
        </View>
      </Card>

      <View style={styles.metaGrid}>
        <Meta label="Срок" value={formatEntityDate(task.deadline) || 'Без срока'} />
        <Meta label="Ответственный" value={assignedTo || 'Не назначен'} />
        <Meta label="Комментарии" value={String(getEntityNumber(task, ['comments_count'], data.comments.length))} />
        <Meta label="Файлы" value={String(getEntityNumber(task, ['attachments_count'], 0))} />
      </View>

      <SectionTitle title="Описание" />
      <Card style={styles.block}>
        <Text style={styles.bodyText}>{description || 'Описание пока не заполнено.'}</Text>
      </Card>

      <SectionTitle title="Комментарий" />
      <Card style={styles.block}>
        <Input
          label="Новый комментарий"
          placeholder="Напишите короткое обновление"
          value={comment}
          onChangeText={setComment}
          multiline
          style={styles.commentInput}
        />
        <Button
          title="Добавить комментарий"
          loading={savingAction === 'comment'}
          onPress={submitComment}
        />
      </Card>

      <SectionTitle title="Последние комментарии" />
      {data.comments.length ? (
        <View style={styles.comments}>
          {data.comments.map((item) => (
            <Card key={String(getEntityId(item))} style={styles.comment}>
              <Text style={styles.commentAuthor}>
                {getEntityString(item, ['author_data', 'author_name'], 'Комментарий')}
              </Text>
              <Text style={styles.bodyText}>
                {getEntityString(item, ['text', 'comment', 'body'], 'Без текста')}
              </Text>
              <Text style={styles.commentDate}>{formatEntityDate(item.created_at)}</Text>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState title="Комментариев пока нет" />
      )}
    </ScreenContainer>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: theme.spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  heroText: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  heroSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  meta: {
    flex: 1,
    minWidth: 145,
    gap: 5,
    paddingVertical: theme.spacing.md,
  },
  metaLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metaValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 19,
  },
  block: {
    gap: theme.spacing.md,
  },
  bodyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  commentInput: {
    minHeight: 104,
    textAlignVertical: 'top',
    paddingTop: theme.spacing.md,
  },
  comments: {
    gap: theme.spacing.md,
  },
  comment: {
    gap: theme.spacing.sm,
  },
  commentAuthor: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  commentDate: {
    color: theme.colors.textSoft,
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
});
