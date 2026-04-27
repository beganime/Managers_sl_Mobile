import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
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

import ScreenWrapper from '../../components/ScreenWrapper';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import apiClient, { extractList, fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

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
};

const STATUSES = [
  { value: '', label: 'Все', icon: 'albums-outline' },
  { value: 'active', label: 'Активные', icon: 'flash-outline' },
  { value: 'paused', label: 'Пауза', icon: 'pause-circle-outline' },
  { value: 'done', label: 'Готовые', icon: 'checkmark-done-outline' },
  { value: 'archived', label: 'Архив', icon: 'archive-outline' },
] as const;

function userName(user?: UserMini | null) {
  if (!user) return '—';
  return user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email;
}

function initials(user?: UserMini | null) {
  const name = userName(user);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function statusText(status?: string) {
  if (status === 'active') return 'Активный';
  if (status === 'paused') return 'Пауза';
  if (status === 'done') return 'Завершён';
  if (status === 'archived') return 'Архив';
  return status || '—';
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

function projectProgress(project: Project) {
  const items = project.items || [];
  const total = items.length;
  const done = items.filter((item) => item.status === 'done').length;
  const percent = total > 0 ? Math.round((done / total) * 100) : project.status === 'done' ? 100 : 0;
  return { total, done, percent };
}

function markdownStyles(theme: any) {
  return {
    body: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '600',
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 6,
    },
    strong: {
      color: theme.text,
      fontWeight: '900',
    },
    bullet_list: {
      marginBottom: 4,
    },
    ordered_list: {
      marginBottom: 4,
    },
    link: {
      color: theme.blue,
      fontWeight: '900',
    },
  };
}

function StatPill({
  label,
  value,
  icon,
  theme,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  theme: any;
}) {
  return (
    <View style={[styles.statPill, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
      <View style={[styles.statIcon, { backgroundColor: theme.blueSoft }]}>
        <Ionicons name={icon} size={18} color={theme.blue} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
      </View>
    </View>
  );
}

function AvatarStack({ users, theme }: { users?: UserMini[]; theme: any }) {
  const visible = (users || []).slice(0, 4);
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
        <View style={[styles.avatarMini, styles.avatarExtra, { backgroundColor: theme.backgroundSoft, borderColor: theme.surface, marginLeft: -8 }]}>
          <Text style={[styles.avatarExtraText, { color: theme.text }]}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

export default function ProjectsScreen() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { theme, themeMode } = useTheme();

  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');
  const dark = themeMode === 'dark';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserMini[]>([]);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [city, setCity] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectCity, setProjectCity] = useState('');
  const [deadline, setDeadline] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);
  const [selectedResponsibles, setSelectedResponsibles] = useState<number[]>([]);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      params.set('offset', '0');
      if (status) params.set('status', status);
      if (city.trim()) params.set('city', city.trim());
      if (search.trim()) params.set('search', search.trim());

      const [projectsRes, usersRes] = await Promise.allSettled([
        apiClient.get(`tasks/projects/?${params.toString()}`),
        fetchAllPages('users/users/?limit=100&offset=0'),
      ]);

      if (projectsRes.status === 'fulfilled') {
        setProjects(extractList(projectsRes.value.data));
      }

      if (usersRes.status === 'fulfilled') {
        setUsers(usersRes.value as UserMini[]);
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить проекты.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setProjectCity(user?.office?.city || '');
    setDeadline('');
    setSelectedParticipants(user?.id ? [Number(user.id)] : []);
    setSelectedResponsibles([]);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const toggleId = (id: number, list: number[], setter: (ids: number[]) => void) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const createProject = async () => {
    if (!title.trim()) {
      Alert.alert('Ошибка', 'Напиши название проекта.');
      return;
    }

    setSaving(true);

    try {
      await apiClient.post('tasks/projects/', {
        title: title.trim(),
        description: description.trim(),
        city: projectCity.trim(),
        status: 'active',
        deadline: deadline.trim() || null,
        participants: selectedParticipants.length ? selectedParticipants : user?.id ? [Number(user.id)] : [],
        responsible_users: selectedResponsibles,
      });

      setModalOpen(false);
      resetForm();
      await load();
      Alert.alert('Готово', 'Проект создан.');
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.response?.data?.title?.[0] || 'Не удалось создать проект.';
      Alert.alert('Ошибка', String(detail));
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    const active = projects.filter((p) => p.status === 'active').length;
    const done = projects.filter((p) => p.status === 'done').length;
    const urgent = projects.filter((p) => {
      const meta = deadlineMeta(p.deadline);
      return meta.tone === 'danger' || meta.tone === 'warning';
    }).length;

    return {
      total: projects.length,
      active,
      done,
      urgent,
    };
  }, [projects]);

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
            <Pressable onPress={openCreate} style={styles.heroAddBtn}>
              <Ionicons name="add" size={22} color="#fff" />
              <Text style={styles.heroAddText}>Проект</Text>
            </Pressable>
          </View>

          <Text style={styles.heroKicker}>ManagerSL Projects</Text>
          <Text style={styles.heroTitle}>Проекты команды</Text>
          <Text style={styles.heroSubtitle}>Планы, задачи, файлы, ответственные и дедлайны в одном месте.</Text>

          <View style={styles.heroStats}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{stats.total}</Text>
              <Text style={styles.heroStatLabel}>Всего</Text>
            </View>
            <View style={styles.heroLine} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{stats.active}</Text>
              <Text style={styles.heroStatLabel}>Активные</Text>
            </View>
            <View style={styles.heroLine} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{stats.urgent}</Text>
              <Text style={styles.heroStatLabel}>Срочные</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.statsGrid}>
          <StatPill label="Завершено" value={stats.done} icon="checkmark-done-outline" theme={theme} />
          <StatPill label="В работе" value={stats.active} icon="flash-outline" theme={theme} />
        </View>

        <View style={[styles.filtersCard, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
          <View style={[styles.searchBox, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
            <Ionicons name="search" size={18} color={theme.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={load}
              placeholder="Найти проект, задачу или описание"
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
                onSubmitEditing={load}
                placeholder="Фильтр по городу"
                placeholderTextColor={theme.textMuted}
                style={[styles.searchInput, { color: theme.text }]}
                returnKeyType="search"
              />
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
            {STATUSES.map((item) => {
              const active = status === item.value;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => setStatus(item.value)}
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: active ? theme.blue : theme.backgroundSoft,
                      borderColor: active ? theme.blue : theme.border,
                    },
                  ]}
                >
                  <Ionicons name={item.icon as any} size={15} color={active ? '#fff' : theme.blue} />
                  <Text style={[styles.statusText, { color: active ? '#fff' : theme.text }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable onPress={load} style={[styles.applyBtn, { backgroundColor: theme.blueSoft }]}>
            <Ionicons name="options-outline" size={17} color={theme.blue} />
            <Text style={[styles.applyText, { color: theme.blue }]}>Обновить список</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={theme.blue} />
          </View>
        ) : projects.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.blueSoft }]}>
              <Ionicons name="folder-open-outline" size={36} color={theme.blue} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Проектов пока нет</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>Создай первый проект и назначь участников. Потом добавим задачи, дедлайны и файлы.</Text>
            <Pressable onPress={openCreate} style={[styles.emptyBtn, { backgroundColor: theme.blue }]}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>Создать проект</Text>
            </Pressable>
          </View>
        ) : (
          projects.map((project) => {
            const progress = projectProgress(project);
            const deadline = deadlineMeta(project.deadline);
            const deadlineColor = deadline.tone === 'danger' ? theme.red : deadline.tone === 'warning' ? '#F59E0B' : theme.blue;

            return (
              <Pressable
                key={project.id}
                onPress={() => router.push({ pathname: '/(app)/project/[id]', params: { id: String(project.id) } } as any)}
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
                  <View style={[styles.projectIcon, { backgroundColor: theme.blueSoft }]}>
                    <Ionicons name={project.is_pinned ? 'pin' : 'folder-open'} size={21} color={theme.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.projectTitle, { color: theme.text }]} numberOfLines={2}>{project.title}</Text>
                    <Text style={[styles.projectMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                      {statusText(project.status)} · {project.city || project.office_city || 'Без города'}
                    </Text>
                  </View>
                  <View style={[styles.deadlineBadge, { backgroundColor: `${deadlineColor}18` }]}>
                    <Ionicons name="time-outline" size={13} color={deadlineColor} />
                    <Text style={[styles.deadlineText, { color: deadlineColor }]}>{deadline.label}</Text>
                  </View>
                </View>

                {!!project.description && (
                  <View style={styles.projectDescription}>
                    <Markdown style={markdownStyles(theme) as any}>{project.description.length > 220 ? `${project.description.slice(0, 220)}...` : project.description}</Markdown>
                  </View>
                )}

                <View style={[styles.progressBox, { backgroundColor: theme.backgroundSoft }]}>
                  <View style={styles.progressTop}>
                    <Text style={[styles.progressLabel, { color: theme.text }]}>Прогресс</Text>
                    <Text style={[styles.progressPercent, { color: theme.blue }]}>{progress.percent}%</Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }]}>
                    <View style={[styles.progressFill, { width: `${progress.percent}%`, backgroundColor: theme.blue }]} />
                  </View>
                  <Text style={[styles.progressHint, { color: theme.textSecondary }]}>
                    {progress.done}/{progress.total} задач выполнено
                  </Text>
                </View>

                <View style={styles.projectFooter}>
                  <View style={styles.projectPeople}>
                    <AvatarStack users={project.responsible_users_data?.length ? project.responsible_users_data : project.participants_data} theme={theme} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.peopleLabel, { color: theme.textSecondary }]}>Ответственные</Text>
                      <Text style={[styles.peopleNames, { color: theme.text }]} numberOfLines={1}>
                        {(project.responsible_users_data || []).map(userName).join(', ') || 'Не назначены'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.projectMiniStats}>
                    <View style={[styles.footerPill, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                      <Ionicons name="checkbox-outline" size={14} color={theme.blue} />
                      <Text style={[styles.footerText, { color: theme.textSecondary }]}>{project.items?.length || 0}</Text>
                    </View>
                    <View style={[styles.footerPill, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                      <Ionicons name="attach-outline" size={14} color={theme.blue} />
                      <Text style={[styles.footerText, { color: theme.textSecondary }]}>{project.attachments?.length || 0}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, { backgroundColor: theme.card || theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Новый проект</Text>
                <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>Создай пространство для задач, файлов и ответственных</Text>
              </View>
              <Pressable onPress={() => setModalOpen(false)} style={[styles.modalClose, { backgroundColor: theme.backgroundSoft }]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Название проекта</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Например: Запуск офиса в Мары"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, { color: theme.text }]}
                />
              </View>

              <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Описание Markdown</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder={'Можно красиво:\n## Цель\n- задача 1\n- задача 2\n**важное**'}
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, styles.textarea, { color: theme.text }]}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.twoInputs}>
                <View style={[styles.inputWrap, styles.halfInput, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Город</Text>
                  <TextInput
                    value={projectCity}
                    onChangeText={setProjectCity}
                    placeholder="Ашхабад"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.input, { color: theme.text }]}
                  />
                </View>

                <View style={[styles.inputWrap, styles.halfInput, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
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

              {users.length > 0 && (
                <>
                  <Text style={[styles.peopleTitle, { color: theme.text }]}>Участники с доступом</Text>
                  <View style={styles.peopleWrap}>
                    {users.map((item) => {
                      const active = selectedParticipants.includes(item.id);
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => toggleId(item.id, selectedParticipants, setSelectedParticipants)}
                          style={[
                            styles.personPill,
                            {
                              backgroundColor: active ? theme.blue : theme.backgroundSoft,
                              borderColor: active ? theme.blue : theme.border,
                            },
                          ]}
                        >
                          <Text style={[styles.personText, { color: active ? '#fff' : theme.text }]}>{userName(item)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={[styles.peopleTitle, { color: theme.text }]}>Ответственные</Text>
                  <View style={styles.peopleWrap}>
                    {users.map((item) => {
                      const active = selectedResponsibles.includes(item.id);
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => toggleId(item.id, selectedResponsibles, setSelectedResponsibles)}
                          style={[
                            styles.personPill,
                            {
                              backgroundColor: active ? theme.blue : theme.backgroundSoft,
                              borderColor: active ? theme.blue : theme.border,
                            },
                          ]}
                        >
                          <Text style={[styles.personText, { color: active ? '#fff' : theme.text }]}>{userName(item)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              <Pressable onPress={createProject} disabled={saving} style={[styles.saveBtn, { backgroundColor: theme.blue, opacity: saving ? 0.65 : 1 }]}>
                {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
                <Text style={styles.saveText}>{saving ? 'Сохранение...' : 'Создать проект'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 26,
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
  heroAddBtn: {
    minHeight: 42,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroAddText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
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
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.84)',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    maxWidth: 320,
  },
  heroStats: {
    marginTop: 20,
    minHeight: 76,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    color: '#fff',
    fontSize: 24,
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
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '800',
  },
  filtersCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 14,
    gap: 10,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 15,
    elevation: 2,
  },
  searchBox: {
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 50,
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
  statusRow: {
    gap: 8,
    paddingVertical: 2,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900',
  },
  applyBtn: {
    height: 46,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    fontSize: 13,
    fontWeight: '900',
  },
  centerBox: {
    paddingVertical: 32,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 26,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  emptySub: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyBtn: {
    marginTop: 8,
    borderRadius: 18,
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  projectCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 16,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  projectTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  projectIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectTitle: {
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
  },
  projectMeta: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  deadlineBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 118,
  },
  deadlineText: {
    fontSize: 10.5,
    fontWeight: '900',
  },
  projectDescription: {
    marginTop: 12,
  },
  progressBox: {
    marginTop: 12,
    borderRadius: 20,
    padding: 12,
  },
  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '900',
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '900',
  },
  progressTrack: {
    height: 9,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressHint: {
    marginTop: 7,
    fontSize: 11.5,
    fontWeight: '700',
  },
  projectFooter: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  projectPeople: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 38,
  },
  avatarMini: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  avatarExtra: {
    borderWidth: 2,
  },
  avatarExtraText: {
    fontSize: 10,
    fontWeight: '900',
  },
  peopleLabel: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  peopleNames: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '900',
  },
  projectMiniStats: {
    flexDirection: 'row',
    gap: 6,
  },
  footerPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '900',
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
    minHeight: 118,
    lineHeight: 21,
  },
  twoInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  peopleTitle: {
    marginTop: 4,
    fontSize: 14,
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