import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

import ScreenWrapper from '../../components/ScreenWrapper';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import apiClient, { extractList, fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import { safeGoBack } from '../../src/navigation/safeGoBack';

type UserMini = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
};

type ProjectTask = {
  id: number;
  status?: 'todo' | 'process' | 'review' | 'done';
};

type Project = {
  id: number;
  title: string;
  description?: string;
  city?: string;
  office?: number | null;
  office_city?: string;
  created_by?: number | null;
  created_by_data?: UserMini | null;
  participants?: number[];
  participants_data?: UserMini[];
  responsible_users?: number[];
  responsible_users_data?: UserMini[];
  status: 'active' | 'paused' | 'done' | 'archived';
  deadline?: string | null;
  is_hidden?: boolean;
  is_pinned?: boolean;
  items?: ProjectTask[];
  attachments?: any[];
  created_at?: string;
  updated_at?: string;
  can_manage?: boolean;
};

type ProjectStatus = 'active' | 'paused' | 'done' | 'archived';

const STATUS_FILTERS: {
  value: '' | ProjectStatus;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: '', label: 'Все', icon: 'albums-outline' },
  { value: 'active', label: 'Активные', icon: 'radio-button-on-outline' },
  { value: 'paused', label: 'Пауза', icon: 'pause-circle-outline' },
  { value: 'done', label: 'Готовые', icon: 'checkmark-done-outline' },
  { value: 'archived', label: 'Архив', icon: 'archive-outline' },
];

const PROJECT_STATUSES: {
  value: ProjectStatus;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'active', label: 'Активный', icon: 'radio-button-on-outline' },
  { value: 'paused', label: 'Пауза', icon: 'pause-circle-outline' },
  { value: 'done', label: 'Завершён', icon: 'checkmark-done-outline' },
  { value: 'archived', label: 'Архив', icon: 'archive-outline' },
];

function userName(user?: UserMini | null) {
  if (!user) return '—';
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

function statusColor(status: string | undefined, theme: any) {
  if (status === 'active') return theme.blue;
  if (status === 'paused') return theme.warning || '#F59E0B';
  if (status === 'done') return theme.success || '#1AAE6F';
  if (status === 'archived') return theme.textMuted;
  return theme.textMuted;
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

function progress(project: Project) {
  const tasks = project.items || [];
  const total = tasks.length;
  const done = tasks.filter((item) => item.status === 'done').length;
  const percent = total > 0 ? Math.round((done / total) * 100) : project.status === 'done' ? 100 : 0;

  return { total, done, percent };
}

function normalizeDeadline(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function errorText(error: any) {
  const data = error?.response?.data;

  return (
    data?.detail ||
    data?.title?.[0] ||
    data?.description?.[0] ||
    data?.participants?.[0] ||
    data?.responsible_users?.[0] ||
    data?.deadline?.[0] ||
    'Не удалось выполнить действие.'
  );
}

function canManageProject(project: Project, currentUserId?: number, isAdmin?: boolean) {
  if (project.can_manage) return true;
  if (isAdmin) return true;
  if (!currentUserId) return false;
  return Number(project.created_by) === Number(currentUserId);
}

function AvatarStack({ users, theme }: { users?: UserMini[]; theme: any }) {
  const visible = (users || []).slice(0, 5);
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

function MetricCard({
  title,
  value,
  icon,
  theme,
  color,
}: {
  title: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  theme: any;
  color: string;
}) {
  return (
    <View
      style={[
        styles.metricCard,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>

      <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.metricTitle, { color: theme.textSecondary }]}>{title}</Text>
    </View>
  );
}

export default function ProjectsScreen() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { theme, themeMode } = useTheme();

  const dark = themeMode === 'dark';
  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');
  const currentUserId = user?.id ? Number(user.id) : undefined;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserMini[]>([]);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | ProjectStatus>('');
  const [city, setCity] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formStatus, setFormStatus] = useState<ProjectStatus>('active');
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);
  const [selectedResponsibles, setSelectedResponsibles] = useState<number[]>([]);
  const [userSearch, setUserSearch] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      const data = await fetchAllPages('users/users/?limit=100&offset=0');
      setUsers((data || []) as UserMini[]);
    } catch {
      setUsers([]);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      params.set('offset', '0');
      params.set('ordering', '-updated_at');

      if (status) params.set('status', status);
      if (city.trim()) params.set('city', city.trim());
      if (search.trim()) params.set('search', search.trim());

      const response = await apiClient.get(`tasks/projects/?${params.toString()}`);
      setProjects(extractList(response.data) as Project[]);
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.detail || 'Не удалось загрузить проекты.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, city, search]);

  const load = useCallback(async () => {
    await Promise.allSettled([loadProjects(), loadUsers()]);
  }, [loadProjects, loadUsers]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    void load();
  };

  const stats = useMemo(() => {
    const active = projects.filter((item) => item.status === 'active').length;
    const done = projects.filter((item) => item.status === 'done').length;
    const urgent = projects.filter((item) => {
      const meta = deadlineMeta(item.deadline);
      return meta.tone === 'danger' || meta.tone === 'warning';
    }).length;

    return {
      total: projects.length,
      active,
      done,
      urgent,
    };
  }, [projects]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();

    if (!q) return users;

    return users.filter((item) => {
      return (
        userName(item).toLowerCase().includes(q) ||
        String(item.email || '').toLowerCase().includes(q)
      );
    });
  }, [users, userSearch]);

  const resetForm = () => {
    setEditingProject(null);
    setFormTitle('');
    setFormDescription('');
    setFormCity(user?.office?.city || '');
    setFormDeadline('');
    setFormStatus('active');
    setSelectedParticipants(user?.id ? [Number(user.id)] : []);
    setSelectedResponsibles([]);
    setUserSearch('');
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditingProject(project);
    setFormTitle(project.title || '');
    setFormDescription(project.description || '');
    setFormCity(project.city || project.office_city || '');
    setFormDeadline(project.deadline || '');
    setFormStatus(project.status || 'active');
    setSelectedParticipants(
      project.participants?.length
        ? project.participants.map(Number)
        : project.participants_data?.map((item) => Number(item.id)) || []
    );
    setSelectedResponsibles(
      project.responsible_users?.length
        ? project.responsible_users.map(Number)
        : project.responsible_users_data?.map((item) => Number(item.id)) || []
    );
    setUserSearch('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    resetForm();
  };

  const toggleId = (id: number, list: number[], setter: (value: number[]) => void) => {
    setter(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  };

  const saveProject = async () => {
    if (!formTitle.trim()) {
      Alert.alert('Ошибка', 'Напиши название проекта.');
      return;
    }

    const participants = Array.from(
      new Set([
        ...selectedParticipants,
        ...(user?.id ? [Number(user.id)] : []),
        ...selectedResponsibles,
      ])
    );

    setSaving(true);

    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        city: formCity.trim(),
        status: formStatus,
        deadline: normalizeDeadline(formDeadline),
        participants,
        responsible_users: selectedResponsibles,
      };

      if (editingProject) {
        await apiClient.patch(`tasks/projects/${editingProject.id}/`, payload);
      } else {
        await apiClient.post('tasks/projects/', payload);
      }

      setModalOpen(false);
      resetForm();
      await load();

      Alert.alert('Готово', editingProject ? 'Проект обновлён.' : 'Проект создан.');
    } catch (error: any) {
      Alert.alert('Ошибка', String(errorText(error)));
    } finally {
      setSaving(false);
    }
  };

  const openProject = (project: Project) => {
    router.push({ pathname: '/(app)/project/[id]', params: { id: String(project.id) } } as any);
  };

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
              <Pressable onPress={() => safeGoBack(router)} style={[styles.backBtn, { backgroundColor: theme.backgroundSoft }]}>
                <Ionicons name="arrow-back" size={21} color={theme.text} />
              </Pressable>

              <View style={{ flex: 1 }}>
                <Text style={[styles.kicker, { color: theme.textMuted }]}>PROJECTS</Text>
                <Text style={[styles.title, { color: theme.text }]}>Проекты</Text>
              </View>

              <Pressable onPress={openCreate} style={[styles.createBtn, { backgroundColor: theme.blue }]}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.createBtnText}>Проект</Text>
              </Pressable>
            </View>

            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Видны только проекты, где ты создатель, участник или ответственный.
            </Text>

            <View style={styles.metricsGrid}>
              <MetricCard title="Всего" value={stats.total} icon="albums-outline" theme={theme} color={theme.blue} />
              <MetricCard title="Активные" value={stats.active} icon="radio-button-on-outline" theme={theme} color={theme.blue} />
              <MetricCard title="Срочные" value={stats.urgent} icon="time-outline" theme={theme} color={theme.red} />
              <MetricCard title="Готовые" value={stats.done} icon="checkmark-done-outline" theme={theme} color={theme.success || '#1AAE6F'} />
            </View>
          </View>

          <View
            style={[
              styles.filtersCard,
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
                onSubmitEditing={() => void load()}
                placeholder="Поиск по проектам"
                placeholderTextColor={theme.textMuted}
                style={[styles.searchInput, { color: theme.text }]}
                returnKeyType="search"
              />
              {!!search && (
                <Pressable onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                </Pressable>
              )}
            </View>

            {isAdmin && (
              <View style={[styles.searchBox, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Ionicons name="location-outline" size={18} color={theme.textMuted} />
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  onSubmitEditing={() => void load()}
                  placeholder="Фильтр по городу"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.searchInput, { color: theme.text }]}
                  returnKeyType="search"
                />
                {!!city && (
                  <Pressable onPress={() => setCity('')}>
                    <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                  </Pressable>
                )}
              </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
              {STATUS_FILTERS.map((item) => {
                const active = status === item.value;

                return (
                  <Pressable
                    key={item.value || 'all'}
                    onPress={() => setStatus(item.value)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: active ? theme.blue : theme.backgroundSoft,
                        borderColor: active ? theme.blue : theme.border,
                      },
                    ]}
                  >
                    <Ionicons name={item.icon} size={15} color={active ? '#fff' : theme.textSecondary} />
                    <Text style={[styles.filterChipText, { color: active ? '#fff' : theme.text }]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable onPress={() => void load()} style={[styles.applyBtn, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
              <Ionicons name="refresh-outline" size={17} color={theme.blue} />
              <Text style={[styles.applyText, { color: theme.blue }]}>Обновить список</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={theme.blue} size="large" />
            </View>
          ) : projects.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.blueSoft }]}>
                <Ionicons name="folder-open-outline" size={34} color={theme.blue} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Проектов нет</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                Если ты не участвуешь в проекте, он не будет показан. Создай проект или попроси создателя добавить тебя в участники.
              </Text>
              <Pressable onPress={openCreate} style={[styles.emptyBtn, { backgroundColor: theme.blue }]}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.emptyBtnText}>Создать проект</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.projectList}>
              {projects.map((project) => {
                const p = progress(project);
                const d = deadlineMeta(project.deadline);
                const sColor = statusColor(project.status, theme);
                const dColor = d.tone === 'danger' ? theme.red : d.tone === 'warning' ? theme.warning || '#F59E0B' : theme.textMuted;
                const canEdit = canManageProject(project, currentUserId, isAdmin);
                const team = project.responsible_users_data?.length ? project.responsible_users_data : project.participants_data;

                return (
                  <Pressable
                    key={project.id}
                    onPress={() => openProject(project)}
                    style={[
                      styles.projectCard,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        shadowColor: theme.shadow,
                      },
                    ]}
                  >
                    <View style={styles.projectTop}>
                      <View style={[styles.projectMark, { backgroundColor: `${sColor}18` }]}>
                        <Ionicons name={project.is_pinned ? 'pin' : 'folder-outline'} size={20} color={sColor} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={styles.projectTitleRow}>
                          <Text style={[styles.projectTitle, { color: theme.text }]} numberOfLines={2}>
                            {project.title}
                          </Text>

                          {canEdit && (
                            <Pressable
                              onPress={(event) => {
                                event.stopPropagation();
                                openEdit(project);
                              }}
                              style={[styles.editIconBtn, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}
                            >
                              <Ionicons name="create-outline" size={16} color={theme.textSecondary} />
                            </Pressable>
                          )}
                        </View>

                        <Text style={[styles.projectMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                          {statusLabel(project.status)} · {project.city || project.office_city || 'Без города'} · обновлено {formatDateTime(project.updated_at)}
                        </Text>
                      </View>
                    </View>

                    {!!project.description && (
                      <Text style={[styles.projectDescription, { color: theme.textSecondary }]} numberOfLines={3}>
                        {project.description.replace(/[#*_`>-]/g, '').trim()}
                      </Text>
                    )}

                    <View style={[styles.progressBox, { backgroundColor: theme.backgroundSoft }]}>
                      <View style={styles.progressHeader}>
                        <Text style={[styles.progressTitle, { color: theme.text }]}>Прогресс</Text>
                        <Text style={[styles.progressPercent, { color: theme.blue }]}>{p.percent}%</Text>
                      </View>

                      <View style={[styles.progressTrack, { backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }]}>
                        <View style={[styles.progressFill, { width: `${p.percent}%`, backgroundColor: theme.blue }]} />
                      </View>

                      <Text style={[styles.progressHint, { color: theme.textSecondary }]}>
                        {p.done}/{p.total} задач завершено
                      </Text>
                    </View>

                    <View style={styles.projectFooter}>
                      <View style={styles.peopleBlock}>
                        <AvatarStack users={team} theme={theme} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.peopleLabel, { color: theme.textMuted }]}>Команда</Text>
                          <Text style={[styles.peopleText, { color: theme.text }]} numberOfLines={1}>
                            {(team || []).map(userName).join(', ') || 'Участники не назначены'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.footerPills}>
                        <View style={[styles.footerPill, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                          <Ionicons name="time-outline" size={13} color={dColor} />
                          <Text style={[styles.footerPillText, { color: dColor }]}>{d.label}</Text>
                        </View>

                        <View style={[styles.footerPill, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                          <Ionicons name="checkbox-outline" size={13} color={theme.blue} />
                          <Text style={[styles.footerPillText, { color: theme.textSecondary }]}>{project.items?.length || 0}</Text>
                        </View>

                        <View style={[styles.footerPill, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                          <Ionicons name="attach-outline" size={13} color={theme.blue} />
                          <Text style={[styles.footerPillText, { color: theme.textSecondary }]}>{project.attachments?.length || 0}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        <Modal visible={modalOpen} animationType="slide" transparent={false} onRequestClose={closeModal}>
          <KeyboardAvoidingView
            style={[styles.modalRoot, { backgroundColor: theme.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View
              style={[
                styles.modalHeader,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={[styles.modalIcon, { backgroundColor: theme.blueSoft }]}>
                <Ionicons name={editingProject ? 'create-outline' : 'folder-open-outline'} size={22} color={theme.blue} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {editingProject ? 'Редактировать проект' : 'Новый проект'}
                </Text>
                <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                  {editingProject ? 'Измени описание, статус и участников' : 'Создай рабочее пространство для задач'}
                </Text>
              </View>

              <Pressable onPress={closeModal} style={[styles.modalClose, { backgroundColor: theme.backgroundSoft }]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalBody}
            >
              <View style={[styles.inputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Название проекта</Text>
                <TextInput
                  value={formTitle}
                  onChangeText={setFormTitle}
                  placeholder="Например: Запуск офиса в Мары"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, { color: theme.text }]}
                />
              </View>

              <View style={[styles.inputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Описание</Text>
                <TextInput
                  value={formDescription}
                  onChangeText={setFormDescription}
                  placeholder="Цель, план, важные детали проекта..."
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
                    value={formCity}
                    onChangeText={setFormCity}
                    placeholder="Ашхабад"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.input, { color: theme.text }]}
                  />
                </View>

                <View style={[styles.inputWrap, styles.halfInput, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Дедлайн</Text>
                  <TextInput
                    value={formDeadline}
                    onChangeText={setFormDeadline}
                    placeholder="2026-05-20"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.input, { color: theme.text }]}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <Text style={[styles.formSectionTitle, { color: theme.text }]}>Статус проекта</Text>
              <View style={styles.optionsWrap}>
                {PROJECT_STATUSES.map((item) => {
                  const active = formStatus === item.value;
                  const color = statusColor(item.value, theme);

                  return (
                    <Pressable
                      key={item.value}
                      onPress={() => setFormStatus(item.value)}
                      style={[
                        styles.optionChip,
                        {
                          backgroundColor: active ? color : theme.surface,
                          borderColor: active ? color : theme.border,
                        },
                      ]}
                    >
                      <Ionicons name={item.icon} size={15} color={active ? '#fff' : color} />
                      <Text style={[styles.optionText, { color: active ? '#fff' : theme.text }]}>
                        {item.label}
                      </Text>
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

              <Text style={[styles.formSectionTitle, { color: theme.text }]}>Участники с доступом</Text>
              <View style={styles.peopleWrap}>
                {filteredUsers.map((item) => {
                  const active = selectedParticipants.includes(item.id);

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => toggleId(item.id, selectedParticipants, setSelectedParticipants)}
                      style={[
                        styles.personChip,
                        {
                          backgroundColor: active ? theme.blue : theme.surface,
                          borderColor: active ? theme.blue : theme.border,
                        },
                      ]}
                    >
                      <Text style={[styles.personChipText, { color: active ? '#fff' : theme.text }]}>
                        {userName(item)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.formSectionTitle, { color: theme.text }]}>Ответственные</Text>
              <View style={styles.peopleWrap}>
                {filteredUsers.map((item) => {
                  const active = selectedResponsibles.includes(item.id);

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => toggleId(item.id, selectedResponsibles, setSelectedResponsibles)}
                      style={[
                        styles.personChip,
                        {
                          backgroundColor: active ? theme.blue : theme.surface,
                          borderColor: active ? theme.blue : theme.border,
                        },
                      ]}
                    >
                      <Text style={[styles.personChipText, { color: active ? '#fff' : theme.text }]}>
                        {userName(item)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.noticeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="information-circle-outline" size={18} color={theme.blue} />
                <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
                  Ответственные автоматически получают доступ к проекту. Создатель проекта всегда остаётся участником.
                </Text>
              </View>

              <Pressable
                onPress={saveProject}
                disabled={saving}
                style={[styles.saveBtn, { backgroundColor: theme.blue, opacity: saving ? 0.65 : 1 }]}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
                <Text style={styles.saveText}>
                  {saving ? 'Сохранение...' : editingProject ? 'Сохранить изменения' : 'Создать проект'}
                </Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
    alignItems: 'center',
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
    marginTop: 2,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  createBtn: {
    minHeight: 44,
    borderRadius: 16,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  metricsGrid: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 22,
    padding: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  metricTitle: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '800',
  },
  filtersCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 12,
    gap: 10,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
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
  statusRow: {
    gap: 8,
    paddingRight: 8,
  },
  filterChip: {
    minHeight: 39,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '900',
  },
  applyBtn: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  applyText: {
    fontSize: 13,
    fontWeight: '900',
  },
  centerBox: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 22,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
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
  emptyBtn: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 17,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  projectList: {
    gap: 12,
  },
  projectCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 14,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 15,
    elevation: 2,
  },
  projectTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  projectMark: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  projectTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
  },
  editIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  projectDescription: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  progressBox: {
    marginTop: 13,
    borderRadius: 18,
    padding: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '900',
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '900',
  },
  progressTrack: {
    marginTop: 9,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressHint: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '800',
  },
  projectFooter: {
    marginTop: 13,
    gap: 12,
  },
  peopleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  peopleLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  peopleText: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '800',
  },
  footerPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  footerPill: {
    minHeight: 31,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerPillText: {
    fontSize: 11,
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
