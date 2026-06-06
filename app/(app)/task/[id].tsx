import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';

import ScreenWrapper from '../../../components/ScreenWrapper';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import apiClient, { fetchAllPages } from '../../../src/api/apiClient';
import { useTheme } from '../../../src/context/ThemeContext';
import { safeGoBack } from '../../../src/navigation/safeGoBack';

type UserMini = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
};

type TaskStatus = 'todo' | 'process' | 'review' | 'done';
type TaskPriority = 'low' | 'medium' | 'high';

type ProjectTask = {
  id: number;
  project: number;
  parent?: number | null;
  subtasks?: ProjectTask[];
  subtasks_count?: number;
  title: string;
  description?: string;
  assigned_to?: number | null;
  assigned_to_data?: UserMini | null;
  created_by?: number | null;
  created_by_data?: UserMini | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline?: string | null;
  order?: number;
  created_at?: string;
  updated_at?: string;
};

const TASK_STATUSES: {
  value: TaskStatus;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'todo', label: 'План', icon: 'ellipse-outline' },
  { value: 'process', label: 'В работе', icon: 'flash-outline' },
  { value: 'review', label: 'Проверка', icon: 'eye-outline' },
  { value: 'done', label: 'Готово', icon: 'checkmark-done-outline' },
];

const PRIORITIES: {
  value: TaskPriority;
  label: string;
}[] = [
  { value: 'low', label: 'Низкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'high', label: 'Высокий' },
];

function userName(user?: UserMini | null) {
  if (!user) return 'Не назначен';
  return user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email;
}

function initials(user?: UserMini | null) {
  const name = userName(user);
  const parts = name.split(/\s+/).filter(Boolean);

  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return 'Без дедлайна';

  try {
    return new Date(value).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';

  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function taskStatusLabel(status?: string) {
  if (status === 'todo') return 'План';
  if (status === 'process') return 'В работе';
  if (status === 'review') return 'Проверка';
  if (status === 'done') return 'Готово';
  return status || '—';
}

function priorityLabel(priority?: string) {
  if (priority === 'low') return 'Низкий';
  if (priority === 'medium') return 'Средний';
  if (priority === 'high') return 'Высокий';
  return priority || '—';
}

function statusColor(status: string | undefined, theme: any) {
  if (status === 'done') return theme.success || '#1AAE6F';
  if (status === 'review') return theme.warning || '#F59E0B';
  if (status === 'process') return theme.blue;
  return theme.textMuted;
}

function priorityColor(priority: string | undefined, theme: any) {
  if (priority === 'high') return theme.red;
  if (priority === 'medium') return theme.warning || '#F59E0B';
  return theme.success || '#1AAE6F';
}

function deadlineMeta(value?: string | null) {
  if (!value) return { label: 'Без дедлайна', tone: 'muted' as const };

  const now = new Date();
  const date = new Date(value);
  const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (Number.isNaN(diff)) return { label: formatDate(value), tone: 'muted' as const };
  if (diff < 0) return { label: `Просрочено ${Math.abs(diff)} дн.`, tone: 'danger' as const };
  if (diff === 0) return { label: 'Сегодня', tone: 'warning' as const };
  if (diff <= 3) return { label: `Через ${diff} дн.`, tone: 'warning' as const };

  return { label: formatDate(value), tone: 'ok' as const };
}

function normalizeDeadline(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T23:59:00`;
  }

  return trimmed;
}

function cleanText(value?: string) {
  return String(value || '').replace(/[#*_`>-]/g, '').trim();
}

function taskStats(task?: ProjectTask | null) {
  const subtasks = task?.subtasks || [];
  const total = subtasks.length;
  const done = subtasks.filter((item) => item.status === 'done').length;
  const percent = total > 0 ? Math.round((done / total) * 100) : task?.status === 'done' ? 100 : 0;

  return { total, done, percent };
}

function flattenTaskError(error: any) {
  const data = error?.response?.data;

  return (
    data?.detail ||
    data?.title?.[0] ||
    data?.parent?.[0] ||
    data?.project?.[0] ||
    data?.assigned_to?.[0] ||
    data?.deadline?.[0] ||
    'Не удалось сохранить задачу.'
  );
}

function markdownStyles(theme: any) {
  return {
    body: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      fontWeight: '600',
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 8,
    },
    strong: {
      color: theme.text,
      fontWeight: '900',
    },
    heading1: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '900',
      marginBottom: 8,
    },
    heading2: {
      color: theme.text,
      fontSize: 19,
      fontWeight: '900',
      marginBottom: 6,
    },
    heading3: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '900',
      marginBottom: 6,
    },
    link: {
      color: theme.blue,
      fontWeight: '900',
    },
  };
}

function AssigneeBadge({ user, theme }: { user?: UserMini | null; theme: any }) {
  return (
    <View style={[styles.assigneeBadge, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
      <View style={[styles.assigneeAvatar, { backgroundColor: user ? theme.blue : theme.border }]}>
        <Text style={styles.assigneeAvatarText}>{initials(user)}</Text>
      </View>
      <Text style={[styles.assigneeName, { color: theme.text }]} numberOfLines={1}>
        {userName(user)}
      </Text>
    </View>
  );
}

export default function TaskDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; projectId?: string }>();
  const { theme, themeMode } = useTheme();
  const { user } = useCurrentUser();

  const taskId = Number(params.id);
  const fallbackProjectId = params.projectId ? String(params.projectId) : '';
  const backFallback = fallbackProjectId ? `/(app)/project/${fallbackProjectId}` : '/(app)/projects';

  const dark = themeMode === 'dark';
  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [task, setTask] = useState<ProjectTask | null>(null);
  const [users, setUsers] = useState<UserMini[]>([]);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [subtaskModalOpen, setSubtaskModalOpen] = useState(false);

  const [savingEdit, setSavingEdit] = useState(false);
  const [savingSubtask, setSavingSubtask] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<TaskStatus>('todo');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  const [editDeadline, setEditDeadline] = useState('');

  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskDescription, setSubtaskDescription] = useState('');
  const [subtaskAssignedTo, setSubtaskAssignedTo] = useState<number | null>(null);
  const [subtaskStatus, setSubtaskStatus] = useState<TaskStatus>('todo');
  const [subtaskPriority, setSubtaskPriority] = useState<TaskPriority>('medium');
  const [subtaskDeadline, setSubtaskDeadline] = useState('');

  const stats = useMemo(() => taskStats(task), [task]);
  const canManage = Boolean(task && user && (isAdmin || Number(task.created_by) === Number(user.id)));

  const load = useCallback(async () => {
    if (!taskId) return;

    try {
      const [taskRes, usersRes] = await Promise.allSettled([
        apiClient.get(`tasks/project-tasks/${taskId}/`),
        fetchAllPages('users/users/?limit=100&offset=0'),
      ]);

      if (taskRes.status === 'fulfilled') {
        setTask(taskRes.value.data);
      }

      if (usersRes.status === 'fulfilled') {
        setUsers(usersRes.value as UserMini[]);
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить задачу.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEditModal = () => {
    if (!task) return;

    setEditTitle(task.title || '');
    setEditDescription(task.description || '');
    setEditAssignedTo(task.assigned_to ?? null);
    setEditStatus(task.status || 'todo');
    setEditPriority(task.priority || 'medium');
    setEditDeadline(task.deadline || '');
    setEditModalOpen(true);
  };

  const resetSubtask = () => {
    setSubtaskTitle('');
    setSubtaskDescription('');
    setSubtaskAssignedTo(null);
    setSubtaskStatus('todo');
    setSubtaskPriority('medium');
    setSubtaskDeadline('');
  };

  const saveEdit = async () => {
    if (!task) return;

    if (!editTitle.trim()) {
      Alert.alert('Ошибка', 'Название задачи не может быть пустым.');
      return;
    }

    setSavingEdit(true);

    try {
      await apiClient.patch(`tasks/project-tasks/${task.id}/`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        assigned_to: editAssignedTo,
        status: editStatus,
        priority: editPriority,
        deadline: normalizeDeadline(editDeadline),
      });

      setEditModalOpen(false);
      await load();
      Alert.alert('Готово', 'Задача обновлена.');
    } catch (error: any) {
      Alert.alert('Ошибка', String(flattenTaskError(error)));
    } finally {
      setSavingEdit(false);
    }
  };

  const createSubtask = async () => {
    if (!task) return;

    if (!subtaskTitle.trim()) {
      Alert.alert('Ошибка', 'Напиши название подзадачи.');
      return;
    }

    setSavingSubtask(true);

    try {
      await apiClient.post('tasks/project-tasks/', {
        project: task.project,
        parent: task.id,
        title: subtaskTitle.trim(),
        description: subtaskDescription.trim(),
        assigned_to: subtaskAssignedTo,
        status: subtaskStatus,
        priority: subtaskPriority,
        deadline: normalizeDeadline(subtaskDeadline),
      });

      setSubtaskModalOpen(false);
      resetSubtask();
      await load();
    } catch (error: any) {
      Alert.alert('Ошибка', String(flattenTaskError(error)));
    } finally {
      setSavingSubtask(false);
    }
  };

  const updateTaskStatus = async (item: ProjectTask, statusValue: TaskStatus) => {
    try {
      await apiClient.patch(`tasks/project-tasks/${item.id}/`, { status: statusValue });
      await load();
    } catch {
      Alert.alert('Ошибка', 'Не удалось обновить статус.');
    }
  };

  const openSubtask = (item: ProjectTask) => {
    router.push({
      pathname: '/(app)/task/[id]',
      params: {
        id: String(item.id),
        projectId: String(item.project),
      },
    } as any);
  };

  const deleteTask = async () => {
    if (!task) return;

    setDeleting(true);

    try {
      await apiClient.delete(`tasks/project-tasks/${task.id}/`);
      router.replace(backFallback as any);
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.detail || 'Не удалось удалить задачу.');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Удалить задачу?', 'Задача и вложенные подзадачи будут удалены.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: deleteTask },
    ]);
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.blue} />
        </View>
      </ScreenWrapper>
    );
  }

  if (!task) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Задача не найдена</Text>
          <Text style={[styles.emptySmall, { color: theme.textSecondary }]}>
            Возможно, у тебя нет доступа или задача была удалена.
          </Text>
          <Pressable onPress={() => safeGoBack(router, backFallback)} style={[styles.backWideBtn, { backgroundColor: theme.blue }]}>
            <Text style={styles.backWideText}>Назад</Text>
          </Pressable>
        </View>
      </ScreenWrapper>
    );
  }

  const currentStatusColor = statusColor(task.status, theme);
  const currentPriorityColor = priorityColor(task.priority, theme);
  const d = deadlineMeta(task.deadline);
  const dColor = d.tone === 'danger' ? theme.red : d.tone === 'warning' ? theme.warning || '#F59E0B' : theme.textMuted;

  return (
    <ScreenWrapper>
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={theme.blue}
            />
          }
        >
          <View
            style={[
              styles.header,
              {
                backgroundColor: dark ? '#111827' : '#FFFFFF',
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <View style={styles.headerTop}>
              <Pressable onPress={() => safeGoBack(router, backFallback)} style={[styles.backBtn, { backgroundColor: theme.backgroundSoft }]}>
                <Ionicons name="arrow-back" size={21} color={theme.text} />
              </Pressable>

              <View style={{ flex: 1 }}>
                <Text style={[styles.kicker, { color: theme.textMuted }]}>TASK #{task.id}</Text>
                <Text style={[styles.title, { color: theme.text }]}>{task.title}</Text>
              </View>

              {canManage && (
                <Pressable onPress={openEditModal} style={[styles.editBtn, { backgroundColor: theme.blue }]}>
                  <Ionicons name="create-outline" size={17} color="#fff" />
                  <Text style={styles.editBtnText}>Править</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.headerMetaRow}>
              <View style={[styles.metaPill, { backgroundColor: `${currentStatusColor}18`, borderColor: `${currentStatusColor}55` }]}>
                <Ionicons name="radio-button-on-outline" size={14} color={currentStatusColor} />
                <Text style={[styles.metaPillText, { color: currentStatusColor }]}>{taskStatusLabel(task.status)}</Text>
              </View>

              <View style={[styles.metaPill, { backgroundColor: `${currentPriorityColor}18`, borderColor: `${currentPriorityColor}55` }]}>
                <Ionicons name="flag-outline" size={14} color={currentPriorityColor} />
                <Text style={[styles.metaPillText, { color: currentPriorityColor }]}>{priorityLabel(task.priority)}</Text>
              </View>

              <View style={[styles.metaPill, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Ionicons name="time-outline" size={14} color={dColor} />
                <Text style={[styles.metaPillText, { color: dColor }]}>{d.label}</Text>
              </View>
            </View>

            <View style={[styles.progressPanel, { backgroundColor: theme.backgroundSoft }]}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressTitle, { color: theme.text }]}>Прогресс подзадач</Text>
                <Text style={[styles.progressPercent, { color: theme.blue }]}>{stats.percent}%</Text>
              </View>

              <View style={[styles.progressTrack, { backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }]}>
                <View style={[styles.progressFill, { width: `${stats.percent}%`, backgroundColor: theme.blue }]} />
              </View>

              <View style={styles.progressStats}>
                <Text style={[styles.progressHint, { color: theme.textSecondary }]}>
                  {stats.done}/{stats.total} подзадач выполнено
                </Text>
                <Text style={[styles.progressHint, { color: theme.textSecondary }]}>
                  обновлено {formatDateTime(task.updated_at)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.quickActions}>
            <Pressable onPress={() => setSubtaskModalOpen(true)} style={[styles.quickBtn, { backgroundColor: theme.blue }]}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.quickBtnText}>Подзадача</Text>
            </Pressable>

            {canManage && (
              <Pressable
                onPress={confirmDelete}
                disabled={deleting}
                style={[
                  styles.quickBtn,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    borderWidth: 1,
                    opacity: deleting ? 0.65 : 1,
                  },
                ]}
              >
                {deleting ? <ActivityIndicator color={theme.red} /> : <Ionicons name="trash-outline" size={18} color={theme.red} />}
                <Text style={[styles.quickBtnText, { color: theme.red }]}>Удалить</Text>
              </Pressable>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: theme.blueSoft }]}>
                <Ionicons name="information-circle-outline" size={18} color={theme.blue} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Детали задачи</Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>Ответственный, статус и сроки</Text>
              </View>
            </View>

            <View style={styles.infoGrid}>
              <View style={[styles.infoCell, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Создатель</Text>
                <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>
                  {userName(task.created_by_data)}
                </Text>
              </View>

              <View style={[styles.infoCell, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Дедлайн</Text>
                <Text style={[styles.infoValue, { color: dColor }]} numberOfLines={1}>
                  {formatDate(task.deadline)}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={[styles.smallLabel, { color: theme.textMuted }]}>Ответственный</Text>
              <AssigneeBadge user={task.assigned_to_data} theme={theme} />
            </View>

            <Text style={[styles.smallLabel, { color: theme.textMuted, marginTop: 14 }]}>Быстро сменить статус</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
              {TASK_STATUSES.map((item) => {
                const active = task.status === item.value;
                const color = statusColor(item.value, theme);

                return (
                  <Pressable
                    key={item.value}
                    onPress={() => updateTaskStatus(task, item.value)}
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: active ? color : theme.backgroundSoft,
                        borderColor: active ? color : theme.border,
                      },
                    ]}
                  >
                    <Ionicons name={item.icon} size={14} color={active ? '#fff' : color} />
                    <Text style={[styles.statusText, { color: active ? '#fff' : theme.text }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: theme.blueSoft }]}>
                <Ionicons name="document-text-outline" size={18} color={theme.blue} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Описание</Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>Контекст и условия выполнения</Text>
              </View>
            </View>

            {task.description ? (
              <Markdown style={markdownStyles(theme) as any}>{task.description}</Markdown>
            ) : (
              <Text style={[styles.emptySmall, { color: theme.textSecondary }]}>Описание не добавлено.</Text>
            )}
          </View>

          <View style={styles.sectionTitleLine}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bigTitle, { color: theme.text }]}>Подзадачи</Text>
              <Text style={[styles.bigSub, { color: theme.textSecondary }]}>
                Задача работает как папка: внутри можно вести отдельный список работ.
              </Text>
            </View>

            <Pressable onPress={() => setSubtaskModalOpen(true)} style={[styles.smallAddBtn, { backgroundColor: theme.blueSoft }]}>
              <Ionicons name="add" size={18} color={theme.blue} />
            </Pressable>
          </View>

          {(task.subtasks || []).length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="folder-open-outline" size={38} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Подзадач пока нет</Text>
              <Text style={[styles.emptySmall, { color: theme.textSecondary }]}>Создай первую подзадачу, чтобы разложить работу по шагам.</Text>
            </View>
          ) : (
            <View style={styles.subtasksList}>
              {(task.subtasks || []).map((item) => {
                const sColor = statusColor(item.status, theme);
                const pColor = priorityColor(item.priority, theme);

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => openSubtask(item)}
                    style={[
                      styles.subtaskCard,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        shadowColor: theme.shadow,
                      },
                    ]}
                  >
                    <View style={styles.subtaskTop}>
                      <View
                        style={[
                          styles.subtaskCheck,
                          {
                            borderColor: sColor,
                            backgroundColor: item.status === 'done' ? sColor : 'transparent',
                          },
                        ]}
                      >
                        {item.status === 'done' && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={[styles.subtaskTitle, { color: theme.text }]} numberOfLines={2}>
                          {item.title}
                        </Text>

                        {!!cleanText(item.description) && (
                          <Text style={[styles.subtaskDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                            {cleanText(item.description)}
                          </Text>
                        )}

                        <View style={styles.subtaskMetaRow}>
                          <View style={[styles.smallPill, { backgroundColor: `${sColor}18` }]}>
                            <Text style={[styles.smallPillText, { color: sColor }]}>{taskStatusLabel(item.status)}</Text>
                          </View>

                          <View style={[styles.smallPill, { backgroundColor: `${pColor}18` }]}>
                            <Text style={[styles.smallPillText, { color: pColor }]}>{priorityLabel(item.priority)}</Text>
                          </View>

                          <View style={[styles.smallPill, { backgroundColor: theme.backgroundSoft }]}>
                            <Text style={[styles.smallPillText, { color: theme.textSecondary }]}>
                              {item.subtasks_count || item.subtasks?.length || 0} влож.
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.subtaskRight}>
                        <Text style={[styles.subtaskAssignee, { color: theme.textSecondary }]} numberOfLines={1}>
                          {userName(item.assigned_to_data)}
                        </Text>
                        <Text style={[styles.subtaskDate, { color: theme.textMuted }]}>{formatDate(item.deadline)}</Text>
                      </View>

                      <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        <TaskFormModal
          visible={editModalOpen}
          mode="edit"
          theme={theme}
          users={users}
          title={editTitle}
          setTitle={setEditTitle}
          description={editDescription}
          setDescription={setEditDescription}
          assignedTo={editAssignedTo}
          setAssignedTo={setEditAssignedTo}
          statusValue={editStatus}
          setStatusValue={setEditStatus}
          priority={editPriority}
          setPriority={setEditPriority}
          deadline={editDeadline}
          setDeadline={setEditDeadline}
          saving={savingEdit}
          onClose={() => setEditModalOpen(false)}
          onSubmit={saveEdit}
        />

        <TaskFormModal
          visible={subtaskModalOpen}
          mode="subtask"
          theme={theme}
          users={users}
          title={subtaskTitle}
          setTitle={setSubtaskTitle}
          description={subtaskDescription}
          setDescription={setSubtaskDescription}
          assignedTo={subtaskAssignedTo}
          setAssignedTo={setSubtaskAssignedTo}
          statusValue={subtaskStatus}
          setStatusValue={setSubtaskStatus}
          priority={subtaskPriority}
          setPriority={setSubtaskPriority}
          deadline={subtaskDeadline}
          setDeadline={setSubtaskDeadline}
          saving={savingSubtask}
          onClose={() => setSubtaskModalOpen(false)}
          onSubmit={createSubtask}
        />
      </View>
    </ScreenWrapper>
  );
}

function TaskFormModal({
  visible,
  mode,
  theme,
  users,
  title,
  setTitle,
  description,
  setDescription,
  assignedTo,
  setAssignedTo,
  statusValue,
  setStatusValue,
  priority,
  setPriority,
  deadline,
  setDeadline,
  saving,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  mode: 'edit' | 'subtask';
  theme: any;
  users: UserMini[];
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  assignedTo: number | null;
  setAssignedTo: (value: number | null) => void;
  statusValue: TaskStatus;
  setStatusValue: (value: TaskStatus) => void;
  priority: TaskPriority;
  setPriority: (value: TaskPriority) => void;
  deadline: string;
  setDeadline: (value: string) => void;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.modalRoot, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalHeader, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.modalIcon, { backgroundColor: theme.blueSoft }]}>
            <Ionicons name={mode === 'edit' ? 'create-outline' : 'git-branch-outline'} size={22} color={theme.blue} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {mode === 'edit' ? 'Редактировать задачу' : 'Новая подзадача'}
            </Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
              {mode === 'edit' ? 'Измени статус, исполнителя и описание' : 'Будет создана внутри текущей задачи'}
            </Text>
          </View>

          <Pressable onPress={onClose} style={[styles.modalClose, { backgroundColor: theme.backgroundSoft }]}>
            <Ionicons name="close" size={20} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
          <View style={[styles.inputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Название</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Название задачи"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text }]}
            />
          </View>

          <View style={[styles.inputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Описание</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={'Описание задачи\n- пункт\n**важное**'}
              placeholderTextColor={theme.textMuted}
              style={[styles.input, styles.textarea, { color: theme.text }]}
              multiline
              textAlignVertical="top"
            />
          </View>

          <Text style={[styles.formSectionTitle, { color: theme.text }]}>Ответственный</Text>
          <View style={styles.optionsWrap}>
            <Pressable
              onPress={() => setAssignedTo(null)}
              style={[
                styles.optionChip,
                {
                  backgroundColor: assignedTo === null ? theme.blue : theme.surface,
                  borderColor: assignedTo === null ? theme.blue : theme.border,
                },
              ]}
            >
              <Text style={[styles.optionText, { color: assignedTo === null ? '#fff' : theme.text }]}>Не назначен</Text>
            </Pressable>

            {users.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setAssignedTo(item.id)}
                style={[
                  styles.optionChip,
                  {
                    backgroundColor: assignedTo === item.id ? theme.blue : theme.surface,
                    borderColor: assignedTo === item.id ? theme.blue : theme.border,
                  },
                ]}
              >
                <Text style={[styles.optionText, { color: assignedTo === item.id ? '#fff' : theme.text }]}>
                  {userName(item)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.formSectionTitle, { color: theme.text }]}>Статус</Text>
          <View style={styles.optionsWrap}>
            {TASK_STATUSES.map((item) => {
              const active = statusValue === item.value;
              const color = statusColor(item.value, theme);

              return (
                <Pressable
                  key={item.value}
                  onPress={() => setStatusValue(item.value)}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: active ? color : theme.surface,
                      borderColor: active ? color : theme.border,
                    },
                  ]}
                >
                  <Ionicons name={item.icon} size={15} color={active ? '#fff' : color} />
                  <Text style={[styles.optionText, { color: active ? '#fff' : theme.text }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.formSectionTitle, { color: theme.text }]}>Приоритет</Text>
          <View style={styles.optionsWrap}>
            {PRIORITIES.map((item) => {
              const active = priority === item.value;
              const color = priorityColor(item.value, theme);

              return (
                <Pressable
                  key={item.value}
                  onPress={() => setPriority(item.value)}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: active ? color : theme.surface,
                      borderColor: active ? color : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.optionText, { color: active ? '#fff' : theme.text }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.inputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Дедлайн</Text>
            <TextInput
              value={deadline}
              onChangeText={setDeadline}
              placeholder="2026-05-20"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text }]}
              autoCapitalize="none"
            />
          </View>

          <Pressable
            onPress={onSubmit}
            disabled={saving}
            style={[styles.saveBtn, { backgroundColor: theme.blue, opacity: saving ? 0.65 : 1 }]}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
            <Text style={styles.saveText}>
              {saving ? 'Сохранение...' : mode === 'edit' ? 'Сохранить изменения' : 'Создать подзадачу'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 132,
    gap: 14,
  },
  header: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 16,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    marginTop: 3,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '900',
    letterSpacing: -0.45,
  },
  editBtn: {
    minHeight: 42,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  editBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  headerMetaRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  progressPanel: {
    marginTop: 14,
    borderRadius: 22,
    padding: 13,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  progressPercent: {
    fontSize: 15,
    fontWeight: '900',
  },
  progressTrack: {
    marginTop: 10,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressStats: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  progressHint: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
  },
  quickBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  card: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 15,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  sectionSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  infoCell: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 5,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '900',
  },
  smallLabel: {
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 8,
  },
  assigneeBadge: {
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 48,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  assigneeAvatar: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assigneeAvatarText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  assigneeName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  statusRow: {
    gap: 8,
    paddingRight: 8,
  },
  statusPill: {
    minHeight: 39,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900',
  },
  sectionTitleLine: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  bigTitle: {
    fontSize: 21,
    fontWeight: '900',
  },
  bigSub: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  smallAddBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 22,
    alignItems: 'center',
    gap: 9,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptySmall: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'center',
  },
  subtasksList: {
    gap: 10,
  },
  subtaskCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 13,
    elevation: 2,
  },
  subtaskTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  subtaskCheck: {
    marginTop: 3,
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtaskTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    lineHeight: 19,
  },
  subtaskDescription: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  subtaskMetaRow: {
    marginTop: 9,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subtaskRight: {
    width: 78,
    alignItems: 'flex-end',
    gap: 4,
  },
  subtaskAssignee: {
    maxWidth: 78,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },
  subtaskDate: {
    fontSize: 10.5,
    fontWeight: '800',
    textAlign: 'right',
  },
  smallPill: {
    minHeight: 26,
    borderRadius: 999,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  smallPillText: {
    fontSize: 10.5,
    fontWeight: '900',
  },
  backWideBtn: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 18,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backWideText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  modalRoot: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 56 : 22,
  },
  modalHeader: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 28,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  modalSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  modalClose: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 13,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 21,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },
  input: {
    minHeight: 28,
    fontSize: 14.5,
    fontWeight: '700',
  },
  textarea: {
    minHeight: 116,
    lineHeight: 20,
  },
  formSectionTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '900',
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    minHeight: 39,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '900',
  },
  saveBtn: {
    minHeight: 56,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  saveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
});