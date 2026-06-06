import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
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

import ScreenWrapper from '../../../components/ScreenWrapper';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import apiClient, { extractList, fetchAllPages } from '../../../src/api/apiClient';
import { useTheme } from '../../../src/context/ThemeContext';
import { safeGoBack } from '../../../src/navigation/safeGoBack';

type UserMini = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
};

type ProjectStatus = 'active' | 'paused' | 'done' | 'archived';
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
  can_manage?: boolean;
  can_change_status?: boolean;
};

type Project = {
  id: number;
  title: string;
  description?: string;
  city?: string;
  office_city?: string;
  status: ProjectStatus;
  deadline?: string | null;
  created_by?: number | null;
  created_by_data?: UserMini | null;
  participants_data?: UserMini[];
  responsible_users_data?: UserMini[];
  items?: ProjectTask[];
  tasks_count?: number;
  done_tasks_count?: number;
  subtasks_count?: number;
  sections_count?: number;
  posts_count?: number;
  created_at?: string;
  updated_at?: string;
  can_manage?: boolean;
};

type ProjectSectionPost = {
  id: number;
  section: number;
  title?: string;
  body?: string;
  copy_text?: string;
  display_copy_text?: string;
  note?: string;
  is_pinned?: boolean;
  created_by?: number | null;
  created_by_data?: UserMini | null;
  updated_by?: number | null;
  updated_by_data?: UserMini | null;
  created_at?: string;
  updated_at?: string;
  can_manage?: boolean;
};

type ProjectSection = {
  id: number;
  project: number;
  title: string;
  description?: string;
  color?: string;
  icon?: string;
  order?: number;
  is_pinned?: boolean;
  created_by?: number | null;
  created_by_data?: UserMini | null;
  posts?: ProjectSectionPost[];
  posts_count?: number;
  created_at?: string;
  updated_at?: string;
  can_manage?: boolean;
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

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Низкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'high', label: 'Высокий' },
];

const SECTION_ICONS: (keyof typeof Ionicons.glyphMap)[] = [
  'albums-outline',
  'briefcase-outline',
  'clipboard-outline',
  'document-text-outline',
  'megaphone-outline',
  'school-outline',
  'people-outline',
  'flag-outline',
];

const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'active', label: 'Активный' },
  { value: 'paused', label: 'Пауза' },
  { value: 'done', label: 'Завершён' },
  { value: 'archived', label: 'Архив' },
];

function userName(user?: UserMini | null) {
  if (!user) return 'Не указан';
  return user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email;
}

function initials(user?: UserMini | null) {
  const name = userName(user);
  const parts = name.split(/\s+/).filter(Boolean);

  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
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

function projectStatusLabel(status?: string) {
  if (status === 'active') return 'Активный';
  if (status === 'paused') return 'Пауза';
  if (status === 'done') return 'Завершён';
  if (status === 'archived') return 'Архив';
  return status || '—';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

function normalizeDeadline(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T23:59:00`;
  }

  return trimmed;
}

function cleanText(value?: string | null) {
  return String(value || '').trim();
}

function taskStatusColor(status: string | undefined, theme: any) {
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

function flattenProjectError(error: any) {
  const data = error?.response?.data;

  return (
    data?.detail ||
    data?.title?.[0] ||
    data?.participants?.[0] ||
    data?.responsible_users?.[0] ||
    data?.deadline?.[0] ||
    'Не удалось сохранить проект.'
  );
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

function flattenSectionError(error: any) {
  const data = error?.response?.data;

  return (
    data?.detail ||
    data?.project?.[0] ||
    data?.title?.[0] ||
    data?.description?.[0] ||
    data?.order?.[0] ||
    'Не удалось сохранить раздел.'
  );
}

function flattenPostError(error: any) {
  const data = error?.response?.data;

  return (
    data?.detail ||
    data?.section?.[0] ||
    data?.title?.[0] ||
    data?.body?.[0] ||
    data?.copy_text?.[0] ||
    'Не удалось сохранить запись.'
  );
}

function Avatar({
  user,
  theme,
  size = 32,
}: {
  user?: UserMini | null;
  theme: any;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.blue,
          borderColor: theme.surface,
        },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: Math.max(10, size * 0.34) }]}>{initials(user)}</Text>
    </View>
  );
}

function MetaUser({
  label,
  user,
  date,
  theme,
}: {
  label: string;
  user?: UserMini | null;
  date?: string | null;
  theme: any;
}) {
  return (
    <View style={styles.metaUser}>
      <Avatar user={user} theme={theme} size={28} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.metaUserLabel, { color: theme.textMuted }]}>{label}</Text>
        <Text style={[styles.metaUserName, { color: theme.text }]} numberOfLines={1}>
          {userName(user)} · {formatDateTime(date)}
        </Text>
      </View>
    </View>
  );
}

function Pill({
  icon,
  text,
  color,
  bg,
  border,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: border }]}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={[styles.pillText, { color }]}>{text}</Text>
    </View>
  );
}

export default function ProjectDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { theme, themeMode } = useTheme();
  const { user } = useCurrentUser();

  const dark = themeMode === 'dark';
  const projectId = Number(params.id);
  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');
  const currentUserId = user?.id ? Number(user.id) : undefined;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [project, setProject] = useState<Project | null>(null);
  const [sections, setSections] = useState<ProjectSection[]>([]);
  const [users, setUsers] = useState<UserMini[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'tasks' | 'sections'>('tasks');

  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [savingProject, setSavingProject] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editStatus, setEditStatus] = useState<ProjectStatus>('active');

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskAssignedTo, setTaskAssignedTo] = useState<number | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('todo');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskDeadline, setTaskDeadline] = useState('');

  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<ProjectSection | null>(null);
  const [savingSection, setSavingSection] = useState(false);
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionDescription, setSectionDescription] = useState('');
  const [sectionIcon, setSectionIcon] = useState<keyof typeof Ionicons.glyphMap>('albums-outline');
  const [sectionOrder, setSectionOrder] = useState('');
  const [sectionPinned, setSectionPinned] = useState(false);

  const [postModalOpen, setPostModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<ProjectSectionPost | null>(null);
  const [postSectionId, setPostSectionId] = useState<number | null>(null);
  const [savingPost, setSavingPost] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [postCopyText, setPostCopyText] = useState('');
  const [postNote, setPostNote] = useState('');
  const [postPinned, setPostPinned] = useState(false);

  const tasks = useMemo(() => project?.items || [], [project?.items]);

  const canManageProject = useMemo(() => {
    if (!project) return false;
    if (project.can_manage) return true;
    if (isAdmin) return true;
    if (!currentUserId) return false;
    return Number(project.created_by) === Number(currentUserId);
  }, [project, isAdmin, currentUserId]);

  const stats = useMemo(() => {
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((task) => task.status === 'done').length;
    const posts = sections.reduce((sum, section) => sum + Number(section.posts?.length || section.posts_count || 0), 0);
    const pinnedSections = sections.filter((section) => section.is_pinned).length;
    const pinnedPosts = sections.reduce(
      (sum, section) => sum + Number((section.posts || []).filter((post) => post.is_pinned).length),
      0
    );

    return {
      totalTasks,
      doneTasks,
      sections: sections.length,
      posts,
      pinned: pinnedSections + pinnedPosts,
      progress: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : project?.status === 'done' ? 100 : 0,
    };
  }, [tasks, sections, project?.status]);

  const taskGroups = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = !q
      ? tasks
      : tasks.filter((task) => {
          return (
            task.title.toLowerCase().includes(q) ||
            String(task.description || '').toLowerCase().includes(q) ||
            userName(task.assigned_to_data).toLowerCase().includes(q) ||
            userName(task.created_by_data).toLowerCase().includes(q)
          );
        });

    return TASK_STATUSES.map((status) => ({
      ...status,
      items: filtered.filter((task) => task.status === status.value),
    }));
  }, [tasks, search]);

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return sections;

    return sections
      .map((section) => {
        const sectionMatch =
          section.title.toLowerCase().includes(q) ||
          String(section.description || '').toLowerCase().includes(q) ||
          userName(section.created_by_data).toLowerCase().includes(q);

        const posts = (section.posts || []).filter((post) => {
          return (
            String(post.title || '').toLowerCase().includes(q) ||
            String(post.body || '').toLowerCase().includes(q) ||
            String(post.copy_text || '').toLowerCase().includes(q) ||
            String(post.note || '').toLowerCase().includes(q) ||
            userName(post.created_by_data).toLowerCase().includes(q) ||
            userName(post.updated_by_data).toLowerCase().includes(q)
          );
        });

        if (sectionMatch) return section;
        if (posts.length) return { ...section, posts };

        return null;
      })
      .filter(Boolean) as ProjectSection[];
  }, [sections, search]);

  const load = useCallback(async () => {
    if (!projectId) return;

    try {
      const [projectRes, sectionsRes, usersRes] = await Promise.allSettled([
        apiClient.get(`tasks/projects/${projectId}/`),
        apiClient.get(`tasks/project-sections/?project=${projectId}&limit=200&offset=0`),
        fetchAllPages('users/users/?limit=100&offset=0'),
      ]);

      if (projectRes.status === 'fulfilled') {
        setProject(projectRes.value.data);
      }

      if (sectionsRes.status === 'fulfilled') {
        setSections(extractList(sectionsRes.value.data) as ProjectSection[]);
      }

      if (usersRes.status === 'fulfilled') {
        setUsers(usersRes.value as UserMini[]);
      }
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.detail || 'Не удалось загрузить проект.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    void load();
  };

  const openProjectEdit = () => {
    if (!project) return;

    setEditTitle(project.title || '');
    setEditDescription(project.description || '');
    setEditCity(project.city || project.office_city || '');
    setEditDeadline(project.deadline || '');
    setEditStatus(project.status || 'active');
    setEditProjectOpen(true);
  };

  const saveProject = async () => {
    if (!project) return;

    if (!editTitle.trim()) {
      Alert.alert('Ошибка', 'Название проекта не может быть пустым.');
      return;
    }

    setSavingProject(true);

    try {
      await apiClient.patch(`tasks/projects/${project.id}/`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        city: editCity.trim(),
        status: editStatus,
        deadline: normalizeDeadline(editDeadline),
      });

      setEditProjectOpen(false);
      await load();
      Alert.alert('Готово', 'Проект обновлён.');
    } catch (error: any) {
      Alert.alert('Ошибка', String(flattenProjectError(error)));
    } finally {
      setSavingProject(false);
    }
  };

  const resetTaskForm = () => {
    setTaskTitle('');
    setTaskDescription('');
    setTaskAssignedTo(null);
    setTaskStatus('todo');
    setTaskPriority('medium');
    setTaskDeadline('');
  };

  const createTask = async () => {
    if (!taskTitle.trim()) {
      Alert.alert('Ошибка', 'Напиши название задачи.');
      return;
    }

    setSavingTask(true);

    try {
      await apiClient.post('tasks/project-tasks/', {
        project: projectId,
        parent: null,
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        assigned_to: taskAssignedTo,
        status: taskStatus,
        priority: taskPriority,
        deadline: normalizeDeadline(taskDeadline),
      });

      setTaskModalOpen(false);
      resetTaskForm();
      await load();
    } catch (error: any) {
      Alert.alert('Ошибка', String(flattenTaskError(error)));
    } finally {
      setSavingTask(false);
    }
  };

  const updateTaskStatus = async (task: ProjectTask, nextStatus: TaskStatus) => {
    try {
      await apiClient.patch(`tasks/project-tasks/${task.id}/`, { status: nextStatus });
      await load();
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.detail || 'Не удалось обновить статус задачи.');
    }
  };

  const toggleTaskDone = async (task: ProjectTask) => {
    await updateTaskStatus(task, task.status === 'done' ? 'todo' : 'done');
  };

  const openTask = (task: ProjectTask) => {
    router.push({
      pathname: '/(app)/task/[id]',
      params: {
        id: String(task.id),
        projectId: String(projectId),
      },
    } as any);
  };

  const resetSectionForm = () => {
    setEditingSection(null);
    setSectionTitle('');
    setSectionDescription('');
    setSectionIcon('albums-outline');
    setSectionOrder('');
    setSectionPinned(false);
  };

  const openCreateSection = () => {
    resetSectionForm();
    setSectionModalOpen(true);
  };

  const openEditSection = (section: ProjectSection) => {
    setEditingSection(section);
    setSectionTitle(section.title || '');
    setSectionDescription(section.description || '');
    setSectionIcon((section.icon as keyof typeof Ionicons.glyphMap) || 'albums-outline');
    setSectionOrder(section.order ? String(section.order) : '');
    setSectionPinned(Boolean(section.is_pinned));
    setSectionModalOpen(true);
  };

  const closeSectionModal = () => {
    if (savingSection) return;
    setSectionModalOpen(false);
    resetSectionForm();
  };

  const saveSection = async () => {
    if (!sectionTitle.trim()) {
      Alert.alert('Ошибка', 'Напиши название раздела.');
      return;
    }

    setSavingSection(true);

    try {
      const payload = {
        project: projectId,
        title: sectionTitle.trim(),
        description: sectionDescription.trim(),
        icon: sectionIcon,
        order: sectionOrder.trim() ? Number(sectionOrder) || 0 : 0,
        is_pinned: sectionPinned,
      };

      if (editingSection) {
        await apiClient.patch(`tasks/project-sections/${editingSection.id}/`, payload);
      } else {
        await apiClient.post('tasks/project-sections/', payload);
      }

      setSectionModalOpen(false);
      resetSectionForm();
      await load();
    } catch (error: any) {
      Alert.alert('Ошибка', String(flattenSectionError(error)));
    } finally {
      setSavingSection(false);
    }
  };

  const deleteSection = async (section: ProjectSection) => {
    Alert.alert('Удалить раздел?', 'Все записи внутри этого раздела тоже удалятся.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`tasks/project-sections/${section.id}/`);
            await load();
          } catch (error: any) {
            Alert.alert('Ошибка', error?.response?.data?.detail || 'Не удалось удалить раздел.');
          }
        },
      },
    ]);
  };

  const resetPostForm = () => {
    setEditingPost(null);
    setPostSectionId(null);
    setPostTitle('');
    setPostBody('');
    setPostCopyText('');
    setPostNote('');
    setPostPinned(false);
  };

  const openCreatePost = (section: ProjectSection) => {
    resetPostForm();
    setPostSectionId(section.id);
    setPostModalOpen(true);
  };

  const openEditPost = (post: ProjectSectionPost) => {
    setEditingPost(post);
    setPostSectionId(post.section);
    setPostTitle(post.title || '');
    setPostBody(post.body || '');
    setPostCopyText(post.copy_text || '');
    setPostNote(post.note || '');
    setPostPinned(Boolean(post.is_pinned));
    setPostModalOpen(true);
  };

  const closePostModal = () => {
    if (savingPost) return;
    setPostModalOpen(false);
    resetPostForm();
  };

  const savePost = async () => {
    if (!postSectionId) {
      Alert.alert('Ошибка', 'Не выбран раздел.');
      return;
    }

    if (!postTitle.trim() && !postBody.trim() && !postCopyText.trim()) {
      Alert.alert('Ошибка', 'Заполни заголовок или текст записи.');
      return;
    }

    setSavingPost(true);

    try {
      const payload = {
        section: postSectionId,
        title: postTitle.trim(),
        body: postBody.trim(),
        copy_text: postCopyText.trim(),
        note: postNote.trim(),
        is_pinned: postPinned,
      };

      if (editingPost) {
        await apiClient.patch(`tasks/project-section-posts/${editingPost.id}/`, payload);
      } else {
        await apiClient.post('tasks/project-section-posts/', payload);
      }

      setPostModalOpen(false);
      resetPostForm();
      await load();
    } catch (error: any) {
      Alert.alert('Ошибка', String(flattenPostError(error)));
    } finally {
      setSavingPost(false);
    }
  };

  const deletePost = async (post: ProjectSectionPost) => {
    Alert.alert('Удалить запись?', 'Запись будет удалена из раздела.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`tasks/project-section-posts/${post.id}/`);
            await load();
          } catch (error: any) {
            Alert.alert('Ошибка', error?.response?.data?.detail || 'Не удалось удалить запись.');
          }
        },
      },
    ]);
  };

  const copyPost = async (post: ProjectSectionPost) => {
    const text = cleanText(post.display_copy_text || post.copy_text || post.body || post.title);

    if (!text) {
      Alert.alert('Пусто', 'В этой записи нет текста для копирования.');
      return;
    }

    await Clipboard.setStringAsync(text);
    Alert.alert('Скопировано', 'Текст записи скопирован.');
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={[styles.center, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.blue} />
        </View>
      </ScreenWrapper>
    );
  }

  if (!project) {
    return (
      <ScreenWrapper>
        <View style={[styles.center, { backgroundColor: theme.background }]}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Проект не найден</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            Возможно, у тебя нет доступа к этому проекту.
          </Text>
          <Pressable
            onPress={() => safeGoBack(router, '/(app)/projects')}
            style={[styles.primaryWideBtn, { backgroundColor: theme.blue }]}
          >
            <Text style={styles.primaryWideText}>Назад</Text>
          </Pressable>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.blue} />}
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
              <Pressable
                onPress={() => safeGoBack(router, '/(app)/projects')}
                style={[styles.backBtn, { backgroundColor: theme.backgroundSoft }]}
              >
                <Ionicons name="arrow-back" size={21} color={theme.text} />
              </Pressable>

              <View style={{ flex: 1 }}>
                <Text style={[styles.kicker, { color: theme.textMuted }]}>PROJECT #{project.id}</Text>
                <Text style={[styles.title, { color: theme.text }]}>{project.title}</Text>
              </View>

              {canManageProject && (
                <Pressable onPress={openProjectEdit} style={[styles.iconBtn, { backgroundColor: theme.blue }]}>
                  <Ionicons name="create-outline" size={18} color="#fff" />
                </Pressable>
              )}
            </View>

            {!!project.description && (
              <Text style={[styles.projectDescription, { color: theme.textSecondary }]}>{project.description}</Text>
            )}

            <View style={styles.pillsRow}>
              <Pill
                icon="radio-button-on-outline"
                text={projectStatusLabel(project.status)}
                color={theme.blue}
                bg={theme.blueSoft}
                border={theme.blueSoft}
              />
              <Pill
                icon="location-outline"
                text={project.city || project.office_city || 'Без города'}
                color={theme.textSecondary}
                bg={theme.backgroundSoft}
                border={theme.border}
              />
              <Pill
                icon="time-outline"
                text={formatDate(project.deadline)}
                color={theme.textSecondary}
                bg={theme.backgroundSoft}
                border={theme.border}
              />
            </View>

            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Text style={[styles.statValue, { color: theme.text }]}>{stats.totalTasks}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Задач</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Text style={[styles.statValue, { color: theme.text }]}>{stats.doneTasks}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Готово</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Text style={[styles.statValue, { color: theme.text }]}>{stats.sections}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Разделов</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Text style={[styles.statValue, { color: theme.text }]}>{stats.posts}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Записей</Text>
              </View>
            </View>

            <View style={[styles.progressTrack, { backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }]}>
              <View style={[styles.progressFill, { width: `${stats.progress}%`, backgroundColor: theme.blue }]} />
            </View>

            <Text style={[styles.progressText, { color: theme.textSecondary }]}>
              Прогресс по задачам: {stats.progress}%
            </Text>

            <MetaUser label="Проект создал" user={project.created_by_data} date={project.created_at} theme={theme} />
          </View>

          <View
            style={[
              styles.toolbar,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <View style={[styles.searchBox, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
              <Ionicons name="search-outline" size={18} color={theme.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={activeTab === 'tasks' ? 'Поиск по задачам' : 'Поиск по разделам и записям'}
                placeholderTextColor={theme.textMuted}
                style={[styles.searchInput, { color: theme.text }]}
              />
              {!!search && (
                <Pressable onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                </Pressable>
              )}
            </View>

            <View style={[styles.tabs, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
              <Pressable
                onPress={() => setActiveTab('tasks')}
                style={[styles.tab, { backgroundColor: activeTab === 'tasks' ? theme.blue : 'transparent' }]}
              >
                <Ionicons name="checkbox-outline" size={16} color={activeTab === 'tasks' ? '#fff' : theme.textSecondary} />
                <Text style={[styles.tabText, { color: activeTab === 'tasks' ? '#fff' : theme.textSecondary }]}>
                  Задачи
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('sections')}
                style={[styles.tab, { backgroundColor: activeTab === 'sections' ? theme.blue : 'transparent' }]}
              >
                <Ionicons name="albums-outline" size={16} color={activeTab === 'sections' ? '#fff' : theme.textSecondary} />
                <Text style={[styles.tabText, { color: activeTab === 'sections' ? '#fff' : theme.textSecondary }]}>
                  Разделы
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={activeTab === 'tasks' ? () => setTaskModalOpen(true) : openCreateSection}
              style={[styles.addSectionBtn, { backgroundColor: theme.blue }]}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.addSectionText}>{activeTab === 'tasks' ? 'Задача' : 'Раздел'}</Text>
            </Pressable>
          </View>

          {activeTab === 'tasks' ? (
            <View style={styles.taskBoard}>
              {taskGroups.map((group) => {
                const color = taskStatusColor(group.value, theme);

                return (
                  <View
                    key={group.value}
                    style={[styles.taskColumn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  >
                    <View style={styles.columnHeader}>
                      <View style={[styles.columnIcon, { backgroundColor: `${color}18` }]}>
                        <Ionicons name={group.icon} size={17} color={color} />
                      </View>
                      <Text style={[styles.columnTitle, { color: theme.text }]}>{group.label}</Text>
                      <View style={[styles.countBadge, { backgroundColor: theme.backgroundSoft }]}>
                        <Text style={[styles.countBadgeText, { color: theme.textSecondary }]}>{group.items.length}</Text>
                      </View>
                    </View>

                    {group.items.length === 0 ? (
                      <Text style={[styles.emptyColumnText, { color: theme.textMuted }]}>Нет задач</Text>
                    ) : (
                      <View style={styles.tasksList}>
                        {group.items.map((task) => {
                          const statusColor = taskStatusColor(task.status, theme);
                          const pColor = priorityColor(task.priority, theme);
                          const d = deadlineMeta(task.deadline);
                          const dColor =
                            d.tone === 'danger'
                              ? theme.red
                              : d.tone === 'warning'
                                ? theme.warning || '#F59E0B'
                                : theme.textMuted;

                          return (
                            <Pressable
                              key={task.id}
                              onPress={() => openTask(task)}
                              style={[
                                styles.taskCard,
                                {
                                  backgroundColor: dark ? '#0F172A' : '#FFFFFF',
                                  borderColor: theme.border,
                                },
                              ]}
                            >
                              <View style={styles.taskTop}>
                                <Pressable
                                  onPress={(event) => {
                                    event.stopPropagation();
                                    void toggleTaskDone(task);
                                  }}
                                  style={[
                                    styles.taskCheck,
                                    {
                                      borderColor: statusColor,
                                      backgroundColor: task.status === 'done' ? statusColor : 'transparent',
                                    },
                                  ]}
                                >
                                  {task.status === 'done' && <Ionicons name="checkmark" size={13} color="#fff" />}
                                </Pressable>

                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.taskTitle, { color: theme.text }]} numberOfLines={2}>
                                    {task.title}
                                  </Text>

                                  {!!task.description && (
                                    <Text style={[styles.taskDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                                      {task.description.replace(/[#*_`>-]/g, '').trim()}
                                    </Text>
                                  )}
                                </View>

                                <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
                              </View>

                              <View style={styles.taskMetaRow}>
                                <View style={[styles.smallPill, { backgroundColor: `${pColor}18` }]}>
                                  <Text style={[styles.smallPillText, { color: pColor }]}>{priorityLabel(task.priority)}</Text>
                                </View>

                                <View style={[styles.smallPill, { backgroundColor: theme.backgroundSoft }]}>
                                  <Text style={[styles.smallPillText, { color: dColor }]}>{d.label}</Text>
                                </View>

                                <View style={[styles.smallPill, { backgroundColor: theme.backgroundSoft }]}>
                                  <Text style={[styles.smallPillText, { color: theme.textSecondary }]}>
                                    {task.subtasks_count || task.subtasks?.length || 0} подз.
                                  </Text>
                                </View>
                              </View>

                              <MetaUser label="Ответственный" user={task.assigned_to_data} date={task.updated_at} theme={theme} />

                              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusActions}>
                                {TASK_STATUSES.map((item) => {
                                  const active = task.status === item.value;
                                  const itemColor = taskStatusColor(item.value, theme);

                                  return (
                                    <Pressable
                                      key={item.value}
                                      onPress={(event) => {
                                        event.stopPropagation();
                                        void updateTaskStatus(task, item.value);
                                      }}
                                      style={[
                                        styles.statusMini,
                                        {
                                          backgroundColor: active ? itemColor : theme.backgroundSoft,
                                          borderColor: active ? itemColor : theme.border,
                                        },
                                      ]}
                                    >
                                      <Text style={[styles.statusMiniText, { color: active ? '#fff' : theme.textSecondary }]}>
                                        {item.label}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </ScrollView>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : filteredSections.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.blueSoft }]}>
                <Ionicons name="albums-outline" size={36} color={theme.blue} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Разделов пока нет</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                Создай раздел, например: “Документы”, “Тексты для копирования”, “Контакты”, “Инструкции”.
              </Text>
              <Pressable onPress={openCreateSection} style={[styles.primaryWideBtn, { backgroundColor: theme.blue }]}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.primaryWideText}>Создать раздел</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.sectionsList}>
              {filteredSections.map((section) => (
                <View
                  key={section.id}
                  style={[
                    styles.sectionCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      shadowColor: theme.shadow,
                    },
                  ]}
                >
                  <View style={styles.sectionTop}>
                    <View style={[styles.sectionIcon, { backgroundColor: theme.blueSoft }]}>
                      <Ionicons
                        name={(section.icon as keyof typeof Ionicons.glyphMap) || 'albums-outline'}
                        size={22}
                        color={theme.blue}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={styles.sectionTitleRow}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
                        {section.is_pinned && <Ionicons name="pin" size={15} color={theme.blue} />}
                      </View>

                      {!!section.description && (
                        <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
                          {section.description}
                        </Text>
                      )}
                    </View>
                  </View>

                  <MetaUser label="Раздел создал" user={section.created_by_data} date={section.created_at} theme={theme} />

                  <View style={styles.sectionActions}>
                    <Pressable
                      onPress={() => openCreatePost(section)}
                      style={[styles.smallActionBtn, { backgroundColor: theme.blue }]}
                    >
                      <Ionicons name="add" size={16} color="#fff" />
                      <Text style={styles.smallActionTextWhite}>Запись</Text>
                    </Pressable>

                    {section.can_manage && (
                      <>
                        <Pressable
                          onPress={() => openEditSection(section)}
                          style={[styles.smallActionBtn, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}
                        >
                          <Ionicons name="create-outline" size={16} color={theme.textSecondary} />
                          <Text style={[styles.smallActionText, { color: theme.textSecondary }]}>Изм.</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => deleteSection(section)}
                          style={[styles.smallActionBtn, { backgroundColor: theme.redSoft, borderColor: theme.redSoft }]}
                        >
                          <Ionicons name="trash-outline" size={16} color={theme.red} />
                          <Text style={[styles.smallActionText, { color: theme.red }]}>Удал.</Text>
                        </Pressable>
                      </>
                    )}
                  </View>

                  <View style={styles.postsList}>
                    {(section.posts || []).length === 0 ? (
                      <View style={[styles.noPostsBox, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                        <Ionicons name="document-text-outline" size={18} color={theme.textMuted} />
                        <Text style={[styles.noPostsText, { color: theme.textSecondary }]}>
                          В этом разделе пока нет записей.
                        </Text>
                      </View>
                    ) : (
                      (section.posts || []).map((post) => {
                        const copyText = cleanText(post.display_copy_text || post.copy_text || post.body || post.title);

                        return (
                          <View
                            key={post.id}
                            style={[
                              styles.postCard,
                              {
                                backgroundColor: dark ? '#0F172A' : '#FFFFFF',
                                borderColor: theme.border,
                              },
                            ]}
                          >
                            <View style={styles.postTitleRow}>
                              <Text style={[styles.postTitle, { color: theme.text }]}>
                                {post.title || 'Без заголовка'}
                              </Text>
                              {post.is_pinned && <Ionicons name="pin" size={14} color={theme.blue} />}
                            </View>

                            {!!post.body && (
                              <Text style={[styles.postBody, { color: theme.textSecondary }]}>{post.body}</Text>
                            )}

                            {!!copyText && (
                              <View style={[styles.copyBox, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                                <Text style={[styles.copyLabel, { color: theme.textMuted }]}>Текст для копирования</Text>
                                <Text style={[styles.copyText, { color: theme.text }]}>{copyText}</Text>
                              </View>
                            )}

                            {!!post.note && (
                              <View style={[styles.noteBox, { backgroundColor: theme.blueSoft, borderColor: theme.blueSoft }]}>
                                <Ionicons name="information-circle-outline" size={15} color={theme.blue} />
                                <Text style={[styles.noteText, { color: theme.blue }]}>{post.note}</Text>
                              </View>
                            )}

                            <MetaUser label="Заполнил" user={post.created_by_data} date={post.created_at} theme={theme} />

                            {!!post.updated_by_data && post.updated_by !== post.created_by && (
                              <MetaUser label="Последний раз изменил" user={post.updated_by_data} date={post.updated_at} theme={theme} />
                            )}

                            <View style={styles.postActions}>
                              <Pressable
                                onPress={() => copyPost(post)}
                                style={[styles.postActionBtn, { backgroundColor: theme.blue }]}
                              >
                                <Ionicons name="copy-outline" size={16} color="#fff" />
                                <Text style={styles.postActionTextWhite}>Копировать</Text>
                              </Pressable>

                              {post.can_manage && (
                                <>
                                  <Pressable
                                    onPress={() => openEditPost(post)}
                                    style={[
                                      styles.postActionBtn,
                                      { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
                                    ]}
                                  >
                                    <Ionicons name="create-outline" size={16} color={theme.textSecondary} />
                                    <Text style={[styles.postActionText, { color: theme.textSecondary }]}>Изменить</Text>
                                  </Pressable>

                                  <Pressable
                                    onPress={() => deletePost(post)}
                                    style={[
                                      styles.postActionBtn,
                                      { backgroundColor: theme.redSoft, borderColor: theme.redSoft },
                                    ]}
                                  >
                                    <Ionicons name="trash-outline" size={16} color={theme.red} />
                                    <Text style={[styles.postActionText, { color: theme.red }]}>Удалить</Text>
                                  </Pressable>
                                </>
                              )}
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <ProjectEditModal
          visible={editProjectOpen}
          theme={theme}
          title={editTitle}
          setTitle={setEditTitle}
          description={editDescription}
          setDescription={setEditDescription}
          city={editCity}
          setCity={setEditCity}
          deadline={editDeadline}
          setDeadline={setEditDeadline}
          statusValue={editStatus}
          setStatusValue={setEditStatus}
          saving={savingProject}
          onClose={() => setEditProjectOpen(false)}
          onSubmit={saveProject}
        />

        <TaskModal
          visible={taskModalOpen}
          theme={theme}
          users={users}
          title={taskTitle}
          setTitle={setTaskTitle}
          description={taskDescription}
          setDescription={setTaskDescription}
          assignedTo={taskAssignedTo}
          setAssignedTo={setTaskAssignedTo}
          statusValue={taskStatus}
          setStatusValue={setTaskStatus}
          priority={taskPriority}
          setPriority={setTaskPriority}
          deadline={taskDeadline}
          setDeadline={setTaskDeadline}
          saving={savingTask}
          onClose={() => setTaskModalOpen(false)}
          onSubmit={createTask}
        />

        <SectionModal
          visible={sectionModalOpen}
          theme={theme}
          editing={Boolean(editingSection)}
          title={sectionTitle}
          setTitle={setSectionTitle}
          description={sectionDescription}
          setDescription={setSectionDescription}
          icon={sectionIcon}
          setIcon={setSectionIcon}
          order={sectionOrder}
          setOrder={setSectionOrder}
          pinned={sectionPinned}
          setPinned={setSectionPinned}
          saving={savingSection}
          onClose={closeSectionModal}
          onSubmit={saveSection}
        />

        <PostModal
          visible={postModalOpen}
          theme={theme}
          editing={Boolean(editingPost)}
          title={postTitle}
          setTitle={setPostTitle}
          body={postBody}
          setBody={setPostBody}
          copyText={postCopyText}
          setCopyText={setPostCopyText}
          note={postNote}
          setNote={setPostNote}
          pinned={postPinned}
          setPinned={setPostPinned}
          saving={savingPost}
          onClose={closePostModal}
          onSubmit={savePost}
        />
      </View>
    </ScreenWrapper>
  );
}

function InputBlock({
  label,
  value,
  onChangeText,
  theme,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  theme: any;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={[styles.inputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor={theme.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType || 'default'}
        style={[
          styles.input,
          multiline ? styles.textarea : null,
          {
            color: theme.text,
          },
        ]}
      />
    </View>
  );
}

function ProjectEditModal({
  visible,
  theme,
  title,
  setTitle,
  description,
  setDescription,
  city,
  setCity,
  deadline,
  setDeadline,
  statusValue,
  setStatusValue,
  saving,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  theme: any;
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  city: string;
  setCity: (value: string) => void;
  deadline: string;
  setDeadline: (value: string) => void;
  statusValue: ProjectStatus;
  setStatusValue: (value: ProjectStatus) => void;
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
          <Text style={[styles.modalTitle, { color: theme.text }]}>Редактировать проект</Text>
          <Pressable onPress={onClose} style={[styles.modalClose, { backgroundColor: theme.backgroundSoft }]}>
            <Ionicons name="close" size={20} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <InputBlock label="Название" value={title} onChangeText={setTitle} theme={theme} />
          <InputBlock label="Описание" value={description} onChangeText={setDescription} theme={theme} multiline />
          <InputBlock label="Город" value={city} onChangeText={setCity} theme={theme} />
          <InputBlock label="Дедлайн" value={deadline} onChangeText={setDeadline} theme={theme} placeholder="2026-05-20" />

          <Text style={[styles.formTitle, { color: theme.text }]}>Статус</Text>
          <View style={styles.optionWrap}>
            {PROJECT_STATUSES.map((item) => {
              const active = statusValue === item.value;

              return (
                <Pressable
                  key={item.value}
                  onPress={() => setStatusValue(item.value)}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: active ? theme.blue : theme.surface,
                      borderColor: active ? theme.blue : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.optionChipText, { color: active ? '#fff' : theme.text }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <ModalFooter theme={theme} saving={saving} onClose={onClose} onSubmit={onSubmit} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TaskModal({
  visible,
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
          <Text style={[styles.modalTitle, { color: theme.text }]}>Новая задача</Text>
          <Pressable onPress={onClose} style={[styles.modalClose, { backgroundColor: theme.backgroundSoft }]}>
            <Ionicons name="close" size={20} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <InputBlock label="Название задачи" value={title} onChangeText={setTitle} theme={theme} />
          <InputBlock label="Описание" value={description} onChangeText={setDescription} theme={theme} multiline />
          <InputBlock label="Дедлайн" value={deadline} onChangeText={setDeadline} theme={theme} placeholder="2026-05-20" />

          <Text style={[styles.formTitle, { color: theme.text }]}>Статус</Text>
          <View style={styles.optionWrap}>
            {TASK_STATUSES.map((item) => {
              const active = statusValue === item.value;

              return (
                <Pressable
                  key={item.value}
                  onPress={() => setStatusValue(item.value)}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: active ? taskStatusColor(item.value, theme) : theme.surface,
                      borderColor: active ? taskStatusColor(item.value, theme) : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.optionChipText, { color: active ? '#fff' : theme.text }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.formTitle, { color: theme.text }]}>Приоритет</Text>
          <View style={styles.optionWrap}>
            {PRIORITIES.map((item) => {
              const active = priority === item.value;

              return (
                <Pressable
                  key={item.value}
                  onPress={() => setPriority(item.value)}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: active ? priorityColor(item.value, theme) : theme.surface,
                      borderColor: active ? priorityColor(item.value, theme) : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.optionChipText, { color: active ? '#fff' : theme.text }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.formTitle, { color: theme.text }]}>Ответственный</Text>
          <View style={styles.usersWrap}>
            <Pressable
              onPress={() => setAssignedTo(null)}
              style={[
                styles.userChip,
                {
                  backgroundColor: assignedTo === null ? theme.blue : theme.surface,
                  borderColor: assignedTo === null ? theme.blue : theme.border,
                },
              ]}
            >
              <Text style={[styles.userChipText, { color: assignedTo === null ? '#fff' : theme.text }]}>Не назначен</Text>
            </Pressable>

            {users.map((item) => {
              const active = Number(assignedTo) === Number(item.id);

              return (
                <Pressable
                  key={item.id}
                  onPress={() => setAssignedTo(Number(item.id))}
                  style={[
                    styles.userChip,
                    {
                      backgroundColor: active ? theme.blue : theme.surface,
                      borderColor: active ? theme.blue : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.userChipText, { color: active ? '#fff' : theme.text }]} numberOfLines={1}>
                    {userName(item)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <ModalFooter theme={theme} saving={saving} onClose={onClose} onSubmit={onSubmit} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SectionModal({
  visible,
  theme,
  editing,
  title,
  setTitle,
  description,
  setDescription,
  icon,
  setIcon,
  order,
  setOrder,
  pinned,
  setPinned,
  saving,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  theme: any;
  editing: boolean;
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  setIcon: (value: keyof typeof Ionicons.glyphMap) => void;
  order: string;
  setOrder: (value: string) => void;
  pinned: boolean;
  setPinned: (value: boolean) => void;
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
          <Text style={[styles.modalTitle, { color: theme.text }]}>{editing ? 'Редактировать раздел' : 'Новый раздел'}</Text>
          <Pressable onPress={onClose} style={[styles.modalClose, { backgroundColor: theme.backgroundSoft }]}>
            <Ionicons name="close" size={20} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <InputBlock label="Название раздела" value={title} onChangeText={setTitle} theme={theme} />
          <InputBlock label="Описание" value={description} onChangeText={setDescription} theme={theme} multiline />
          <InputBlock label="Порядок" value={order} onChangeText={setOrder} theme={theme} keyboardType="numeric" />

          <Text style={[styles.formTitle, { color: theme.text }]}>Иконка</Text>
          <View style={styles.iconGrid}>
            {SECTION_ICONS.map((item) => {
              const active = icon === item;

              return (
                <Pressable
                  key={item}
                  onPress={() => setIcon(item)}
                  style={[
                    styles.iconOption,
                    {
                      backgroundColor: active ? theme.blue : theme.surface,
                      borderColor: active ? theme.blue : theme.border,
                    },
                  ]}
                >
                  <Ionicons name={item} size={22} color={active ? '#fff' : theme.textSecondary} />
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => setPinned(!pinned)}
            style={[styles.checkboxRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Ionicons
              name={pinned ? 'checkbox-outline' : 'square-outline'}
              size={22}
              color={pinned ? theme.blue : theme.textMuted}
            />
            <Text style={[styles.checkboxText, { color: theme.text }]}>Закрепить раздел сверху</Text>
          </Pressable>
        </ScrollView>

        <ModalFooter theme={theme} saving={saving} onClose={onClose} onSubmit={onSubmit} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PostModal({
  visible,
  theme,
  editing,
  title,
  setTitle,
  body,
  setBody,
  copyText,
  setCopyText,
  note,
  setNote,
  pinned,
  setPinned,
  saving,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  theme: any;
  editing: boolean;
  title: string;
  setTitle: (value: string) => void;
  body: string;
  setBody: (value: string) => void;
  copyText: string;
  setCopyText: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  pinned: boolean;
  setPinned: (value: boolean) => void;
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
          <Text style={[styles.modalTitle, { color: theme.text }]}>{editing ? 'Редактировать запись' : 'Новая запись'}</Text>
          <Pressable onPress={onClose} style={[styles.modalClose, { backgroundColor: theme.backgroundSoft }]}>
            <Ionicons name="close" size={20} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <InputBlock label="Заголовок" value={title} onChangeText={setTitle} theme={theme} />
          <InputBlock label="Основной текст" value={body} onChangeText={setBody} theme={theme} multiline />
          <InputBlock
            label="Текст для копирования"
            value={copyText}
            onChangeText={setCopyText}
            theme={theme}
            multiline
            placeholder="Если оставить пустым, будет копироваться основной текст."
          />
          <InputBlock label="Внутренняя заметка" value={note} onChangeText={setNote} theme={theme} multiline />

          <Pressable
            onPress={() => setPinned(!pinned)}
            style={[styles.checkboxRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Ionicons
              name={pinned ? 'checkbox-outline' : 'square-outline'}
              size={22}
              color={pinned ? theme.blue : theme.textMuted}
            />
            <Text style={[styles.checkboxText, { color: theme.text }]}>Закрепить запись сверху</Text>
          </Pressable>
        </ScrollView>

        <ModalFooter theme={theme} saving={saving} onClose={onClose} onSubmit={onSubmit} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ModalFooter({
  theme,
  saving,
  onClose,
  onSubmit,
}: {
  theme: any;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <View style={[styles.modalFooter, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable
        onPress={onClose}
        disabled={saving}
        style={[styles.secondaryBtn, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}
      >
        <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Отмена</Text>
      </Pressable>

      <Pressable
        onPress={onSubmit}
        disabled={saving}
        style={[styles.saveBtn, { backgroundColor: saving ? theme.textMuted : theme.blue }]}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Сохранить</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    paddingBottom: 120,
    gap: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 16,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 2,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  projectDescription: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  pillsRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    minHeight: 30,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  statsGrid: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    padding: 10,
  },
  statValue: {
    fontSize: 21,
    fontWeight: '900',
  },
  statLabel: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: '800',
  },
  progressTrack: {
    marginTop: 14,
    height: 9,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressText: {
    marginTop: 7,
    fontSize: 12,
    fontWeight: '800',
  },
  metaUser: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  avatar: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '900',
  },
  metaUserLabel: {
    fontSize: 10.5,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaUserName: {
    marginTop: 1,
    fontSize: 12.5,
    fontWeight: '800',
  },
  toolbar: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 12,
    gap: 10,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  searchBox: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  tabs: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '900',
  },
  addSectionBtn: {
    minHeight: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  addSectionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  taskBoard: {
    gap: 12,
  },
  taskColumn: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 12,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 10,
  },
  columnIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  emptyColumnText: {
    padding: 10,
    fontSize: 12.5,
    fontWeight: '700',
  },
  tasksList: {
    gap: 10,
  },
  taskCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 12,
  },
  taskTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  taskCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  taskTitle: {
    fontSize: 15.5,
    fontWeight: '900',
  },
  taskDescription: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  taskMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  smallPill: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallPillText: {
    fontSize: 11.5,
    fontWeight: '900',
  },
  statusActions: {
    marginTop: 10,
    gap: 7,
  },
  statusMini: {
    minHeight: 32,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusMiniText: {
    fontSize: 11.5,
    fontWeight: '900',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 22,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryWideBtn: {
    marginTop: 16,
    minHeight: 50,
    borderRadius: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryWideText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  sectionsList: {
    gap: 14,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 14,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  sectionTop: {
    flexDirection: 'row',
    gap: 12,
  },
  sectionIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
  },
  sectionDescription: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  sectionActions: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  smallActionBtn: {
    minHeight: 36,
    borderRadius: 14,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  smallActionTextWhite: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  smallActionText: {
    fontSize: 12,
    fontWeight: '900',
  },
  postsList: {
    marginTop: 12,
    gap: 10,
  },
  noPostsBox: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noPostsText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
  },
  postCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 13,
  },
  postTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postTitle: {
    flex: 1,
    fontSize: 15.5,
    fontWeight: '900',
  },
  postBody: {
    marginTop: 7,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 20,
  },
  copyBox: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  copyLabel: {
    fontSize: 10.5,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  copyText: {
    marginTop: 5,
    fontSize: 13.5,
    fontWeight: '800',
    lineHeight: 20,
  },
  noteBox: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    flexDirection: 'row',
    gap: 7,
  },
  noteText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '800',
    lineHeight: 18,
  },
  postActions: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  postActionBtn: {
    minHeight: 38,
    borderRadius: 15,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postActionTextWhite: {
    color: '#fff',
    fontSize: 12.5,
    fontWeight: '900',
  },
  postActionText: {
    fontSize: 12.5,
    fontWeight: '900',
  },
  modalRoot: {
    flex: 1,
  },
  modalHeader: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
  },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 16,
    paddingBottom: 140,
    gap: 12,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    marginTop: 5,
    minHeight: 36,
    fontSize: 15,
    fontWeight: '700',
  },
  textarea: {
    minHeight: 120,
    lineHeight: 21,
  },
  formTitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '900',
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: '900',
  },
  usersWrap: {
    gap: 8,
  },
  userChip: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  userChipText: {
    fontSize: 13,
    fontWeight: '900',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxRow: {
    borderWidth: 1,
    borderRadius: 20,
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  modalFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '900',
  },
  saveBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
});
