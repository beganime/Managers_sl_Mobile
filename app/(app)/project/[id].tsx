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
import apiClient, { fetchAllPages } from '../../../src/api/apiClient';
import { useTheme } from '../../../src/context/ThemeContext';

type UserMini = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
};

type ProjectTask = {
  id: number;
  project: number;
  title: string;
  description?: string;
  assigned_to?: number | null;
  assigned_to_data?: UserMini | null;
  status: 'todo' | 'process' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  deadline?: string | null;
  updated_at?: string;
};

type ProjectAttachment = {
  id: number;
  title?: string;
  attachment_type: 'file' | 'image' | 'link';
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
  office_city?: string;
  status: string;
  deadline?: string | null;
  participants_data?: UserMini[];
  responsible_users_data?: UserMini[];
  items?: ProjectTask[];
  attachments?: ProjectAttachment[];
  created_at?: string;
  updated_at?: string;
};

const TASK_STATUSES = [
  { value: 'todo', label: 'План', icon: 'ellipse-outline' },
  { value: 'process', label: 'В работе', icon: 'flash-outline' },
  { value: 'review', label: 'Проверка', icon: 'eye-outline' },
  { value: 'done', label: 'Готово', icon: 'checkmark-done-outline' },
] as const;

const PRIORITIES = [
  { value: 'low', label: 'Низкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'high', label: 'Высокий' },
] as const;

function userName(user?: UserMini | null) {
  if (!user) return 'Не назначен';
  return user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email;
}

function initials(user?: UserMini | null) {
  const name = userName(user);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
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

function taskProgress(project?: Project | null) {
  const items = project?.items || [];
  const total = items.length;
  const done = items.filter((item) => item.status === 'done').length;
  const process = items.filter((item) => item.status === 'process').length;
  const review = items.filter((item) => item.status === 'review').length;
  const percent = total > 0 ? Math.round((done / total) * 100) : project?.status === 'done' ? 100 : 0;
  return { total, done, process, review, percent };
}

function priorityLabel(value?: string) {
  if (value === 'low') return 'Низкий';
  if (value === 'medium') return 'Средний';
  if (value === 'high') return 'Высокий';
  return value || '—';
}

function priorityColor(value: string, theme: any) {
  if (value === 'high') return theme.red;
  if (value === 'medium') return '#F59E0B';
  return '#1AAE6F';
}

function attachmentIcon(type?: string): keyof typeof Ionicons.glyphMap {
  if (type === 'image') return 'image-outline';
  if (type === 'link') return 'link-outline';
  return 'document-outline';
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
    bullet_list: {
      marginBottom: 8,
    },
    ordered_list: {
      marginBottom: 8,
    },
    link: {
      color: theme.blue,
      fontWeight: '900',
    },
  };
}

function AvatarStack({ users, theme }: { users?: UserMini[]; theme: any }) {
  const visible = (users || []).slice(0, 5);
  const extra = Math.max((users || []).length - visible.length, 0);

  return (
    <View style={styles.avatarStack}>
      {visible.map((item, index) => (
        <View
          key={item.id}
          style={[
            styles.avatarMini,
            {
              backgroundColor: index % 2 === 0 ? theme.blue : '#1AAE6F',
              borderColor: theme.surface,
              marginLeft: index === 0 ? 0 : -8,
            },
          ]}
        >
          <Text style={styles.avatarMiniText}>{initials(item)}</Text>
        </View>
      ))}
      {extra > 0 && (
        <View style={[styles.avatarMini, { backgroundColor: theme.backgroundSoft, borderColor: theme.surface, marginLeft: -8 }]}>
          <Text style={[styles.avatarExtraText, { color: theme.text }]}>+{extra}</Text>
        </View>
      )}
      {!visible.length && (
        <View style={[styles.avatarMini, { backgroundColor: theme.backgroundSoft, borderColor: theme.surface }]}>
          <Ionicons name="person-outline" size={14} color={theme.textMuted} />
        </View>
      )}
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
  const [taskStatus, setTaskStatus] = useState<ProjectTask['status']>('todo');
  const [taskPriority, setTaskPriority] = useState<ProjectTask['priority']>('medium');
  const [taskDeadline, setTaskDeadline] = useState('');

  const [attachmentType, setAttachmentType] = useState<'link' | 'image' | 'file'>('link');
  const [attachmentTitle, setAttachmentTitle] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentNote, setAttachmentNote] = useState('');
  const [selectedFile, setSelectedFile] = useState<any>(null);

  const progress = useMemo(() => taskProgress(project), [project]);

  const tasksByStatus = useMemo(() => {
    const items = project?.items || [];
    return TASK_STATUSES.map((status) => ({
      ...status,
      items: items.filter((item) => item.status === status.value),
    }));
  }, [project?.items]);

  const load = async () => {
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
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить проект.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
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
      const detail = error?.response?.data?.detail || error?.response?.data?.title?.[0] || 'Не удалось создать задачу.';
      Alert.alert('Ошибка', String(detail));
    } finally {
      setSavingTask(false);
    }
  };

  const updateTaskStatus = async (task: ProjectTask, status: ProjectTask['status']) => {
    try {
      await apiClient.patch(`tasks/project-tasks/${task.id}/`, { status });
      await load();
    } catch {
      Alert.alert('Ошибка', 'Не удалось обновить статус задачи.');
    }
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
    setSelectedFile({
      uri: asset.uri,
      name: asset.fileName || asset.uri.split('/').pop() || 'image.jpg',
      type: asset.mimeType || 'image/jpeg',
    });
    setAttachmentType('image');
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setSelectedFile({
      uri: asset.uri,
      name: asset.name || 'file',
      type: asset.mimeType || 'application/octet-stream',
    });
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
      } else {
        fd.append('file', selectedFile as any);
      }

      await apiClient.post('tasks/project-attachments/', fd, {
        headers: { Accept: 'application/json' },
      });

      setAttachmentModalOpen(false);
      resetAttachment();
      await load();
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.response?.data?.file?.[0] || error?.response?.data?.url?.[0] || 'Не удалось добавить материал.';
      Alert.alert('Ошибка', String(detail));
    } finally {
      setSavingAttachment(false);
    }
  };

  const openAttachment = async (attachment: ProjectAttachment) => {
    const url = attachment.file_url || attachment.url;
    if (!url) return;

    try {
      await WebBrowser.openBrowserAsync(url);
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
          <Pressable onPress={() => router.back()} style={[styles.backWideBtn, { backgroundColor: theme.blue }]}>
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
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
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
            <Pressable onPress={() => router.back()} style={styles.heroBackBtn}>
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
                <Text style={styles.heroStatValue}>{progress.process}</Text>
                <Text style={styles.heroStatLabel}>В работе</Text>
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
            {(project.responsible_users_data || []).length === 0 && <Text style={[styles.emptySmall, { color: theme.textSecondary }]}>Ответственные не назначены.</Text>}
          </View>
        </View>

        <View style={styles.quickActions}>
          <Pressable onPress={() => setTaskModalOpen(true)} style={[styles.quickActionBtn, { backgroundColor: theme.blue }]}>
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.quickActionText}>Добавить задачу</Text>
          </Pressable>
          <Pressable onPress={() => setAttachmentModalOpen(true)} style={[styles.quickActionBtn, { backgroundColor: '#1AAE6F' }]}>
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            <Text style={styles.quickActionText}>Материал</Text>
          </Pressable>
        </View>

        <Text style={[styles.bigSectionTitle, { color: theme.text }]}>Канбан задач</Text>
        <Text style={[styles.bigSectionSub, { color: theme.textSecondary }]}>Нажимай на статус внутри карточки, чтобы быстро переносить задачу.</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kanbanScroll}>
          {tasksByStatus.map((column) => (
            <View key={column.value} style={[styles.kanbanColumn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.columnHeader}>
                <View style={[styles.columnIcon, { backgroundColor: theme.blueSoft }]}>
                  <Ionicons name={column.icon as any} size={16} color={theme.blue} />
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
                  return (
                    <View key={task.id} style={[styles.taskCard, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                      <View style={styles.taskTop}>
                        <Text style={[styles.taskTitle, { color: theme.text }]}>{task.title}</Text>
                        <View style={[styles.priorityDot, { backgroundColor: pColor }]} />
                      </View>
                      {!!task.description && (
                        <View style={styles.taskDescription}>
                          <Markdown style={markdownStyles(theme) as any}>{task.description.length > 130 ? `${task.description.slice(0, 130)}...` : task.description}</Markdown>
                        </View>
                      )}
                      <View style={styles.taskMetaBox}>
                        <View style={styles.taskMetaRow}>
                          <Ionicons name="person-outline" size={13} color={theme.textMuted} />
                          <Text style={[styles.taskMeta, { color: theme.textSecondary }]} numberOfLines={1}>{userName(task.assigned_to_data)}</Text>
                        </View>
                        <View style={styles.taskMetaRow}>
                          <Ionicons name="calendar-outline" size={13} color={theme.textMuted} />
                          <Text style={[styles.taskMeta, { color: theme.textSecondary }]}>{formatDate(task.deadline)}</Text>
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
                              onPress={() => updateTaskStatus(task, statusItem.value)}
                              style={[
                                styles.statusPill,
                                {
                                  backgroundColor: active ? theme.blue : theme.surface,
                                  borderColor: active ? theme.blue : theme.border,
                                },
                              ]}
                            >
                              <Text style={[styles.statusText, { color: active ? '#fff' : theme.text }]}>{statusItem.label}</Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  );
                })
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.materialHeader}>
          <View>
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
              <Pressable key={attachment.id} onPress={() => openAttachment(attachment)} style={[styles.attachmentCard, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <View style={[styles.attachmentIcon, { backgroundColor: theme.blueSoft }]}>
                  <Ionicons name={attachmentIcon(attachment.attachment_type)} size={20} color={theme.blue} />
                </View>
                {attachment.attachment_type === 'image' && attachment.file_url ? (
                  <Image source={{ uri: attachment.file_url }} style={styles.attachmentImage} contentFit="cover" />
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
          <View style={[styles.modalCard, { backgroundColor: theme.card || theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Новая задача</Text>
                <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>Назначь ответственного, статус и дедлайн</Text>
              </View>
              <Pressable onPress={() => setTaskModalOpen(false)} style={[styles.modalClose, { backgroundColor: theme.backgroundSoft }]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScroll}>
              <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Название</Text>
                <TextInput value={taskTitle} onChangeText={setTaskTitle} placeholder="Название задачи" placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} />
              </View>
              <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Описание Markdown</Text>
                <TextInput value={taskDescription} onChangeText={setTaskDescription} placeholder="Описание задачи" placeholderTextColor={theme.textMuted} style={[styles.input, styles.textarea, { color: theme.text }]} multiline textAlignVertical="top" />
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
                <TextInput value={taskDeadline} onChangeText={setTaskDeadline} placeholder="2026-05-20T18:00:00+05:00" placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} autoCapitalize="none" />
              </View>
              <Pressable onPress={createTask} disabled={savingTask} style={[styles.saveBtn, { backgroundColor: theme.blue, opacity: savingTask ? 0.65 : 1 }]}>
                {savingTask ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
                <Text style={styles.saveText}>{savingTask ? 'Сохранение...' : 'Создать задачу'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={attachmentModalOpen} animationType="slide" transparent onRequestClose={() => setAttachmentModalOpen(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, { backgroundColor: theme.card || theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Добавить материал</Text>
                <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>Ссылка, фото или файл внутри проекта</Text>
              </View>
              <Pressable onPress={() => setAttachmentModalOpen(false)} style={[styles.modalClose, { backgroundColor: theme.backgroundSoft }]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScroll}>
              <View style={styles.actionRow}>
                <Pressable onPress={() => setAttachmentType('link')} style={[styles.typeBtn, { backgroundColor: attachmentType === 'link' ? theme.blue : theme.backgroundSoft, borderColor: attachmentType === 'link' ? theme.blue : theme.border }]}>
                  <Ionicons name="link-outline" size={17} color={attachmentType === 'link' ? '#fff' : theme.blue} />
                  <Text style={[styles.typeText, { color: attachmentType === 'link' ? '#fff' : theme.text }]}>Ссылка</Text>
                </Pressable>
                <Pressable onPress={pickImage} style={[styles.typeBtn, { backgroundColor: attachmentType === 'image' ? theme.blue : theme.backgroundSoft, borderColor: attachmentType === 'image' ? theme.blue : theme.border }]}>
                  <Ionicons name="image-outline" size={17} color={attachmentType === 'image' ? '#fff' : theme.blue} />
                  <Text style={[styles.typeText, { color: attachmentType === 'image' ? '#fff' : theme.text }]}>Фото</Text>
                </Pressable>
                <Pressable onPress={pickFile} style={[styles.typeBtn, { backgroundColor: attachmentType === 'file' ? theme.blue : theme.backgroundSoft, borderColor: attachmentType === 'file' ? theme.blue : theme.border }]}>
                  <Ionicons name="document-outline" size={17} color={attachmentType === 'file' ? '#fff' : theme.blue} />
                  <Text style={[styles.typeText, { color: attachmentType === 'file' ? '#fff' : theme.text }]}>Файл</Text>
                </Pressable>
              </View>
              <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Название</Text>
                <TextInput value={attachmentTitle} onChangeText={setAttachmentTitle} placeholder="Название материала" placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} />
              </View>
              {attachmentType === 'link' ? (
                <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Ссылка</Text>
                  <TextInput value={attachmentUrl} onChangeText={setAttachmentUrl} placeholder="https://..." placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} autoCapitalize="none" keyboardType="url" />
                </View>
              ) : (
                <View style={[styles.selectedFileBox, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                  <Ionicons name={attachmentType === 'image' ? 'image-outline' : 'document-outline'} size={22} color={theme.blue} />
                  <Text style={[styles.selectedFileText, { color: theme.text }]}>{selectedFile?.name || 'Файл не выбран'}</Text>
                </View>
              )}
              <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Комментарий</Text>
                <TextInput value={attachmentNote} onChangeText={setAttachmentNote} placeholder="Короткое описание" placeholderTextColor={theme.textMuted} style={[styles.input, styles.textareaSmall, { color: theme.text }]} multiline textAlignVertical="top" />
              </View>
              <Pressable onPress={createAttachment} disabled={savingAttachment} style={[styles.saveBtn, { backgroundColor: theme.blue, opacity: savingAttachment ? 0.65 : 1 }]}>
                {savingAttachment ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
                <Text style={styles.saveText}>{savingAttachment ? 'Сохранение...' : 'Добавить материал'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 128,
    gap: 14,
  },
  hero: {
    borderRadius: 32,
    padding: 18,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  heroBackBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroActions: {
    flexDirection: 'row',
    gap: 8,
  },
  heroActionBtn: {
    minHeight: 42,
    borderRadius: 16,
    paddingHorizontal: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  heroIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    marginTop: 8,
    color: '#fff',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.84)',
    fontSize: 14,
    fontWeight: '700',
  },
  heroProgressBox: {
    marginTop: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: 14,
  },
  heroProgressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  heroProgressLabel: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 13,
    fontWeight: '900',
  },
  heroProgressPercent: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  heroProgressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  heroStats: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  heroStatLabel: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '800',
  },
  heroLine: {
    width: 1,
    height: 34,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  card: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 16,
    gap: 10,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 15,
    elevation: 2,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  subSectionTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '900',
  },
  emptySmall: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  backWideBtn: {
    marginTop: 16,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  backWideText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamCount: {
    fontSize: 13,
    fontWeight: '800',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 38,
  },
  avatarMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  personPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  personText: {
    fontSize: 12,
    fontWeight: '900',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActionBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  bigSectionTitle: {
    fontSize: 21,
    fontWeight: '900',
    marginTop: 2,
  },
  bigSectionSub: {
    marginTop: -8,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  kanbanScroll: {
    gap: 12,
    paddingRight: 18,
  },
  kanbanColumn: {
    width: 286,
    borderWidth: 1,
    borderRadius: 26,
    padding: 12,
    gap: 10,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  columnIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  columnCount: {
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: '700',
  },
  emptyColumn: {
    minHeight: 86,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    gap: 8,
  },
  taskTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  taskTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  taskDescription: {
    marginTop: -2,
  },
  taskMetaBox: {
    gap: 5,
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskMeta: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  taskStatusRow: {
    gap: 6,
    paddingTop: 2,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '900',
  },
  materialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  smallAddBtn: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMaterials: {
    minHeight: 90,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  attachmentCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    borderRadius: 15,
  },
  attachmentTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  attachmentNote: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '90%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    padding: 16,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.45)',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    gap: 12,
    paddingBottom: 20,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },
  input: {
    minHeight: 26,
    fontSize: 15,
    fontWeight: '700',
  },
  textarea: {
    minHeight: 112,
    lineHeight: 21,
  },
  textareaSmall: {
    minHeight: 82,
    lineHeight: 20,
  },
  peopleTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  selectedFileBox: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  selectedFileText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  saveBtn: {
    minHeight: 56,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  saveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
});