import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { memo, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { listProjects, listProjectTasks } from '../../api/projects';
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
import { StatusPill } from '../../components/ui/StatusPill';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePagedResource } from '../../hooks/usePagedResource';
import { theme } from '../../theme/theme';
import { ApiListItem } from '../../types';
import {
  formatEntityDate,
  getEntityId,
  getEntityNumber,
  getEntityString,
  getEntityTitle,
} from '../../utils/entity';
import {
  displayStatus,
  getProjectStatus,
  getTaskPriority,
  getTaskStatus,
  priorityTone,
  projectStatusOptions,
  projectStatusTone,
  taskPriorityOptions,
  taskStatusOptions,
  taskStatusTone,
} from './projectHelpers';

const workspaceOptions = [
  { label: 'Задачи', value: 'tasks' },
  { label: 'Проекты', value: 'projects' },
];

export function TasksScreen() {
  const [workspace, setWorkspace] = useState('tasks');

  return (
    <ScreenContainer scroll={false} style={styles.screen}>
      {workspace === 'tasks' ? (
        <TaskList workspace={workspace} onWorkspaceChange={setWorkspace} />
      ) : (
        <ProjectList workspace={workspace} onWorkspaceChange={setWorkspace} />
      )}
    </ScreenContainer>
  );
}

type WorkspaceHeaderProps = {
  workspace: string;
  onWorkspaceChange: (value: string) => void;
};

function TaskList({ workspace, onWorkspaceChange }: WorkspaceHeaderProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const loader = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) =>
      listProjectTasks({
        limit,
        offset,
        search: debouncedSearch || undefined,
        status: status === 'all' ? undefined : status,
        priority: priority === 'all' ? undefined : priority,
      }),
    [debouncedSearch, priority, status]
  );

  const { items, count, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePagedResource<ApiListItem>(loader);

  const renderTask = useCallback(
    ({ item }: { item: ApiListItem }) => (
      <TaskCard item={item} onPress={() => router.push(`/(app)/tasks-v2/${getEntityId(item)}` as any)} />
    ),
    [router]
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item, index) => String(getEntityId(item) || index)}
      renderItem={renderTask}
      onEndReached={loadMore}
      onEndReachedThreshold={0.35}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
          onRefresh={refresh}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerStack}>
          <Header
            title="Задачи"
            eyebrow="Sprint 3 workspace"
            subtitle="Проектные задачи и статусы исполнения."
          />

          <Card glass style={styles.hero}>
            <Text style={styles.heroKicker}>Students Life Program for Managers</Text>
            <Text style={styles.heroTitle}>Командная работа без лишнего шума</Text>
            <Text style={styles.heroText}>
              В работе {count} задач. Фильтры, поиск, pull-to-refresh и бесконечная подгрузка уже подключены к backend.
            </Text>
            <View style={styles.heroActions}>
              <Button title="Новая задача" onPress={() => router.push('/(app)/tasks-v2/create' as any)} />
              <Button
                title="Проекты"
                variant="secondary"
                onPress={() => onWorkspaceChange('projects')}
              />
            </View>
          </Card>

          <SegmentedControl
            options={workspaceOptions}
            value={workspace}
            onChange={onWorkspaceChange}
          />

          <Input
            label="Поиск"
            placeholder="Название, проект или описание"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />

          <SectionTitle title="Статус" />
          <SegmentedControl options={taskStatusOptions} value={status} onChange={setStatus} />

          <SectionTitle title="Приоритет" />
          <SegmentedControl
            options={[{ label: 'Все', value: 'all' }, ...taskPriorityOptions]}
            value={priority}
            onChange={setPriority}
          />

          {error ? (
            <ErrorState message={error} actionTitle="Повторить" onAction={refresh} />
          ) : null}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <LoadingState title="Загружаем задачи" />
        ) : (
          <EmptyState
            title="Задач пока нет"
            message="Создайте задачу внутри проекта или измените фильтры."
          />
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.primary} /> : null}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

function ProjectList({ workspace, onWorkspaceChange }: WorkspaceHeaderProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const loader = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) =>
      listProjects({
        limit,
        offset,
        search: debouncedSearch || undefined,
        status: status === 'all' ? undefined : status,
      }),
    [debouncedSearch, status]
  );

  const { items, count, loading, refreshing, loadingMore, error, refresh, loadMore } =
    usePagedResource<ApiListItem>(loader);

  const renderProject = useCallback(
    ({ item }: { item: ApiListItem }) => (
      <ProjectCard
        item={item}
        onPress={() => router.push(`/(app)/projects-v2/${getEntityId(item)}` as any)}
      />
    ),
    [router]
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item, index) => String(getEntityId(item) || index)}
      renderItem={renderProject}
      onEndReached={loadMore}
      onEndReachedThreshold={0.35}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
          onRefresh={refresh}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerStack}>
          <Header
            title="Проекты"
            eyebrow="ManagerSL ERP/CRM workspace"
            subtitle="Проекты, задачи и прогресс команды."
          />

          <Card glass style={styles.hero}>
            <Text style={styles.heroKicker}>Projects v2</Text>
            <Text style={styles.heroTitle}>Проекты как рабочие контуры</Text>
            <Text style={styles.heroText}>
              Найдено {count} проектов. Внутри карточки проекта можно открыть задачи и быстро добавить новую.
            </Text>
            <View style={styles.heroActions}>
              <Button title="Новый проект" onPress={() => router.push('/(app)/projects-v2/create' as any)} />
              <Button
                title="Задачи"
                variant="secondary"
                onPress={() => onWorkspaceChange('tasks')}
              />
            </View>
          </Card>

          <SegmentedControl
            options={workspaceOptions}
            value={workspace}
            onChange={onWorkspaceChange}
          />

          <Input
            label="Поиск"
            placeholder="Название, код или описание"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />

          <SectionTitle title="Статус проекта" />
          <SegmentedControl options={projectStatusOptions} value={status} onChange={setStatus} />

          {error ? (
            <ErrorState message={error} actionTitle="Повторить" onAction={refresh} />
          ) : null}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <LoadingState title="Загружаем проекты" />
        ) : (
          <EmptyState
            title="Проектов пока нет"
            message="Создайте первый проект, чтобы добавлять задачи."
          />
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.primary} /> : null}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const TaskCard = memo(function TaskCard({
  item,
  onPress,
}: {
  item: ApiListItem;
  onPress: () => void;
}) {
  const status = getTaskStatus(item);
  const priority = getTaskPriority(item);
  const assignedTo = getEntityString(item, ['assigned_to_data', 'assigned_to_name', 'assigned_to']);
  const projectTitle = getEntityString(item, ['project_title']);
  const deadline = formatEntityDate(item.deadline);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={styles.itemCard}>
        <View style={styles.cardTop}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>{getEntityTitle(item, 'Задача')}</Text>
            {projectTitle ? <Text style={styles.cardSubtitle}>{projectTitle}</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </View>

        <View style={styles.pills}>
          <StatusPill
            label={displayStatus(status, getEntityString(item, ['status_display']))}
            tone={taskStatusTone(status)}
          />
          <StatusPill
            label={displayStatus(priority, getEntityString(item, ['priority_display']))}
            tone={priorityTone(priority)}
          />
        </View>

        <View style={styles.metaGrid}>
          <Meta label="Срок" value={deadline || 'Без срока'} />
          <Meta label="Ответственный" value={assignedTo || 'Не назначен'} />
          <Meta label="Комментарии" value={String(getEntityNumber(item, ['comments_count'], 0))} />
          <Meta label="Файлы" value={String(getEntityNumber(item, ['attachments_count'], 0))} />
        </View>
      </Card>
    </Pressable>
  );
});

const ProjectCard = memo(function ProjectCard({
  item,
  onPress,
}: {
  item: ApiListItem;
  onPress: () => void;
}) {
  const status = getProjectStatus(item);
  const progress = getEntityNumber(item, ['progress_percent'], 0);
  const tasksCount = getEntityNumber(item, ['tasks_count'], 0);
  const completed = getEntityNumber(item, ['completed_tasks_count'], 0);
  const owner = getEntityString(item, ['owner_data', 'owner_name', 'owner']);
  const deadline = formatEntityDate(item.deadline);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={styles.itemCard}>
        <View style={styles.cardTop}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>{getEntityTitle(item, 'Проект')}</Text>
            <Text style={styles.cardSubtitle}>
              {getEntityString(item, ['code'], 'Без кода')} - {tasksCount} задач
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </View>

        <View style={styles.pills}>
          <StatusPill
            label={displayStatus(status, getEntityString(item, ['status_display']))}
            tone={projectStatusTone(status)}
          />
          <StatusPill label={`${progress}% прогресс`} tone="accent" />
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
        </View>

        <View style={styles.metaGrid}>
          <Meta label="Готово" value={`${completed}/${tasksCount}`} />
          <Meta label="Срок" value={deadline || 'Без срока'} />
          <Meta label="Владелец" value={owner || 'Не указан'} />
          <Meta label="Обновлено" value={formatEntityDate(item.updated_at) || '-'} />
        </View>
      </Card>
    </Pressable>
  );
});

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  listContent: {
    gap: theme.spacing.md,
    paddingBottom: 116,
  },
  headerStack: {
    gap: theme.spacing.lg,
  },
  hero: {
    gap: theme.spacing.md,
  },
  heroKicker: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  heroText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  itemCard: {
    gap: theme.spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
  },
  cardSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  meta: {
    flexGrow: 1,
    minWidth: 126,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    gap: 3,
    padding: theme.spacing.md,
  },
  metaLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metaValue: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
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
  pressed: {
    opacity: 0.72,
  },
});
