import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
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
  created_at?: string;
  updated_at?: string;
};

const TASK_STATUSES: Array<{ value: TaskStatus; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'todo', label: 'План', icon: 'ellipse-outline' },
  { value: 'process', label: 'В работе', icon: 'flash-outline' },
  { value: 'review', label: 'Проверка', icon: 'eye-outline' },
  { value: 'done', label: 'Готово', icon: 'checkmark-done-outline' },
];

const PRIORITIES: Array<{ value: TaskPriority; label: string }> = [
  { value: 'low', label: 'Низкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'high', label: 'Высокий' },
];

function userName(user?: UserMini | null) {
  if (!user) return 'Не назначен';
  return user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email;
}

function formatDate(value?: string | null) {
  if (!value) return 'Без дедлайна';
  try {
    return new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return value;
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ru-RU');
  } catch {
    return value;
  }
}

function priorityLabel(priority?: string) {
  if (priority === 'low') return 'Низкий';
  if (priority === 'medium') return 'Средний';
  if (priority === 'high') return 'Высокий';
  return priority || '—';
}

function statusColor(status: string, theme: any) {
  if (status === 'done') return theme.success || '#1AAE6F';
  if (status === 'review') return theme.warning || '#F59E0B';
  if (status === 'process') return theme.blue;
  return theme.textMuted;
}

function priorityColor(priority: string, theme: any) {
  if (priority === 'high') return theme.red;
  if (priority === 'medium') return theme.warning || '#F59E0B';
  return theme.success || '#1AAE6F';
}

function markdownStyles(theme: any) {
  return {
    body: { color: theme.textSecondary, fontSize: 14, lineHeight: 21, fontWeight: '600' },
    paragraph: { marginTop: 0, marginBottom: 8 },
    strong: { color: theme.text, fontWeight: '900' },
    heading1: { color: theme.text, fontSize: 22, fontWeight: '900', marginBottom: 8 },
    heading2: { color: theme.text, fontSize: 19, fontWeight: '900', marginBottom: 6 },
    heading3: { color: theme.text, fontSize: 17, fontWeight: '900', marginBottom: 6 },
    link: { color: theme.blue, fontWeight: '900' },
  };
}

function flattenTaskError(error: any) {
  const data = error?.response?.data;
  return data?.detail || data?.title?.[0] || data?.parent?.[0] || data?.project?.[0] || data?.assigned_to?.[0] || data?.deadline?.[0] || 'Не удалось сохранить задачу.';
}

function taskStats(task?: ProjectTask | null) {
  const subtasks = task?.subtasks || [];
  const total = subtasks.length;
  const done = subtasks.filter((item) => item.status === 'done').length;
  const percent = total > 0 ? Math.round((done / total) * 100) : task?.status === 'done' ? 100 : 0;
  return { total, done, percent };
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
  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');
  const canManage = Boolean(task && user && (isAdmin || Number(task.created_by) === Number(user.id)));

  const load = async () => {
    if (!taskId) return;

    try {
      const [taskRes, usersRes] = await Promise.allSettled([
        apiClient.get(`tasks/project-tasks/${taskId}/`),
        fetchAllPages('users/users/?limit=100&offset=0'),
      ]);

      if (taskRes.status === 'fulfilled') setTask(taskRes.value.data);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value as UserMini[]);
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить задачу.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [taskId]);

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
        deadline: editDeadline.trim() || null,
      });

      setEditModalOpen(false);
      await load();
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
        deadline: subtaskDeadline.trim() || null,
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

  const updateTaskStatus = async (item: ProjectTask, status: TaskStatus) => {
    try {
      await apiClient.patch(`tasks/project-tasks/${item.id}/`, { status });
      await load();
    } catch {
      Alert.alert('Ошибка', 'Не удалось обновить статус.');
    }
  };

  const openSubtask = (item: ProjectTask) => {
    router.push({ pathname: '/(app)/task/[id]', params: { id: String(item.id), projectId: String(item.project) } } as any);
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
    Alert.alert('Удалить задачу?', 'Задача и все вложенные подзадачи будут удалены.', [
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
          <Pressable onPress={() => safeGoBack(router, backFallback)} style={[styles.backWideBtn, { backgroundColor: theme.blue }]}>
            <Text style={styles.backWideText}>Назад</Text>
          </Pressable>
        </View>
      </ScreenWrapper>
    );
  }

  const taskStatusColor = statusColor(task.status, theme);
  const taskPriorityColor = priorityColor(task.priority, theme);

  return (
    <ScreenWrapper>
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
        <LinearGradient
          colors={dark ? ['#111827', '#1E3A8A'] : ['#2563EB', '#60A5FA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <Pressable onPress={() => safeGoBack(router, backFallback)} style={styles.heroBackBtn}>
              <Ionicons name="arrow-back" size={21} color="#fff" />
            </Pressable>

            <View style={styles.heroActions}>
              {canManage && (
                <Pressable onPress={openEditModal} style={styles.heroIconBtn}>
                  <Ionicons name="create-outline" size={18} color="#fff" />
                </Pressable>
              )}

              {canManage && (
                <Pressable onPress={confirmDelete} disabled={deleting} style={styles.heroDeleteBtn}>
                  {deleting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="trash-outline" size={18} color="#fff" />}
                </Pressable>
              )}
            </View>
          </View>

          <Text style={styles.heroKicker}>Папка задачи</Text>
          <Text style={styles.heroTitle}>{task.title}</Text>
          <Text style={styles.heroSubtitle}>Создатель: {userName(task.created_by_data)} · Дедлайн: {formatDate(task.deadline)}</Text>

          <View style={styles.heroProgressBox}>
            <View style={styles.heroProgressTop}>
              <Text style={styles.heroProgressLabel}>Подзадачи выполнены</Text>
              <Text style={styles.heroProgressPercent}>{stats.percent}%</Text>
            </View>

            <View style={styles.heroProgressTrack}>
              <View style={[styles.heroProgressFill, { width: `${stats.percent}%` }]} />
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{stats.total}</Text>
                <Text style={styles.heroStatLabel}>Всего</Text>
              </View>
              <View style={styles.heroLine} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{stats.done}</Text>
                <Text style={styles.heroStatLabel}>Готово</Text>
              </View>
              <View style={styles.heroLine} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{priorityLabel(task.priority)}</Text>
                <Text style={styles.heroStatLabel}>Приоритет</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.cardIcon, { backgroundColor: theme.blueSoft }]}>
              <Ionicons name="information-circle-outline" size={19} color={theme.blue} />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Детали задачи</Text>
          </View>

          <View style={styles.metaGrid}>
            <View style={[styles.metaItem, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
              <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Статус</Text>
              <Text style={[styles.metaValue, { color: taskStatusColor }]}>{TASK_STATUSES.find((x) => x.value === task.status)?.label || task.status}</Text>
            </View>

            <View style={[styles.metaItem, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
              <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Приоритет</Text>
              <Text style={[styles.metaValue, { color: taskPriorityColor }]}>{priorityLabel(task.priority)}</Text>
            </View>

            <View style={[styles.metaItem, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
              <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Ответственный</Text>
              <Text style={[styles.metaValue, { color: theme.text }]} numberOfLines={1}>{userName(task.assigned_to_data)}</Text>
            </View>

            <View style={[styles.metaItem, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
              <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Обновлено</Text>
              <Text style={[styles.metaValue, { color: theme.text }]} numberOfLines={1}>{formatDateTime(task.updated_at)}</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
            {TASK_STATUSES.map((item) => {
              const active = task.status === item.value;
              const color = statusColor(item.value, theme);

              return (
                <Pressable
                  key={item.value}
                  onPress={() => updateTaskStatus(task, item.value)}
                  style={[styles.statusPill, { backgroundColor: active ? color : theme.backgroundSoft, borderColor: active ? color : theme.border }]}
                >
                  <Ionicons name={item.icon} size={14} color={active ? '#fff' : color} />
                  <Text style={[styles.statusText, { color: active ? '#fff' : theme.text }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.cardIcon, { backgroundColor: theme.blueSoft }]}>
              <Ionicons name="document-text-outline" size={19} color={theme.blue} />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Описание</Text>
          </View>

          {task.description ? <Markdown style={markdownStyles(theme) as any}>{task.description}</Markdown> : <Text style={[styles.emptySmall, { color: theme.textSecondary }]}>Описание не добавлено.</Text>}
        </View>

        <View style={styles.subtasksHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bigSectionTitle, { color: theme.text }]}>Подзадачи</Text>
            <Text style={[styles.bigSectionSub, { color: theme.textSecondary }]}>Работает как папка: внутри этой задачи можно создавать вложенные задачи.</Text>
          </View>

          <Pressable onPress={() => setSubtaskModalOpen(true)} style={[styles.smallAddBtn, { backgroundColor: theme.blueSoft }]}>
            <Ionicons name="add" size={18} color={theme.blue} />
          </Pressable>
        </View>

        {(task.subtasks || []).length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="folder-open-outline" size={38} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Подзадач пока нет</Text>
            <Text style={[styles.emptySmall, { color: theme.textSecondary }]}>Нажми плюс и создай первую подзадачу.</Text>
          </View>
        ) : (
          (task.subtasks || []).map((item) => {
            const color = statusColor(item.status, theme);
            const pColor = priorityColor(item.priority, theme);

            return (
              <Pressable key={item.id} onPress={() => openSubtask(item)} style={[styles.subtaskCard, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
                <View style={styles.subtaskTop}>
                  <View style={[styles.subtaskIcon, { backgroundColor: `${color}18` }]}>
                    <Ionicons name={item.status === 'done' ? 'checkmark-circle' : 'ellipse-outline'} size={19} color={color} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.subtaskTitle, { color: theme.text }]}>{item.title}</Text>
                    <Text style={[styles.subtaskMeta, { color: theme.textSecondary }]} numberOfLines={1}>{userName(item.assigned_to_data)} · {formatDate(item.deadline)}</Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                </View>

                <View style={styles.subtaskFooter}>
                  <View style={[styles.smallPill, { backgroundColor: `${color}18` }]}>
                    <Text style={[styles.smallPillText, { color }]}>{TASK_STATUSES.find((x) => x.value === item.status)?.label || item.status}</Text>
                  </View>

                  <View style={[styles.smallPill, { backgroundColor: `${pColor}18` }]}>
                    <Text style={[styles.smallPillText, { color: pColor }]}>{priorityLabel(item.priority)}</Text>
                  </View>

                  <View style={[styles.smallPill, { backgroundColor: theme.backgroundSoft }]}>
                    <Text style={[styles.smallPillText, { color: theme.textSecondary }]}>{item.subtasks_count || item.subtasks?.length || 0} влож.</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}

        <Pressable onPress={() => setSubtaskModalOpen(true)} style={[styles.createSubtaskBtn, { backgroundColor: theme.blue }]}>
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.createSubtaskText}>Создать подзадачу</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={editModalOpen} animationType="slide" transparent onRequestClose={() => setEditModalOpen(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Редактировать задачу</Text>
                <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>Редактировать может создатель или админ</Text>
              </View>

              <Pressable onPress={() => setEditModalOpen(false)} style={[styles.modalClose, { backgroundColor: theme.backgroundSoft }]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>

            <TaskForm
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
              submitLabel={savingEdit ? 'Сохранение...' : 'Сохранить изменения'}
              saving={savingEdit}
              onSubmit={saveEdit}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={subtaskModalOpen} animationType="slide" transparent onRequestClose={() => setSubtaskModalOpen(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Новая подзадача</Text>
                <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>Будет создана внутри текущей задачи</Text>
              </View>

              <Pressable onPress={() => setSubtaskModalOpen(false)} style={[styles.modalClose, { backgroundColor: theme.backgroundSoft }]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>

            <TaskForm
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
              submitLabel={savingSubtask ? 'Создание...' : 'Создать подзадачу'}
              saving={savingSubtask}
              onSubmit={createSubtask}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenWrapper>
  );
}

function TaskForm({
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
  submitLabel,
  saving,
  onSubmit,
}: {
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
  submitLabel: string;
  saving: boolean;
  onSubmit: () => void;
}) {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
      <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Название</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="Название задачи" placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} />
      </View>

      <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Описание Markdown</Text>
        <TextInput value={description} onChangeText={setDescription} placeholder={'Описание задачи\n- пункт\n**важное**'} placeholderTextColor={theme.textMuted} style={[styles.input, styles.textarea, { color: theme.text }]} multiline textAlignVertical="top" />
      </View>

      <Text style={[styles.peopleTitle, { color: theme.text }]}>Ответственный</Text>
      <View style={styles.peopleWrap}>
        <Pressable onPress={() => setAssignedTo(null)} style={[styles.personPill, { backgroundColor: assignedTo === null ? theme.blue : theme.backgroundSoft, borderColor: assignedTo === null ? theme.blue : theme.border }]}>
          <Text style={[styles.personText, { color: assignedTo === null ? '#fff' : theme.text }]}>Не назначен</Text>
        </Pressable>

        {users.map((item) => (
          <Pressable key={item.id} onPress={() => setAssignedTo(item.id)} style={[styles.personPill, { backgroundColor: assignedTo === item.id ? theme.blue : theme.backgroundSoft, borderColor: assignedTo === item.id ? theme.blue : theme.border }]}>
            <Text style={[styles.personText, { color: assignedTo === item.id ? '#fff' : theme.text }]}>{userName(item)}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.peopleTitle, { color: theme.text }]}>Статус</Text>
      <View style={styles.peopleWrap}>
        {TASK_STATUSES.map((item) => (
          <Pressable key={item.value} onPress={() => setStatusValue(item.value)} style={[styles.personPill, { backgroundColor: statusValue === item.value ? theme.blue : theme.backgroundSoft, borderColor: statusValue === item.value ? theme.blue : theme.border }]}>
            <Text style={[styles.personText, { color: statusValue === item.value ? '#fff' : theme.text }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.peopleTitle, { color: theme.text }]}>Приоритет</Text>
      <View style={styles.peopleWrap}>
        {PRIORITIES.map((item) => (
          <Pressable key={item.value} onPress={() => setPriority(item.value)} style={[styles.personPill, { backgroundColor: priority === item.value ? theme.blue : theme.backgroundSoft, borderColor: priority === item.value ? theme.blue : theme.border }]}>
            <Text style={[styles.personText, { color: priority === item.value ? '#fff' : theme.text }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Дедлайн</Text>
        <TextInput value={deadline} onChangeText={setDeadline} placeholder="2026-05-20 или 2026-05-20T18:00:00" placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} autoCapitalize="none" />
      </View>

      <Pressable onPress={onSubmit} disabled={saving} style={[styles.saveBtn, { backgroundColor: theme.blue, opacity: saving ? 0.65 : 1 }]}>
        {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
        <Text style={styles.saveText}>{submitLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 22, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 128, gap: 14 },
  hero: { borderRadius: 32, padding: 18, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 },
  heroBackBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroIconBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  heroDeleteBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.72)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  heroKicker: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  heroTitle: { marginTop: 8, color: '#fff', fontSize: 31, fontWeight: '900', letterSpacing: -0.4 },
  heroSubtitle: { marginTop: 8, color: 'rgba(255,255,255,0.84)', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  heroProgressBox: { marginTop: 20, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', padding: 12 },
  heroProgressTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroProgressLabel: { color: 'rgba(255,255,255,0.84)', fontSize: 12, fontWeight: '900' },
  heroProgressPercent: { color: '#fff', fontSize: 16, fontWeight: '900' },
  heroProgressTrack: { marginTop: 10, height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  heroProgressFill: { height: '100%', borderRadius: 999, backgroundColor: '#fff' },
  heroStats: { marginTop: 14, minHeight: 58, flexDirection: 'row', alignItems: 'center' },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatValue: { color: '#fff', fontSize: 18, fontWeight: '900' },
  heroStatLabel: { marginTop: 3, color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '800' },
  heroLine: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.18)' },
  card: { borderWidth: 1, borderRadius: 26, padding: 16, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cardIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { width: '47%', borderWidth: 1, borderRadius: 18, padding: 12 },
  metaLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { marginTop: 5, fontSize: 13, fontWeight: '900' },
  statusRow: { marginTop: 14, gap: 8 },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 12, fontWeight: '900' },
  subtasksHeader: { marginTop: 2, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  bigSectionTitle: { fontSize: 21, fontWeight: '900' },
  bigSectionSub: { marginTop: 4, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  smallAddBtn: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { borderWidth: 1, borderRadius: 26, padding: 22, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptySmall: { fontSize: 13, fontWeight: '700', lineHeight: 19 },
  subtaskCard: { borderWidth: 1, borderRadius: 24, padding: 14, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 2 },
  subtaskTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subtaskIcon: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  subtaskTitle: { fontSize: 15, fontWeight: '900' },
  subtaskMeta: { marginTop: 4, fontSize: 12, fontWeight: '700' },
  subtaskFooter: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  smallPillText: { fontSize: 11, fontWeight: '900' },
  createSubtaskBtn: { minHeight: 54, borderRadius: 20, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  createSubtaskText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.38)' },
  modalCard: { maxHeight: '88%', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 22 },
  modalHandle: { width: 42, height: 5, borderRadius: 999, backgroundColor: 'rgba(148,163,184,0.55)', alignSelf: 'center', marginBottom: 14 },
  modalHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  modalTitle: { fontSize: 22, fontWeight: '900' },
  modalSubtitle: { marginTop: 4, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  modalClose: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  modalScroll: { paddingTop: 14, paddingBottom: 28, gap: 12 },
  inputWrap: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12 },
  inputLabel: { fontSize: 12, fontWeight: '900', marginBottom: 8 },
  input: { minHeight: 26, fontSize: 15, fontWeight: '700' },
  textarea: { minHeight: 120, lineHeight: 21 },
  peopleTitle: { fontSize: 14, fontWeight: '900' },
  peopleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  personPill: { minHeight: 38, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  personText: { fontSize: 12, fontWeight: '900' },
  saveBtn: { marginTop: 4, borderRadius: 20, minHeight: 56, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  backWideBtn: { marginTop: 16, minHeight: 48, borderRadius: 18, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  backWideText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});