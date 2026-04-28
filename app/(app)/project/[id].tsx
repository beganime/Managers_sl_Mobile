import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
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
};

type Project = {
  id: number;
  title: string;
  description?: string;
  city?: string;
  office_city?: string;
  status: string;
  deadline?: string | null;
  participants_data?: UserMini[];
  responsible_users_data?: UserMini[];
  items?: ProjectTask[];
  attachments?: ProjectAttachment[];
};

type UploadFile = { uri: string; name: string; type: string };

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

const ATTACHMENT_TYPES: Array<{ value: 'link' | 'image' | 'file'; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'link', label: 'Ссылка', icon: 'link-outline' },
  { value: 'image', label: 'Фото', icon: 'image-outline' },
  { value: 'file', label: 'Файл', icon: 'document-outline' },
];

function userName(user?: UserMini | null) {
  if (!user) return 'Не назначен';
  return user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email;
}

function initials(user?: UserMini | null) {
  const parts = userName(user).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return 'Без дедлайна';
  try {
    return new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return value;
  }
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

function priorityLabel(priority?: string) {
  if (priority === 'low') return 'Низкий';
  if (priority === 'medium') return 'Средний';
  if (priority === 'high') return 'Высокий';
  return priority || '—';
}

function attachmentIcon(type?: string): keyof typeof Ionicons.glyphMap {
  if (type === 'image') return 'image-outline';
  if (type === 'link') return 'link-outline';
  return 'document-outline';
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

function fileNameFromPicker(asset: any) {
  return asset?.name || asset?.fileName || asset?.uri?.split('/')?.pop() || 'file';
}

function fileTypeFromPicker(asset: any, fallback = 'application/octet-stream') {
  return asset?.mimeType || asset?.type || fallback;
}

function flattenTaskError(error: any) {
  const data = error?.response?.data;
  return data?.detail || data?.title?.[0] || data?.parent?.[0] || data?.project?.[0] || data?.deadline?.[0] || 'Не удалось сохранить задачу.';
}

function flattenAttachmentError(error: any) {
  const data = error?.response?.data;
  return data?.detail || data?.file?.[0] || data?.url?.[0] || data?.project?.[0] || 'Не удалось добавить материал.';
}

function taskProgress(project?: Project | null) {
  const items = project?.items || [];
  const total = items.length;
  const done = items.filter((item) => item.status === 'done').length;
  const subtasks = items.reduce((sum, item) => sum + Number(item.subtasks_count || item.subtasks?.length || 0), 0);
  const percent = total > 0 ? Math.round((done / total) * 100) : project?.status === 'done' ? 100 : 0;
  return { total, done, subtasks, percent };
}

function AvatarStack({ users, theme }: { users?: UserMini[]; theme: any }) {
  const visible = (users || []).slice(0, 5);
  if (!visible.length) {
    return (
      <View style={[styles.avatarMini, { backgroundColor: theme.backgroundSoft, borderColor: theme.surface }]}>
        <Ionicons name="person-outline" size={14} color={theme.textMuted} />
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
    </View>
  );
}

export default function ProjectDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { theme, themeMode } = useTheme();

  const projectId = Number(params.id);
  const dark = themeMode === 'dark';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [users, setUsers] = useState<UserMini[]>([]);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [savingAttachment, setSavingAttachment] = useState(false);

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

  const progress = useMemo(() => taskProgress(project), [project]);
  const tasksByStatus = useMemo(() => {
    const items = project?.items || [];
    return TASK_STATUSES.map((status) => ({ ...status, items: items.filter((item) => item.status === status.value) }));
  }, [project?.items]);

  const load = async () => {
    if (!projectId) return;

    try {
      const [projectRes, usersRes] = await Promise.allSettled([
        apiClient.get(`tasks/projects/${projectId}/`),
        fetchAllPages('users/users/?limit=100&offset=0'),
      ]);

      if (projectRes.status === 'fulfilled') setProject(projectRes.value.data);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value as UserMini[]);
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить проект.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [projectId]);

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
        deadline: taskDeadline.trim() || null,
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
    router.push({ pathname: '/(app)/task/[id]', params: { id: String(task.id), projectId: String(projectId) } } as any);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Нет доступа', 'Разреши приложению доступ к галерее.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.85, selectionLimit: 1 });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setSelectedFile(
      normalizeUploadFile(
        { uri: asset.uri, name: asset.fileName || asset.uri.split('/').pop() || 'image.jpg', type: asset.mimeType || 'image/jpeg' },
        'image.jpg'
      )
    );
    setAttachmentType('image');
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setSelectedFile(normalizeUploadFile({ uri: asset.uri, name: fileNameFromPicker(asset), type: fileTypeFromPicker(asset) }, fileNameFromPicker(asset)));
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
        await appendPreparedFile(fd, 'file', selectedFile, attachmentType === 'image' ? 'image.jpg' : selectedFile.name || 'file');
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
          <Pressable onPress={() => safeGoBack(router, '/(app)/projects')} style={[styles.backWideBtn, { backgroundColor: theme.blue }]}>
            <Text style={styles.backWideText}>Назад</Text>
          </Pressable>
        </View>
      </ScreenWrapper>
    );
  }

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
            <Pressable onPress={() => safeGoBack(router, '/(app)/projects')} style={styles.heroBackBtn}>
              <Ionicons name="arrow-back" size={21} color="#fff" />
            </Pressable>

            <View style={styles.heroActions}>
              <Pressable onPress={() => setTaskModalOpen(true)} style={styles.heroActionBtn}>
                <Ionicons name="checkbox-outline" size={17} color="#fff" />
                <Text style={styles.heroActionText}>Задача</Text>
              </Pressable>

              <Pressable onPress={() => setAttachmentModalOpen(true)} style={styles.heroIconBtn}>
                <Ionicons name="attach-outline" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>

          <Text style={styles.heroKicker}>{project.city || project.office_city || 'Проект'}</Text>
          <Text style={styles.heroTitle}>{project.title}</Text>
          <Text style={styles.heroSubtitle}>Дедлайн: {formatDate(project.deadline)}</Text>

          <View style={styles.heroProgressBox}>
            <View style={styles.heroProgressTop}>
              <Text style={styles.heroProgressLabel}>Общий прогресс</Text>
              <Text style={styles.heroProgressPercent}>{progress.percent}%</Text>
            </View>

            <View style={styles.heroProgressTrack}>
              <View style={[styles.heroProgressFill, { width: `${progress.percent}%` }]} />
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{progress.total}</Text>
                <Text style={styles.heroStatLabel}>Задач</Text>
              </View>
              <View style={styles.heroLine} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{progress.subtasks}</Text>
                <Text style={styles.heroStatLabel}>Подзадач</Text>
              </View>
              <View style={styles.heroLine} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{progress.done}</Text>
                <Text style={styles.heroStatLabel}>Готово</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.cardIcon, { backgroundColor: theme.blueSoft }]}>
              <Ionicons name="document-text-outline" size={19} color={theme.blue} />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Описание</Text>
          </View>

          {project.description ? (
            <Markdown style={markdownStyles(theme) as any}>{project.description}</Markdown>
          ) : (
            <Text style={[styles.emptySmall, { color: theme.textSecondary }]}>Описание не добавлено.</Text>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.cardIcon, { backgroundColor: theme.blueSoft }]}>
              <Ionicons name="people-outline" size={19} color={theme.blue} />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Команда проекта</Text>
          </View>

          <View style={styles.teamHeader}>
            <AvatarStack users={project.participants_data} theme={theme} />
            <Text style={[styles.teamCount, { color: theme.textSecondary }]}>Участников: {(project.participants_data || []).length}</Text>
          </View>

          <Text style={[styles.subSectionTitle, { color: theme.text }]}>Ответственные</Text>
          <View style={styles.peopleWrap}>
            {(project.responsible_users_data || []).map((item) => (
              <View key={item.id} style={[styles.personPill, { backgroundColor: theme.blueSoft, borderColor: theme.border }]}>
                <Text style={[styles.personText, { color: theme.blue }]}>{userName(item)}</Text>
              </View>
            ))}

            {(project.responsible_users_data || []).length === 0 && (
              <Text style={[styles.emptySmall, { color: theme.textSecondary }]}>Ответственные не назначены.</Text>
            )}
          </View>
        </View>

        <View style={styles.quickActions}>
          <Pressable onPress={() => setTaskModalOpen(true)} style={[styles.quickActionBtn, { backgroundColor: theme.blue }]}>
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.quickActionText}>Добавить задачу</Text>
          </Pressable>

          <Pressable onPress={() => setAttachmentModalOpen(true)} style={[styles.quickActionBtn, { backgroundColor: theme.success || '#1AAE6F' }]}>
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            <Text style={styles.quickActionText}>Материал</Text>
          </Pressable>
        </View>

        <Text style={[styles.bigSectionTitle, { color: theme.text }]}>Задачи проекта</Text>
        <Text style={[styles.bigSectionSub, { color: theme.textSecondary }]}>Нажми на задачу, чтобы открыть её как папку с подзадачами.</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kanbanScroll}>
          {tasksByStatus.map((column) => (
            <View key={column.value} style={[styles.kanbanColumn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.columnHeader}>
                <View style={[styles.columnIcon, { backgroundColor: theme.blueSoft }]}>
                  <Ionicons name={column.icon} size={16} color={theme.blue} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.columnTitle, { color: theme.text }]}>{column.label}</Text>
                  <Text style={[styles.columnCount, { color: theme.textSecondary }]}>{column.items.length} задач</Text>
                </View>
              </View>

              {column.items.length === 0 ? (
                <View style={[styles.emptyColumn, { backgroundColor: theme.backgroundSoft }]}>
                  <Text style={[styles.emptySmall, { color: theme.textSecondary }]}>Пусто</Text>
                </View>
              ) : (
                column.items.map((task) => {
                  const pColor = priorityColor(task.priority, theme);
                  const sColor = statusColor(task.status, theme);

                  return (
                    <Pressable
                      key={task.id}
                      onPress={() => openTask(task)}
                      style={[styles.taskCard, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}
                    >
                      <View style={styles.taskTop}>
                        <Text style={[styles.taskTitle, { color: theme.text }]}>{task.title}</Text>
                        <View style={[styles.priorityDot, { backgroundColor: pColor }]} />
                      </View>

                      {!!task.description && (
                        <View style={styles.taskDescription}>
                          <Markdown style={markdownStyles(theme) as any}>
                            {task.description.length > 130 ? `${task.description.slice(0, 130)}...` : task.description}
                          </Markdown>
                        </View>
                      )}

                      <View style={styles.taskMetaBox}>
                        <View style={styles.taskMetaRow}>
                          <Ionicons name="person-outline" size={13} color={theme.textMuted} />
                          <Text style={[styles.taskMeta, { color: theme.textSecondary }]} numberOfLines={1}>{userName(task.assigned_to_data)}</Text>
                        </View>

                        <View style={styles.taskMetaRow}>
                          <Ionicons name="folder-open-outline" size={13} color={theme.textMuted} />
                          <Text style={[styles.taskMeta, { color: theme.textSecondary }]}>{task.subtasks_count || task.subtasks?.length || 0} подзадач</Text>
                        </View>

                        <View style={styles.taskMetaRow}>
                          <Ionicons name="flag-outline" size={13} color={pColor} />
                          <Text style={[styles.taskMeta, { color: pColor }]}>{priorityLabel(task.priority)}</Text>
                        </View>
                      </View>

                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.taskStatusRow}>
                        {TASK_STATUSES.map((statusItem) => {
                          const active = task.status === statusItem.value;

                          return (
                            <Pressable
                              key={statusItem.value}
                              onPress={(event) => {
                                event.stopPropagation();
                                updateTaskStatus(task, statusItem.value);
                              }}
                              style={[
                                styles.statusPill,
                                {
                                  backgroundColor: active ? sColor : theme.surface,
                                  borderColor: active ? sColor : theme.border,
                                },
                              ]}
                            >
                              <Text style={[styles.statusText, { color: active ? '#fff' : theme.text }]}>{statusItem.label}</Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>

                      <View style={[styles.openTaskBtn, { backgroundColor: theme.blueSoft, borderColor: theme.border }]}>
                        <Ionicons name="folder-open-outline" size={15} color={theme.blue} />
                        <Text style={[styles.openTaskBtnText, { color: theme.blue }]}>Открыть задачу</Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.materialHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bigSectionTitle, { color: theme.text }]}>Файлы, фото и ссылки</Text>
            <Text style={[styles.bigSectionSub, { color: theme.textSecondary }]}>Материалы проекта открываются во встроенном браузере.</Text>
          </View>

          <Pressable onPress={() => setAttachmentModalOpen(true)} style={[styles.smallAddBtn, { backgroundColor: theme.blueSoft }]}>
            <Ionicons name="add" size={18} color={theme.blue} />
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
          {(project.attachments || []).length === 0 ? (
            <View style={styles.emptyMaterials}>
              <Ionicons name="attach-outline" size={34} color={theme.textMuted} />
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
                  <Image source={{ uri: buildAbsoluteFileUrl(attachment.file_url) || attachment.file_url }} style={styles.attachmentImage} contentFit="cover" />
                ) : null}

                <View style={{ flex: 1 }}>
                  <Text style={[styles.attachmentTitle, { color: theme.text }]} numberOfLines={1}>{attachment.title || attachment.url || 'Материал'}</Text>
                  {!!attachment.note && <Text style={[styles.attachmentNote, { color: theme.textSecondary }]} numberOfLines={2}>{attachment.note}</Text>}
                </View>

                <Ionicons name="open-outline" size={18} color={theme.textMuted} />
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={taskModalOpen} animationType="slide" transparent onRequestClose={() => setTaskModalOpen(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Новая задача</Text>
                <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>Подзадачи создаются внутри страницы конкретной задачи</Text>
              </View>
              <Pressable onPress={() => setTaskModalOpen(false)} style={[styles.modalClose, { backgroundColor: theme.backgroundSoft }]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Название</Text>
                <TextInput value={taskTitle} onChangeText={setTaskTitle} placeholder="Название задачи" placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} />
              </View>

              <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Описание Markdown</Text>
                <TextInput value={taskDescription} onChangeText={setTaskDescription} placeholder={'Описание задачи\n- пункт\n**важное**'} placeholderTextColor={theme.textMuted} style={[styles.input, styles.textarea, { color: theme.text }]} multiline textAlignVertical="top" />
              </View>

              <Text style={[styles.peopleTitle, { color: theme.text }]}>Ответственный</Text>
              <View style={styles.peopleWrap}>
                <Pressable onPress={() => setTaskAssignedTo(null)} style={[styles.personPill, { backgroundColor: taskAssignedTo === null ? theme.blue : theme.backgroundSoft, borderColor: taskAssignedTo === null ? theme.blue : theme.border }]}>
                  <Text style={[styles.personText, { color: taskAssignedTo === null ? '#fff' : theme.text }]}>Не назначен</Text>
                </Pressable>
                {users.map((item) => (
                  <Pressable key={item.id} onPress={() => setTaskAssignedTo(item.id)} style={[styles.personPill, { backgroundColor: taskAssignedTo === item.id ? theme.blue : theme.backgroundSoft, borderColor: taskAssignedTo === item.id ? theme.blue : theme.border }]}>
                    <Text style={[styles.personText, { color: taskAssignedTo === item.id ? '#fff' : theme.text }]}>{userName(item)}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.peopleTitle, { color: theme.text }]}>Статус</Text>
              <View style={styles.peopleWrap}>
                {TASK_STATUSES.map((item) => (
                  <Pressable key={item.value} onPress={() => setTaskStatus(item.value)} style={[styles.personPill, { backgroundColor: taskStatus === item.value ? theme.blue : theme.backgroundSoft, borderColor: taskStatus === item.value ? theme.blue : theme.border }]}>
                    <Text style={[styles.personText, { color: taskStatus === item.value ? '#fff' : theme.text }]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.peopleTitle, { color: theme.text }]}>Приоритет</Text>
              <View style={styles.peopleWrap}>
                {PRIORITIES.map((item) => (
                  <Pressable key={item.value} onPress={() => setTaskPriority(item.value)} style={[styles.personPill, { backgroundColor: taskPriority === item.value ? theme.blue : theme.backgroundSoft, borderColor: taskPriority === item.value ? theme.blue : theme.border }]}>
                    <Text style={[styles.personText, { color: taskPriority === item.value ? '#fff' : theme.text }]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Дедлайн</Text>
                <TextInput value={taskDeadline} onChangeText={setTaskDeadline} placeholder="2026-05-20 или 2026-05-20T18:00:00" placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} autoCapitalize="none" />
              </View>

              <Pressable onPress={createTask} disabled={savingTask} style={[styles.saveBtn, { backgroundColor: theme.blue, opacity: savingTask ? 0.65 : 1 }]}>
                {savingTask ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
                <Text style={styles.saveText}>{savingTask ? 'Сохранение...' : 'Сохранить задачу'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={attachmentModalOpen} animationType="slide" transparent onRequestClose={() => setAttachmentModalOpen(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Материал проекта</Text>
                <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>Добавь ссылку, фото или файл внутрь проекта</Text>
              </View>
              <Pressable onPress={() => setAttachmentModalOpen(false)} style={[styles.modalClose, { backgroundColor: theme.backgroundSoft }]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <Text style={[styles.peopleTitle, { color: theme.text }]}>Тип материала</Text>
              <View style={styles.peopleWrap}>
                {ATTACHMENT_TYPES.map((item) => {
                  const active = attachmentType === item.value;
                  return (
                    <Pressable key={item.value} onPress={() => setAttachmentType(item.value)} style={[styles.personPill, { backgroundColor: active ? theme.blue : theme.backgroundSoft, borderColor: active ? theme.blue : theme.border }]}>
                      <Ionicons name={item.icon} size={15} color={active ? '#fff' : theme.blue} />
                      <Text style={[styles.personText, { color: active ? '#fff' : theme.text }]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Название</Text>
                <TextInput value={attachmentTitle} onChangeText={setAttachmentTitle} placeholder="Например: ТЗ, скрин, ссылка на макет" placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} />
              </View>

              {attachmentType === 'link' ? (
                <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Ссылка</Text>
                  <TextInput value={attachmentUrl} onChangeText={setAttachmentUrl} placeholder="https://..." placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} autoCapitalize="none" keyboardType="url" />
                </View>
              ) : (
                <>
                  <View style={styles.attachChoiceRow}>
                    <Pressable onPress={pickImage} style={[styles.attachChoiceBtn, { backgroundColor: theme.blueSoft }]}>
                      <Ionicons name="image-outline" size={18} color={theme.blue} />
                      <Text style={[styles.attachChoiceText, { color: theme.blue }]}>Фото</Text>
                    </Pressable>
                    <Pressable onPress={pickFile} style={[styles.attachChoiceBtn, { backgroundColor: theme.blueSoft }]}>
                      <Ionicons name="document-outline" size={18} color={theme.blue} />
                      <Text style={[styles.attachChoiceText, { color: theme.blue }]}>Файл</Text>
                    </Pressable>
                  </View>

                  {selectedFile?.uri && (
                    <View style={[styles.selectedFileBox, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                      <Ionicons name={attachmentType === 'image' ? 'image-outline' : 'document-outline'} size={18} color={theme.blue} />
                      <Text style={[styles.selectedFileText, { color: theme.text }]} numberOfLines={1}>{selectedFile.name}</Text>
                    </View>
                  )}

                  {attachmentType === 'image' && selectedFile?.uri ? <Image source={{ uri: selectedFile.uri }} style={styles.selectedPreviewImage} contentFit="cover" /> : null}
                </>
              )}

              <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Комментарий</Text>
                <TextInput value={attachmentNote} onChangeText={setAttachmentNote} placeholder="Короткое описание материала" placeholderTextColor={theme.textMuted} style={[styles.input, styles.smallTextarea, { color: theme.text }]} multiline textAlignVertical="top" />
              </View>

              <Pressable onPress={createAttachment} disabled={savingAttachment} style={[styles.saveBtn, { backgroundColor: theme.success || '#1AAE6F', opacity: savingAttachment ? 0.65 : 1 }]}>
                {savingAttachment ? <ActivityIndicator color="#fff" /> : <Ionicons name="cloud-upload-outline" size={18} color="#fff" />}
                <Text style={styles.saveText}>{savingAttachment ? 'Загрузка...' : 'Добавить материал'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 22, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 128, gap: 14 },
  hero: { borderRadius: 32, padding: 18, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 },
  heroBackBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroActionBtn: { minHeight: 42, borderRadius: 16, paddingHorizontal: 13, backgroundColor: 'rgba(255,255,255,0.18)', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  heroActionText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  heroIconBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
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
  heroStatValue: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroStatLabel: { marginTop: 3, color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '800' },
  heroLine: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.18)' },
  card: { borderWidth: 1, borderRadius: 26, padding: 16, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cardIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  subSectionTitle: { marginTop: 14, marginBottom: 8, fontSize: 14, fontWeight: '900' },
  teamHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  avatarMini: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  avatarMiniText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  teamCount: { fontSize: 13, fontWeight: '800' },
  peopleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  personPill: { minHeight: 38, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  personText: { fontSize: 12, fontWeight: '900' },
  emptySmall: { fontSize: 13, fontWeight: '700', lineHeight: 19 },
  emptyTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  quickActions: { flexDirection: 'row', gap: 10 },
  quickActionBtn: { flex: 1, minHeight: 54, borderRadius: 19, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  quickActionText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  bigSectionTitle: { fontSize: 21, fontWeight: '900' },
  bigSectionSub: { marginTop: -8, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  kanbanScroll: { gap: 12, paddingRight: 18 },
  kanbanColumn: { width: 304, borderWidth: 1, borderRadius: 24, padding: 12 },
  columnHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  columnIcon: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  columnTitle: { fontSize: 15, fontWeight: '900' },
  columnCount: { marginTop: 2, fontSize: 12, fontWeight: '700' },
  emptyColumn: { borderRadius: 18, minHeight: 92, alignItems: 'center', justifyContent: 'center', padding: 12 },
  taskCard: { borderWidth: 1, borderRadius: 20, padding: 12, marginBottom: 10 },
  taskTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  taskTitle: { flex: 1, fontSize: 15, fontWeight: '900', lineHeight: 20 },
  priorityDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  taskDescription: { marginTop: 8 },
  taskMetaBox: { marginTop: 10, gap: 6 },
  taskMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taskMeta: { flex: 1, fontSize: 12, fontWeight: '700' },
  taskStatusRow: { marginTop: 10, gap: 7 },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  statusText: { fontSize: 11.5, fontWeight: '900' },
  openTaskBtn: { marginTop: 10, borderWidth: 1, borderRadius: 14, minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  openTaskBtnText: { fontSize: 12, fontWeight: '900' },
  materialHeader: { marginTop: 4, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  smallAddBtn: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emptyMaterials: { minHeight: 110, alignItems: 'center', justifyContent: 'center', gap: 8 },
  attachmentCard: { borderWidth: 1, borderRadius: 18, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  attachmentIcon: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  attachmentImage: { width: 48, height: 48, borderRadius: 14 },
  attachmentTitle: { fontSize: 14, fontWeight: '900' },
  attachmentNote: { marginTop: 4, fontSize: 12, fontWeight: '700', lineHeight: 17 },
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
  smallTextarea: { minHeight: 86, lineHeight: 21 },
  peopleTitle: { fontSize: 14, fontWeight: '900' },
  saveBtn: { marginTop: 4, borderRadius: 20, minHeight: 56, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  attachChoiceRow: { flexDirection: 'row', gap: 10 },
  attachChoiceBtn: { flex: 1, minHeight: 48, borderRadius: 17, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  attachChoiceText: { fontSize: 13, fontWeight: '900' },
  selectedFileBox: { borderWidth: 1, borderRadius: 17, paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectedFileText: { flex: 1, fontSize: 13, fontWeight: '800' },
  selectedPreviewImage: { width: '100%', height: 170, borderRadius: 20 },
  backWideBtn: { marginTop: 16, minHeight: 48, borderRadius: 18, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  backWideText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});