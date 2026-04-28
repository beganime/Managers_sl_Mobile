import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
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
import apiClient, {
  appendPreparedFile,
  buildAbsoluteFileUrl,
  fetchAllPages,
  multipartConfig,
  normalizeUploadFile,
} from '../../../src/api/apiClient';
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
type ProjectStatus = 'active' | 'paused' | 'done' | 'archived';

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

type ProjectAttachment = {
  id: number;
  title?: string;
  attachment_type: 'file' | 'image' | 'link';
  file?: string | null;
  file_url?: string | null;
  url?: string;
  note?: string;
  created_at?: string;
};

type Project = {
  id: number;
  title: string;
  description?: string;
  city?: string;
  office?: number | null;
  office_city?: string;
  status: ProjectStatus;
  deadline?: string | null;
  is_hidden?: boolean;
  is_pinned?: boolean;
  created_by?: number | null;
  created_by_data?: UserMini | null;
  participants?: number[];
  participants_data?: UserMini[];
  responsible_users?: number[];
  responsible_users_data?: UserMini[];
  items?: ProjectTask[];
  attachments?: ProjectAttachment[];
  created_at?: string;
  updated_at?: string;
  can_manage?: boolean;
};

type UploadFile = {
  uri: string;
  name: string;
  type: string;
};

const TASK_STATUSES: Array<{
  value: TaskStatus;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
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

const PROJECT_STATUSES: Array<{
  value: ProjectStatus;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { value: 'active', label: 'Активный', icon: 'radio-button-on-outline' },
  { value: 'paused', label: 'Пауза', icon: 'pause-circle-outline' },
  { value: 'done', label: 'Завершён', icon: 'checkmark-done-outline' },
  { value: 'archived', label: 'Архив', icon: 'archive-outline' },
];

const ATTACHMENT_TYPES: Array<{
  value: 'link' | 'image' | 'file';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { value: 'link', label: 'Ссылка', icon: 'link-outline' },
  { value: 'image', label: 'Фото', icon: 'image-outline' },
  { value: 'file', label: 'Файл', icon: 'document-outline' },
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

function statusLabel(status?: string) {
  if (status === 'active') return 'Активный';
  if (status === 'paused') return 'Пауза';
  if (status === 'done') return 'Завершён';
  if (status === 'archived') return 'Архив';
  return status || '—';
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

function projectStatusColor(status: string | undefined, theme: any) {
  if (status === 'active') return theme.blue;
  if (status === 'paused') return theme.warning || '#F59E0B';
  if (status === 'done') return theme.success || '#1AAE6F';
  if (status === 'archived') return theme.textMuted;
  return theme.textMuted;
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

function projectProgress(project?: Project | null) {
  const tasks = project?.items || [];
  const total = tasks.length;
  const done = tasks.filter((item) => item.status === 'done').length;
  const subtasks = tasks.reduce((sum, item) => sum + Number(item.subtasks_count || item.subtasks?.length || 0), 0);
  const percent = total > 0 ? Math.round((done / total) * 100) : project?.status === 'done' ? 100 : 0;

  return { total, done, subtasks, percent };
}

function canManageProject(project: Project | null, currentUserId?: number, isAdmin?: boolean) {
  if (!project) return false;
  if (project.can_manage) return true;
  if (isAdmin) return true;
  if (!currentUserId) return false;
  return Number(project.created_by) === Number(currentUserId);
}

function normalizeDeadline(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T23:59:00`;
  }

  return trimmed;
}

function cleanDescription(value?: string) {
  return String(value || '').replace(/[#*_`>-]/g, '').trim();
}

function fileNameFromPicker(asset: any) {
  return asset?.name || asset?.fileName || asset?.uri?.split('/')?.pop() || 'file';
}

function fileTypeFromPicker(asset: any, fallback = 'application/octet-stream') {
  return asset?.mimeType || asset?.type || fallback;
}

function attachmentIcon(type?: string): keyof typeof Ionicons.glyphMap {
  if (type === 'image') return 'image-outline';
  if (type === 'link') return 'link-outline';
  return 'document-outline';
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

function flattenAttachmentError(error: any) {
  const data = error?.response?.data;

  return (
    data?.detail ||
    data?.file?.[0] ||
    data?.url?.[0] ||
    data?.project?.[0] ||
    data?.attachment_type?.[0] ||
    'Не удалось добавить материал.'
  );
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

function AvatarStack({ users, theme }: { users?: UserMini[]; theme: any }) {
  const visible = (users || []).slice(0, 6);
  const extra = Math.max((users || []).length - visible.length, 0);

  if (!visible.length) {
    return (
      <View style={styles.avatarStack}>
        <View style={[styles.avatarMini, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
          <Ionicons name="person-outline" size={14} color={theme.textMuted} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.avatarStack}>
      {visible.map((item, index) => (
        <View
          key={item.id}
          style={[
            styles.avatarMini,
            {
              backgroundColor: index % 2 === 0 ? theme.blue : theme.success || '#1AAE6F',
              borderColor: theme.surface,
              marginLeft: index === 0 ? 0 : -8,
            },
          ]}
        >
          <Text style={styles.avatarMiniText}>{initials(item)}</Text>
        </View>
      ))}

      {extra > 0 && (
        <View
          style={[
            styles.avatarMini,
            {
              backgroundColor: theme.backgroundSoft,
              borderColor: theme.surface,
              marginLeft: -8,
            },
          ]}
        >
          <Text style={[styles.avatarExtraText, { color: theme.text }]}>+{extra}</Text>
        </View>
      )}
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
  const [users, setUsers] = useState<UserMini[]>([]);

  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);

  const [savingProject, setSavingProject] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [savingAttachment, setSavingAttachment] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editStatus, setEditStatus] = useState<ProjectStatus>('active');
  const [editParticipants, setEditParticipants] = useState<number[]>([]);
  const [editResponsibles, setEditResponsibles] = useState<number[]>([]);
  const [userSearch, setUserSearch] = useState('');

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskAssignedTo, setTaskAssignedTo] = useState<number | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('todo');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskDeadline, setTaskDeadline] = useState('');

  const [attachmentType, setAttachmentType] = useState<'link' | 'image' | 'file'>('link');
  const [attachmentTitle, setAttachmentTitle] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentNote, setAttachmentNote] = useState('');
  const [selectedFile, setSelectedFile] = useState<UploadFile | null>(null);

  const progress = useMemo(() => projectProgress(project), [project]);
  const canManage = useMemo(() => canManageProject(project, currentUserId, isAdmin), [project, currentUserId, isAdmin]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();

    if (!q) return users;

    return users.filter((item) => {
      return userName(item).toLowerCase().includes(q) || String(item.email || '').toLowerCase().includes(q);
    });
  }, [users, userSearch]);

  const taskGroups = useMemo(() => {
    const tasks = project?.items || [];

    return TASK_STATUSES.map((status) => ({
      ...status,
      items: tasks.filter((item) => item.status === status.value),
    }));
  }, [project?.items]);

  const load = useCallback(async () => {
    if (!projectId) return;

    try {
      const [projectRes, usersRes] = await Promise.allSettled([
        apiClient.get(`tasks/projects/${projectId}/`),
        fetchAllPages('users/users/?limit=100&offset=0'),
      ]);

      if (projectRes.status === 'fulfilled') {
        setProject(projectRes.value.data);
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

  const resetTask = () => {
    setTaskTitle('');
    setTaskDescription('');
    setTaskAssignedTo(null);
    setTaskStatus('todo');
    setTaskPriority('medium');
    setTaskDeadline('');
  };

  const resetAttachment = () => {
    setAttachmentType('link');
    setAttachmentTitle('');
    setAttachmentUrl('');
    setAttachmentNote('');
    setSelectedFile(null);
  };

  const openProjectEdit = () => {
    if (!project) return;

    setEditTitle(project.title || '');
    setEditDescription(project.description || '');
    setEditCity(project.city || project.office_city || '');
    setEditDeadline(project.deadline || '');
    setEditStatus(project.status || 'active');
    setEditParticipants(
      project.participants?.length
        ? project.participants.map(Number)
        : project.participants_data?.map((item) => Number(item.id)) || []
    );
    setEditResponsibles(
      project.responsible_users?.length
        ? project.responsible_users.map(Number)
        : project.responsible_users_data?.map((item) => Number(item.id)) || []
    );
    setUserSearch('');
    setEditProjectOpen(true);
  };

  const toggleId = (id: number, list: number[], setter: (value: number[]) => void) => {
    setter(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  };

  const saveProject = async () => {
    if (!project) return;

    if (!editTitle.trim()) {
      Alert.alert('Ошибка', 'Название проекта не может быть пустым.');
      return;
    }

    const participants = Array.from(
      new Set([
        ...editParticipants,
        ...(currentUserId ? [currentUserId] : []),
        ...editResponsibles,
      ])
    );

    setSavingProject(true);

    try {
      await apiClient.patch(`tasks/projects/${project.id}/`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        city: editCity.trim(),
        status: editStatus,
        deadline: normalizeDeadline(editDeadline),
        participants,
        responsible_users: editResponsibles,
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
      resetTask();
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
    } catch {
      Alert.alert('Ошибка', 'Не удалось обновить статус задачи.');
    }
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

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Нет доступа', 'Разреши приложению доступ к галерее.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
      selectionLimit: 1,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];

    setSelectedFile(
      normalizeUploadFile(
        {
          uri: asset.uri,
          name: asset.fileName || asset.uri.split('/').pop() || 'image.jpg',
          type: asset.mimeType || 'image/jpeg',
        },
        'image.jpg'
      )
    );
    setAttachmentType('image');
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];

    setSelectedFile(
      normalizeUploadFile(
        {
          uri: asset.uri,
          name: fileNameFromPicker(asset),
          type: fileTypeFromPicker(asset),
        },
        fileNameFromPicker(asset)
      )
    );
    setAttachmentType('file');
  };

  const createAttachment = async () => {
    if (attachmentType === 'link' && !attachmentUrl.trim()) {
      Alert.alert('Ошибка', 'Укажи ссылку.');
      return;
    }

    if ((attachmentType === 'image' || attachmentType === 'file') && !selectedFile?.uri) {
      Alert.alert('Ошибка', 'Выбери файл или фото.');
      return;
    }

    setSavingAttachment(true);

    try {
      const fd = new FormData();

      fd.append('project', String(projectId));
      fd.append('attachment_type', attachmentType);
      fd.append('title', attachmentTitle.trim());
      fd.append('note', attachmentNote.trim());

      if (attachmentType === 'link') {
        fd.append('url', attachmentUrl.trim());
      } else if (selectedFile) {
        await appendPreparedFile(
          fd,
          'file',
          selectedFile,
          attachmentType === 'image' ? 'image.jpg' : selectedFile.name || 'file'
        );
      }

      await apiClient.post('tasks/project-attachments/', fd, multipartConfig);

      setAttachmentModalOpen(false);
      resetAttachment();
      await load();
    } catch (error: any) {
      Alert.alert('Ошибка', String(flattenAttachmentError(error)));
    } finally {
      setSavingAttachment(false);
    }
  };

  const openAttachment = async (attachment: ProjectAttachment) => {
    const absoluteUrl = buildAbsoluteFileUrl(attachment.file_url || attachment.file || attachment.url);

    if (!absoluteUrl) {
      Alert.alert('Материал', 'У материала нет ссылки или файла.');
      return;
    }

    try {
      await WebBrowser.openBrowserAsync(absoluteUrl);
    } catch {
      Alert.alert('Ошибка', 'Не удалось открыть материал.');
    }
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

  if (!project) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Проект не найден</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            Возможно, у тебя нет доступа к этому проекту.
          </Text>
          <Pressable onPress={() => safeGoBack(router, '/(app)/projects')} style={[styles.backWideBtn, { backgroundColor: theme.blue }]}>
            <Text style={styles.backWideText}>Назад</Text>
          </Pressable>
        </View>
      </ScreenWrapper>
    );
  }

  const pColor = projectStatusColor(project.status, theme);
  const d = deadlineMeta(project.deadline);
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
              <Pressable onPress={() => safeGoBack(router, '/(app)/projects')} style={[styles.backBtn, { backgroundColor: theme.backgroundSoft }]}>
                <Ionicons name="arrow-back" size={21} color={theme.text} />
              </Pressable>

              <View style={{ flex: 1 }}>
                <Text style={[styles.kicker, { color: theme.textMuted }]}>PROJECT #{project.id}</Text>
                <Text style={[styles.title, { color: theme.text }]}>{project.title}</Text>
              </View>

              {canManage && (
                <Pressable onPress={openProjectEdit} style={[styles.editBtn, { backgroundColor: theme.blue }]}>
                  <Ionicons name="create-outline" size={17} color="#fff" />
                </Pressable>
              )}
            </View>

            <View style={styles.headerMetaRow}>
              <View style={[styles.metaPill, { backgroundColor: `${pColor}18`, borderColor: `${pColor}55` }]}>
                <Ionicons name="radio-button-on-outline" size={14} color={pColor} />
                <Text style={[styles.metaPillText, { color: pColor }]}>{statusLabel(project.status)}</Text>
              </View>

              <View style={[styles.metaPill, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Ionicons name="location-outline" size={14} color={theme.textMuted} />
                <Text style={[styles.metaPillText, { color: theme.textSecondary }]}>
                  {project.city || project.office_city || 'Без города'}
                </Text>
              </View>

              <View style={[styles.metaPill, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Ionicons name="time-outline" size={14} color={dColor} />
                <Text style={[styles.metaPillText, { color: dColor }]}>{d.label}</Text>
              </View>
            </View>

            <View style={[styles.progressPanel, { backgroundColor: theme.backgroundSoft }]}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressTitle, { color: theme.text }]}>Прогресс проекта</Text>
                <Text style={[styles.progressPercent, { color: theme.blue }]}>{progress.percent}%</Text>
              </View>

              <View style={[styles.progressTrack, { backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }]}>
                <View style={[styles.progressFill, { width: `${progress.percent}%`, backgroundColor: theme.blue }]} />
              </View>

              <View style={styles.progressStats}>
                <Text style={[styles.progressHint, { color: theme.textSecondary }]}>
                  {progress.done}/{progress.total} задач завершено
                </Text>
                <Text style={[styles.progressHint, { color: theme.textSecondary }]}>
                  {progress.subtasks} подзадач
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.quickActions}>
            <Pressable onPress={() => setTaskModalOpen(true)} style={[styles.quickBtn, { backgroundColor: theme.blue }]}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.quickBtnText}>Задача</Text>
            </Pressable>

            <Pressable onPress={() => setAttachmentModalOpen(true)} style={[styles.quickBtn, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
              <Ionicons name="attach-outline" size={18} color={theme.blue} />
              <Text style={[styles.quickBtnText, { color: theme.blue }]}>Материал</Text>
            </Pressable>
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: theme.blueSoft }]}>
                <Ionicons name="document-text-outline" size={18} color={theme.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Описание</Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>Контекст, цель и правила проекта</Text>
              </View>
            </View>

            {project.description ? (
              <Markdown style={markdownStyles(theme) as any}>{project.description}</Markdown>
            ) : (
              <Text style={[styles.emptySmall, { color: theme.textSecondary }]}>Описание не добавлено.</Text>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: theme.blueSoft }]}>
                <Ionicons name="people-outline" size={18} color={theme.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Команда</Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>Участники и ответственные</Text>
              </View>
            </View>

            <View style={styles.teamRow}>
              <AvatarStack users={project.participants_data} theme={theme} />
              <Text style={[styles.teamText, { color: theme.textSecondary }]}>
                Участников: {(project.participants_data || []).length}
              </Text>
            </View>

            <Text style={[styles.smallSectionTitle, { color: theme.text }]}>Ответственные</Text>

            <View style={styles.peopleWrap}>
              {(project.responsible_users_data || []).map((item) => (
                <View key={item.id} style={[styles.personChip, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                  <Text style={[styles.personChipText, { color: theme.text }]}>{userName(item)}</Text>
                </View>
              ))}

              {(project.responsible_users_data || []).length === 0 && (
                <Text style={[styles.emptySmall, { color: theme.textSecondary }]}>Ответственные не назначены.</Text>
              )}
            </View>
          </View>

          <View style={styles.sectionTitleLine}>
            <View>
              <Text style={[styles.bigTitle, { color: theme.text }]}>Задачи</Text>
              <Text style={[styles.bigSub, { color: theme.textSecondary }]}>Рабочий список задач проекта</Text>
            </View>

            <Pressable onPress={() => setTaskModalOpen(true)} style={[styles.smallAddBtn, { backgroundColor: theme.blueSoft }]}>
              <Ionicons name="add" size={18} color={theme.blue} />
            </Pressable>
          </View>

          <View style={[styles.tasksBoard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {taskGroups.map((group) => (
              <View key={group.value} style={styles.taskGroup}>
                <View style={styles.taskGroupHeader}>
                  <View style={[styles.taskGroupIcon, { backgroundColor: `${taskStatusColor(group.value, theme)}18` }]}>
                    <Ionicons name={group.icon} size={15} color={taskStatusColor(group.value, theme)} />
                  </View>
                  <Text style={[styles.taskGroupTitle, { color: theme.text }]}>{group.label}</Text>
                  <Text style={[styles.taskGroupCount, { color: theme.textMuted }]}>{group.items.length}</Text>
                </View>

                {group.items.length === 0 ? (
                  <View style={[styles.emptyTaskLine, { backgroundColor: theme.backgroundSoft }]}>
                    <Text style={[styles.emptySmall, { color: theme.textMuted }]}>Нет задач</Text>
                  </View>
                ) : (
                  group.items.map((task) => {
                    const sColor = taskStatusColor(task.status, theme);
                    const prColor = priorityColor(task.priority, theme);

                    return (
                      <Pressable
                        key={task.id}
                        onPress={() => openTask(task)}
                        style={[
                          styles.taskRow,
                          {
                            backgroundColor: theme.backgroundSoft,
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <View style={[styles.taskCheck, { borderColor: sColor, backgroundColor: task.status === 'done' ? sColor : 'transparent' }]}>
                          {task.status === 'done' && <Ionicons name="checkmark" size={12} color="#fff" />}
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={[styles.taskTitle, { color: theme.text }]} numberOfLines={2}>
                            {task.title}
                          </Text>

                          {!!cleanDescription(task.description) && (
                            <Text style={[styles.taskDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                              {cleanDescription(task.description)}
                            </Text>
                          )}

                          <View style={styles.taskMetaRow}>
                            <View style={[styles.taskPill, { backgroundColor: `${sColor}18` }]}>
                              <Text style={[styles.taskPillText, { color: sColor }]}>{taskStatusLabel(task.status)}</Text>
                            </View>

                            <View style={[styles.taskPill, { backgroundColor: `${prColor}18` }]}>
                              <Text style={[styles.taskPillText, { color: prColor }]}>{priorityLabel(task.priority)}</Text>
                            </View>

                            <View style={[styles.taskPill, { backgroundColor: theme.surface }]}>
                              <Ionicons name="folder-open-outline" size={12} color={theme.textMuted} />
                              <Text style={[styles.taskPillText, { color: theme.textSecondary }]}>
                                {task.subtasks_count || task.subtasks?.length || 0}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.taskRight}>
                          <Text style={[styles.taskAssignee, { color: theme.textSecondary }]} numberOfLines={1}>
                            {userName(task.assigned_to_data)}
                          </Text>
                          <Text style={[styles.taskDate, { color: theme.textMuted }]}>{formatDate(task.deadline)}</Text>

                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusMiniRow}>
                            {TASK_STATUSES.map((statusItem) => {
                              const active = task.status === statusItem.value;
                              const color = taskStatusColor(statusItem.value, theme);

                              return (
                                <Pressable
                                  key={statusItem.value}
                                  onPress={(event) => {
                                    event.stopPropagation();
                                    updateTaskStatus(task, statusItem.value);
                                  }}
                                  style={[
                                    styles.statusMini,
                                    {
                                      backgroundColor: active ? color : theme.surface,
                                      borderColor: active ? color : theme.border,
                                    },
                                  ]}
                                />
                              );
                            })}
                          </ScrollView>
                        </View>

                        <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
                      </Pressable>
                    );
                  })
                )}
              </View>
            ))}
          </View>

          <View style={styles.sectionTitleLine}>
            <View>
              <Text style={[styles.bigTitle, { color: theme.text }]}>Материалы</Text>
              <Text style={[styles.bigSub, { color: theme.textSecondary }]}>Файлы, фото и ссылки проекта</Text>
            </View>

            <Pressable onPress={() => setAttachmentModalOpen(true)} style={[styles.smallAddBtn, { backgroundColor: theme.blueSoft }]}>
              <Ionicons name="add" size={18} color={theme.blue} />
            </Pressable>
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
            {(project.attachments || []).length === 0 ? (
              <View style={styles.emptyMaterials}>
                <Ionicons name="attach-outline" size={32} color={theme.textMuted} />
                <Text style={[styles.emptySmall, { color: theme.textSecondary }]}>Материалы пока не добавлены.</Text>
              </View>
            ) : (
              (project.attachments || []).map((attachment) => (
                <Pressable
                  key={attachment.id}
                  onPress={() => openAttachment(attachment)}
                  style={[styles.attachmentCard, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}
                >
                  <View style={[styles.attachmentIcon, { backgroundColor: theme.blueSoft }]}>
                    <Ionicons name={attachmentIcon(attachment.attachment_type)} size={20} color={theme.blue} />
                  </View>

                  {attachment.attachment_type === 'image' && attachment.file_url ? (
                    <Image
                      source={{ uri: buildAbsoluteFileUrl(attachment.file_url) || attachment.file_url }}
                      style={styles.attachmentImage}
                      contentFit="cover"
                    />
                  ) : null}

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.attachmentTitle, { color: theme.text }]} numberOfLines={1}>
                      {attachment.title || attachment.url || 'Материал'}
                    </Text>

                    {!!attachment.note && (
                      <Text style={[styles.attachmentNote, { color: theme.textSecondary }]} numberOfLines={2}>
                        {attachment.note}
                      </Text>
                    )}
                  </View>

                  <Ionicons name="open-outline" size={18} color={theme.textMuted} />
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>

        <ProjectEditModal
          visible={editProjectOpen}
          theme={theme}
          dark={dark}
          users={filteredUsers}
          userSearch={userSearch}
          setUserSearch={setUserSearch}
          title={editTitle}
          setTitle={setEditTitle}
          description={editDescription}
          setDescription={setEditDescription}
          city={editCity}
          setCity={setEditCity}
          deadline={editDeadline}
          setDeadline={setEditDeadline}
          status={editStatus}
          setStatus={setEditStatus}
          participants={editParticipants}
          setParticipants={setEditParticipants}
          responsibles={editResponsibles}
          setResponsibles={setEditResponsibles}
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
          status={taskStatus}
          setStatus={setTaskStatus}
          priority={taskPriority}
          setPriority={setTaskPriority}
          deadline={taskDeadline}
          setDeadline={setTaskDeadline}
          saving={savingTask}
          onClose={() => setTaskModalOpen(false)}
          onSubmit={createTask}
        />

        <AttachmentModal
          visible={attachmentModalOpen}
          theme={theme}
          dark={dark}
          attachmentType={attachmentType}
          setAttachmentType={setAttachmentType}
          title={attachmentTitle}
          setTitle={setAttachmentTitle}
          url={attachmentUrl}
          setUrl={setAttachmentUrl}
          note={attachmentNote}
          setNote={setAttachmentNote}
          selectedFile={selectedFile}
          pickImage={pickImage}
          pickFile={pickFile}
          saving={savingAttachment}
          onClose={() => setAttachmentModalOpen(false)}
          onSubmit={createAttachment}
        />
      </View>
    </ScreenWrapper>
  );
}

function ProjectEditModal({
  visible,
  theme,
  dark,
  users,
  userSearch,
  setUserSearch,
  title,
  setTitle,
  description,
  setDescription,
  city,
  setCity,
  deadline,
  setDeadline,
  status,
  setStatus,
  participants,
  setParticipants,
  responsibles,
  setResponsibles,
  saving,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  theme: any;
  dark: boolean;
  users: UserMini[];
  userSearch: string;
  setUserSearch: (value: string) => void;
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  city: string;
  setCity: (value: string) => void;
  deadline: string;
  setDeadline: (value: string) => void;
  status: ProjectStatus;
  setStatus: (value: ProjectStatus) => void;
  participants: number[];
  setParticipants: (value: number[]) => void;
  responsibles: number[];
  setResponsibles: (value: number[]) => void;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const toggle = (id: number, list: number[], setter: (value: number[]) => void) => {
    setter(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.modalRoot, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalHeader, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.modalIcon, { backgroundColor: theme.blueSoft }]}>
            <Ionicons name="create-outline" size={22} color={theme.blue} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Редактировать проект</Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>Описание, статус, участники и ответственные</Text>
          </View>

          <Pressable onPress={onClose} style={[styles.modalClose, { backgroundColor: theme.backgroundSoft }]}>
            <Ionicons name="close" size={20} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
          <View style={[styles.inputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Название проекта</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Название проекта"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text }]}
            />
          </View>

          <View style={[styles.inputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Описание</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Цели, план, ссылки, важные детали..."
              placeholderTextColor={theme.textMuted}
              style={[styles.input, styles.textarea, { color: theme.text }]}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.twoInputs}>
            <View style={[styles.inputWrap, styles.halfInput, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Город</Text>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="Ашхабад"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text }]}
              />
            </View>

            <View style={[styles.inputWrap, styles.halfInput, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
          </View>

          <Text style={[styles.formSectionTitle, { color: theme.text }]}>Статус</Text>
          <View style={styles.optionsWrap}>
            {PROJECT_STATUSES.map((item) => {
              const active = status === item.value;
              const color = projectStatusColor(item.value, theme);

              return (
                <Pressable
                  key={item.value}
                  onPress={() => setStatus(item.value)}
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

          <Text style={[styles.formSectionTitle, { color: theme.text }]}>Поиск сотрудников</Text>
          <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="search-outline" size={18} color={theme.textMuted} />
            <TextInput
              value={userSearch}
              onChangeText={setUserSearch}
              placeholder="Имя или email"
              placeholderTextColor={theme.textMuted}
              style={[styles.searchInput, { color: theme.text }]}
            />
            {!!userSearch && (
              <Pressable onPress={() => setUserSearch('')}>
                <Ionicons name="close-circle" size={18} color={theme.textMuted} />
              </Pressable>
            )}
          </View>

          <Text style={[styles.formSectionTitle, { color: theme.text }]}>Участники</Text>
          <View style={styles.peopleWrap}>
            {users.map((item) => {
              const active = participants.includes(item.id);

              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggle(item.id, participants, setParticipants)}
                  style={[
                    styles.personChip,
                    {
                      backgroundColor: active ? theme.blue : theme.surface,
                      borderColor: active ? theme.blue : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.personChipText, { color: active ? '#fff' : theme.text }]}>{userName(item)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.formSectionTitle, { color: theme.text }]}>Ответственные</Text>
          <View style={styles.peopleWrap}>
            {users.map((item) => {
              const active = responsibles.includes(item.id);

              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggle(item.id, responsibles, setResponsibles)}
                  style={[
                    styles.personChip,
                    {
                      backgroundColor: active ? theme.blue : theme.surface,
                      borderColor: active ? theme.blue : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.personChipText, { color: active ? '#fff' : theme.text }]}>{userName(item)}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.noticeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="information-circle-outline" size={18} color={theme.blue} />
            <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
              Ответственные автоматически получают доступ к проекту. Создателя нельзя убрать из участников.
            </Text>
          </View>

          <Pressable onPress={onSubmit} disabled={saving} style={[styles.saveBtn, { backgroundColor: theme.blue, opacity: saving ? 0.65 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
            <Text style={styles.saveText}>{saving ? 'Сохранение...' : 'Сохранить изменения'}</Text>
          </Pressable>
        </ScrollView>
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
  status,
  setStatus,
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
  status: TaskStatus;
  setStatus: (value: TaskStatus) => void;
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
            <Ionicons name="checkbox-outline" size={22} color={theme.blue} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Новая задача</Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>Создай задачу внутри проекта</Text>
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
              placeholder="Описание задачи"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, styles.textarea, { color: theme.text }]}
              multiline
              textAlignVertical="top"
            />
          </View>

          <Text style={[styles.formSectionTitle, { color: theme.text }]}>Ответственный</Text>
          <View style={styles.peopleWrap}>
            <Pressable
              onPress={() => setAssignedTo(null)}
              style={[
                styles.personChip,
                {
                  backgroundColor: assignedTo === null ? theme.blue : theme.surface,
                  borderColor: assignedTo === null ? theme.blue : theme.border,
                },
              ]}
            >
              <Text style={[styles.personChipText, { color: assignedTo === null ? '#fff' : theme.text }]}>Не назначен</Text>
            </Pressable>

            {users.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setAssignedTo(item.id)}
                style={[
                  styles.personChip,
                  {
                    backgroundColor: assignedTo === item.id ? theme.blue : theme.surface,
                    borderColor: assignedTo === item.id ? theme.blue : theme.border,
                  },
                ]}
              >
                <Text style={[styles.personChipText, { color: assignedTo === item.id ? '#fff' : theme.text }]}>{userName(item)}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.formSectionTitle, { color: theme.text }]}>Статус</Text>
          <View style={styles.optionsWrap}>
            {TASK_STATUSES.map((item) => {
              const active = status === item.value;
              const color = taskStatusColor(item.value, theme);

              return (
                <Pressable
                  key={item.value}
                  onPress={() => setStatus(item.value)}
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

          <Pressable onPress={onSubmit} disabled={saving} style={[styles.saveBtn, { backgroundColor: theme.blue, opacity: saving ? 0.65 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
            <Text style={styles.saveText}>{saving ? 'Сохранение...' : 'Создать задачу'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AttachmentModal({
  visible,
  theme,
  dark,
  attachmentType,
  setAttachmentType,
  title,
  setTitle,
  url,
  setUrl,
  note,
  setNote,
  selectedFile,
  pickImage,
  pickFile,
  saving,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  theme: any;
  dark: boolean;
  attachmentType: 'link' | 'image' | 'file';
  setAttachmentType: (value: 'link' | 'image' | 'file') => void;
  title: string;
  setTitle: (value: string) => void;
  url: string;
  setUrl: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  selectedFile: UploadFile | null;
  pickImage: () => void;
  pickFile: () => void;
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
            <Ionicons name="attach-outline" size={22} color={theme.blue} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Материал проекта</Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>Ссылка, фото или файл</Text>
          </View>

          <Pressable onPress={onClose} style={[styles.modalClose, { backgroundColor: theme.backgroundSoft }]}>
            <Ionicons name="close" size={20} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
          <Text style={[styles.formSectionTitle, { color: theme.text }]}>Тип материала</Text>
          <View style={styles.optionsWrap}>
            {ATTACHMENT_TYPES.map((item) => {
              const active = attachmentType === item.value;

              return (
                <Pressable
                  key={item.value}
                  onPress={() => setAttachmentType(item.value)}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: active ? theme.blue : theme.surface,
                      borderColor: active ? theme.blue : theme.border,
                    },
                  ]}
                >
                  <Ionicons name={item.icon} size={15} color={active ? '#fff' : theme.blue} />
                  <Text style={[styles.optionText, { color: active ? '#fff' : theme.text }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.inputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Название</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Например: ТЗ, скрин, ссылка на макет"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text }]}
            />
          </View>

          {attachmentType === 'link' ? (
            <View style={[styles.inputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Ссылка</Text>
              <TextInput
                value={url}
                onChangeText={setUrl}
                placeholder="https://..."
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text }]}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          ) : (
            <>
              <View style={styles.fileButtons}>
                <Pressable onPress={pickImage} style={[styles.fileBtn, { backgroundColor: theme.blueSoft }]}>
                  <Ionicons name="image-outline" size={18} color={theme.blue} />
                  <Text style={[styles.fileBtnText, { color: theme.blue }]}>Фото</Text>
                </Pressable>

                <Pressable onPress={pickFile} style={[styles.fileBtn, { backgroundColor: theme.blueSoft }]}>
                  <Ionicons name="document-outline" size={18} color={theme.blue} />
                  <Text style={[styles.fileBtnText, { color: theme.blue }]}>Файл</Text>
                </Pressable>
              </View>

              {selectedFile?.uri && (
                <View style={[styles.selectedFileBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons name={attachmentType === 'image' ? 'image-outline' : 'document-outline'} size={18} color={theme.blue} />
                  <Text style={[styles.selectedFileText, { color: theme.text }]} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                </View>
              )}

              {attachmentType === 'image' && selectedFile?.uri ? (
                <Image source={{ uri: selectedFile.uri }} style={styles.selectedPreviewImage} contentFit="cover" />
              ) : null}
            </>
          )}

          <View style={[styles.inputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Комментарий</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Короткое описание материала"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, styles.smallTextarea, { color: theme.text }]}
              multiline
              textAlignVertical="top"
            />
          </View>

          <Pressable onPress={onSubmit} disabled={saving} style={[styles.saveBtn, { backgroundColor: theme.blue, opacity: saving ? 0.65 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="cloud-upload-outline" size={18} color="#fff" />}
            <Text style={styles.saveText}>{saving ? 'Загрузка...' : 'Добавить материал'}</Text>
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
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.5,
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
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamText: {
    fontSize: 13,
    fontWeight: '800',
  },
  smallSectionTitle: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '900',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarMini: {
    width: 32,
    height: 32,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  avatarExtraText: {
    fontSize: 10,
    fontWeight: '900',
  },
  peopleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  personChip: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personChipText: {
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
  },
  smallAddBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tasksBoard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 12,
    gap: 12,
  },
  taskGroup: {
    gap: 8,
  },
  taskGroupHeader: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskGroupIcon: {
    width: 30,
    height: 30,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskGroupTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  taskGroupCount: {
    fontSize: 12,
    fontWeight: '900',
  },
  emptyTaskLine: {
    minHeight: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskRow: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  taskCheck: {
    marginTop: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    lineHeight: 19,
  },
  taskDescription: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  taskMetaRow: {
    marginTop: 9,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  taskPill: {
    minHeight: 26,
    borderRadius: 999,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskPillText: {
    fontSize: 10.5,
    fontWeight: '900',
  },
  taskRight: {
    width: 86,
    alignItems: 'flex-end',
    gap: 4,
  },
  taskAssignee: {
    maxWidth: 86,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },
  taskDate: {
    fontSize: 10.5,
    fontWeight: '800',
    textAlign: 'right',
  },
  statusMiniRow: {
    marginTop: 3,
    gap: 4,
  },
  statusMini: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  emptyMaterials: {
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  attachmentCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 9,
  },
  attachmentIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentImage: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  attachmentTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  attachmentNote: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'center',
  },
  emptySmall: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
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
  smallTextarea: {
    minHeight: 86,
    lineHeight: 20,
  },
  twoInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  halfInput: {
    flex: 1,
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
  searchBox: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  noticeCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  fileButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  fileBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 17,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileBtnText: {
    fontSize: 13,
    fontWeight: '900',
  },
  selectedFileBox: {
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedFileText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  selectedPreviewImage: {
    width: '100%',
    height: 170,
    borderRadius: 20,
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