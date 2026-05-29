import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getProject, listProjectTasks } from '../../api/projects';
import { extractItems } from '../../api/client';
import { Card } from '../../components/cards/Card';
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
  getEntityArray,
  getEntityId,
  getEntityNumber,
  getEntityString,
  getEntityTitle,
  stripHtml,
} from '../../utils/entity';
import {
  displayStatus,
  getProjectStatus,
  getTaskStatus,
  projectStatusTone,
  taskStatusTone,
} from './projectHelpers';

type ProjectDetailData = {
  project: ApiListItem;
  tasks: ApiListItem[];
};

export function ProjectDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const loadProject = useCallback(async (): Promise<ProjectDetailData> => {
    const [project, tasks] = await Promise.all([
      getProject(id),
      listProjectTasks({ project: id, limit: 20 }).catch(() => []),
    ]);

    return {
      project,
      tasks: extractItems<ApiListItem>(tasks),
    };
  }, [id]);

  const { data, loading, error, reload } = useAsyncResource(loadProject);

  if (loading && !data) {
    return (
      <ScreenContainer>
        <Header title="Проект" showBack />
        <LoadingState title="Открываем проект" />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer>
        <Header title="Проект" showBack />
        <ErrorState message={error} actionTitle="Повторить" onAction={reload} />
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <Header title="Проект" showBack />
        <EmptyState title="Проект не найден" />
      </ScreenContainer>
    );
  }

  const project = data.project;
  const status = getProjectStatus(project);
  const progress = getEntityNumber(project, ['progress_percent'], 0);
  const sections = getEntityArray<ApiListItem>(project, 'sections');
  const notes = getEntityArray<ApiListItem>(project, 'notes');
  const description = stripHtml(getEntityString(project, ['description']));

  return (
    <ScreenContainer>
      <Header
        title="Проект"
        subtitle={getEntityString(project, ['code'], 'Projects v2')}
        showBack
        parentFallback="/(app)/(tabs)/tasks"
      />

      <Card glass style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{getEntityTitle(project, 'Проект')}</Text>
            <Text style={styles.heroSubtitle}>
              {getEntityString(project, ['company_name', 'office_name'], 'ManagerSL')}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push(`/(app)/projects-v2/${id}/edit` as any)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
          </Pressable>
        </View>

        <View style={styles.pills}>
          <StatusPill
            label={displayStatus(status, getEntityString(project, ['status_display']))}
            tone={projectStatusTone(status)}
          />
          <StatusPill label={`${progress}% прогресс`} tone="accent" />
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
        </View>

        <View style={styles.actions}>
          <Button
            title="Новая задача"
            onPress={() => router.push(`/(app)/tasks-v2/create?project=${id}` as any)}
          />
          <Button
            title="Обновить"
            variant="secondary"
            onPress={reload}
          />
        </View>
      </Card>

      <View style={styles.metaGrid}>
        <Meta label="Срок" value={formatEntityDate(project.deadline) || 'Без срока'} />
        <Meta
          label="Задачи"
          value={`${getEntityNumber(project, ['completed_tasks_count'], 0)}/${getEntityNumber(project, ['tasks_count'], data.tasks.length)}`}
        />
        <Meta
          label="Владелец"
          value={getEntityString(project, ['owner_data', 'owner_name', 'owner'], 'Не указан')}
        />
        <Meta label="Обновлено" value={formatEntityDate(project.updated_at) || '-'} />
      </View>

      <SectionTitle title="Описание" />
      <Card style={styles.block}>
        <Text style={styles.bodyText}>{description || 'Описание пока не заполнено.'}</Text>
      </Card>

      <SectionTitle title="Задачи проекта" />
      {data.tasks.length ? (
        <View style={styles.stack}>
          {data.tasks.map((task) => {
            const taskStatus = getTaskStatus(task);

            return (
              <Pressable
                key={String(getEntityId(task))}
                onPress={() => router.push(`/(app)/tasks-v2/${getEntityId(task)}` as any)}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Card style={styles.taskCard}>
                  <View style={styles.taskTop}>
                    <Text style={styles.taskTitle}>{getEntityTitle(task, 'Задача')}</Text>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                  </View>
                  <StatusPill
                    label={displayStatus(taskStatus, getEntityString(task, ['status_display']))}
                    tone={taskStatusTone(taskStatus)}
                  />
                </Card>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <EmptyState title="Задач в проекте пока нет" />
      )}

      {sections.length ? (
        <>
          <SectionTitle title="Разделы" />
          <View style={styles.stack}>
            {sections.map((section) => (
              <Card key={String(getEntityId(section))} style={styles.block}>
                <Text style={styles.sectionTitle}>{getEntityTitle(section, 'Раздел')}</Text>
                <Text style={styles.bodyText}>
                  {stripHtml(getEntityString(section, ['description'])) || 'Без описания'}
                </Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}

      {notes.length ? (
        <>
          <SectionTitle title="Заметки" />
          <View style={styles.stack}>
            {notes.slice(0, 3).map((note) => (
              <Card key={String(getEntityId(note))} style={styles.block}>
                <Text style={styles.sectionTitle}>{getEntityTitle(note, 'Заметка')}</Text>
                <Text style={styles.bodyText}>
                  {stripHtml(getEntityString(note, ['text', 'content', 'description'])) || 'Без текста'}
                </Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}
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
  progressTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
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
  },
  block: {
    gap: theme.spacing.sm,
  },
  bodyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  stack: {
    gap: theme.spacing.md,
  },
  taskCard: {
    gap: theme.spacing.md,
  },
  taskTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  taskTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
