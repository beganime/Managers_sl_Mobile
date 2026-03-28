import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Svg, { Path } from 'react-native-svg';

import ScreenWrapper from '../../components/ScreenWrapper';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import apiClient, { fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

type TaskStatus = 'todo' | 'process' | 'review' | 'done';
type TaskPriority = 'low' | 'medium' | 'high';
type FilterKey = 'all' | 'mine' | 'pinned' | 'done';

type UserMini = {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
};

type TaskItem = {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  is_pinned?: boolean;
  assigned_to?: number | UserMini | null;
  assigned_to_data?: UserMini | null;
  created_by?: number | UserMini | null;
  created_by_data?: UserMini | null;
  client?: number | null;
  deadline?: string | null;
  created_at?: string;
  updated_at?: string;
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  process: 'В работе',
  review: 'Проверка',
  done: 'Готово',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
};

function getAssignedId(task: TaskItem) {
  if (typeof task.assigned_to === 'object') return task.assigned_to?.id ?? null;
  return task.assigned_to ?? task.assigned_to_data?.id ?? null;
}

function getCreatedId(task: TaskItem) {
  if (typeof task.created_by === 'object') return task.created_by?.id ?? null;
  return task.created_by ?? task.created_by_data?.id ?? null;
}

function userNameFromAny(value: any, fallback = 'Не указан') {
  if (!value && value !== 0) return fallback;
  if (typeof value === 'object') {
    const full = [value.first_name, value.last_name].filter(Boolean).join(' ').trim();
    return full || value.email || fallback;
  }
  return `ID ${String(value)}`;
}

function sortTasks(items: TaskItem[], currentUserId?: number) {
  const priorityOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
  const statusOrder: Record<TaskStatus, number> = { process: 0, todo: 1, review: 2, done: 3 };

  return [...items].sort((a, b) => {
    if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;

    const aMine = getAssignedId(a) === currentUserId || getCreatedId(a) === currentUserId;
    const bMine = getAssignedId(b) === currentUserId || getCreatedId(b) === currentUserId;
    if (aMine !== bMine) return aMine ? -1 : 1;

    if (a.status !== b.status) return statusOrder[a.status] - statusOrder[b.status];
    if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority];

    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
}

function ActionSvgIcon({
  name,
  color,
}: {
  name: 'plus' | 'edit' | 'pin' | 'trash' | 'check';
  color: string;
}) {
  const common = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...common} />}
      {name === 'edit' && (
        <>
          <Path d="M4 20h4l10-10-4-4L4 16v4Z" {...common} />
          <Path d="M12.5 5.5l4 4" {...common} />
        </>
      )}
      {name === 'pin' && (
        <>
          <Path d="M9 4h6l-1.5 5 3 3H7.5l3-3L9 4Z" {...common} />
          <Path d="M12 12v8" {...common} />
        </>
      )}
      {name === 'trash' && (
        <>
          <Path d="M4 7h16" {...common} />
          <Path d="M9 7V5h6v2" {...common} />
          <Path d="M7 7l1 12h8l1-12" {...common} />
          <Path d="M10 11v5M14 11v5" {...common} />
        </>
      )}
      {name === 'check' && <Path d="M5 13l4 4L19 7" {...common} />}
    </Svg>
  );
}

export default function TasksScreen() {
  const { theme } = useTheme();
  const { user } = useCurrentUser();

  const isAdmin = !!user && (user.is_superuser || user.is_staff || user.role === 'admin');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Partial<TaskItem>>({
    id: undefined,
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    is_pinned: false,
  });

  const load = useCallback(async () => {
    try {
      const server = await fetchAllPages('tasks/');
      setTasks(sortTasks(server as TaskItem[], user?.id));
    } catch (e) {
      console.log('Tasks load error', e);
      Alert.alert('Ошибка', 'Не удалось загрузить задачи с сервера.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm({
      id: undefined,
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      is_pinned: false,
    });
    setModalOpen(true);
  };

  const openEdit = (task: TaskItem) => {
    setForm({
      id: task.id,
      title: task.title || '',
      description: task.description || '',
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      is_pinned: !!task.is_pinned,
      client: task.client || null,
    });
    setModalOpen(true);
  };

  const canManageTask = useCallback(
    (task: TaskItem) => {
      if (!user) return false;
      if (isAdmin) return true;
      return getAssignedId(task) === user.id || getCreatedId(task) === user.id;
    },
    [isAdmin, user]
  );

  const submit = async () => {
    if (!form.title?.trim()) {
      Alert.alert('Ошибка', 'Название задачи обязательно.');
      return;
    }

    setSaving(true);
    try {
      if (typeof form.id === 'number') {
        await apiClient.patch(`tasks/${form.id}/`, {
          title: form.title.trim(),
          description: form.description?.trim() || '',
          status: form.status,
          priority: form.priority,
          is_pinned: !!form.is_pinned,
          client: form.client || null,
        });
      } else {
        await apiClient.post('tasks/', {
          title: form.title.trim(),
          description: form.description?.trim() || '',
          status: form.status || 'todo',
          priority: form.priority || 'medium',
          is_pinned: !!form.is_pinned,
          assigned_to: user?.id,
          client: form.client || null,
        });
      }

      setModalOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.detail || 'Не удалось сохранить задачу.');
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (task: TaskItem) => {
    if (!canManageTask(task)) {
      Alert.alert('Нет доступа', 'Ты не можешь закреплять чужую задачу.');
      return;
    }

    try {
      await apiClient.patch(`tasks/${task.id}/`, { is_pinned: !task.is_pinned });
      await load();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.detail || 'Не удалось закрепить задачу.');
    }
  };

  const toggleDone = async (task: TaskItem) => {
    if (!canManageTask(task)) {
      Alert.alert('Нет доступа', 'Ты не можешь менять статус чужой задачи.');
      return;
    }

    try {
      await apiClient.patch(`tasks/${task.id}/`, {
        status: task.status === 'done' ? 'todo' : 'done',
      });
      await load();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.detail || 'Не удалось обновить статус задачи.');
    }
  };

  const removeTask = async (task: TaskItem) => {
    if (!canManageTask(task)) {
      Alert.alert('Нет доступа', 'Ты не можешь удалить чужую задачу.');
      return;
    }

    Alert.alert('Удаление', `Удалить задачу "${task.title}"?`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          const prevTasks = tasks;
          setTasks((current) => current.filter((item) => item.id !== task.id));

          try {
            await apiClient.delete(`tasks/${task.id}/`);
          } catch (e: any) {
            setTasks(prevTasks);
            Alert.alert('Ошибка', e?.response?.data?.detail || 'Не удалось удалить задачу.');
          }
        },
      },
    ]);
  };

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const mine = getAssignedId(task) === user?.id || getCreatedId(task) === user?.id;
      const done = task.status === 'done';
      const pinned = !!task.is_pinned;

      if (filter === 'mine' && !mine) return false;
      if (filter === 'done' && !done) return false;
      if (filter === 'pinned' && !pinned) return false;

      if (!q) return true;

      const authorName = userNameFromAny(task.created_by_data || task.created_by, '');
      const assignedName = userNameFromAny(task.assigned_to_data || task.assigned_to, '');

      return (
        String(task.title || '').toLowerCase().includes(q) ||
        String(task.description || '').toLowerCase().includes(q) ||
        authorName.toLowerCase().includes(q) ||
        assignedName.toLowerCase().includes(q)
      );
    });
  }, [filter, search, tasks, user?.id]);

  const renderDeleteAction = (task: TaskItem) => (
    <Pressable onPress={() => removeTask(task)} style={styles.swipeDelete}>
      <ActionSvgIcon name="trash" color="#fff" />
      <Text style={styles.swipeText}>Удалить</Text>
    </Pressable>
  );

  const renderPinAction = (task: TaskItem) => (
    <Pressable
      onPress={() => togglePin(task)}
      style={[styles.swipePin, { backgroundColor: task.is_pinned ? '#8B8FA3' : theme.blue }]}
    >
      <ActionSvgIcon name="pin" color="#fff" />
      <Text style={styles.swipeText}>{task.is_pinned ? 'Открепить' : 'Закрепить'}</Text>
    </Pressable>
  );

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.blue} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={styles.container}
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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Задачи команды</Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>
              Общий серверный портал для всех сотрудников
            </Text>
          </View>

          <Pressable onPress={openCreate} style={[styles.iconButton, { backgroundColor: theme.blue }]}>
            <ActionSvgIcon name="plus" color="#fff" />
          </Pressable>
        </View>

        <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск по задачам"
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          <View style={styles.chipsRow}>
            {[
              { key: 'all', label: 'Все' },
              { key: 'mine', label: 'Мои' },
              { key: 'pinned', label: 'Закреплённые' },
              { key: 'done', label: 'Готово' },
            ].map((item) => {
              const active = filter === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setFilter(item.key as FilterKey)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? theme.blue : theme.surface,
                      borderColor: active ? theme.blue : theme.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '800' }}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.list, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {filteredTasks.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>Задач пока нет.</Text>
          ) : (
            filteredTasks.map((task, index) => {
              const canEdit = canManageTask(task);
              const authorName = userNameFromAny(task.created_by_data || task.created_by, 'Автор не указан');
              const assigneeName = userNameFromAny(task.assigned_to_data || task.assigned_to, 'Исполнитель не указан');

              return (
                <Swipeable
                  key={String(task.id)}
                  overshootLeft={false}
                  overshootRight={false}
                  renderLeftActions={() => (canEdit ? renderDeleteAction(task) : <View />)}
                  renderRightActions={() => (canEdit ? renderPinAction(task) : <View />)}
                >
                  <Pressable
                    onPress={() => canEdit && openEdit(task)}
                    style={[
                      styles.row,
                      {
                        borderBottomColor: theme.divider,
                        borderBottomWidth: index === filteredTasks.length - 1 ? 0 : 1,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <View style={styles.rowHead}>
                        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                          {task.title}
                        </Text>
                        {task.is_pinned ? (
                          <View style={[styles.pinBadge, { backgroundColor: theme.blueSoft }]}>
                            <Text style={[styles.pinBadgeText, { color: theme.blue }]}>PIN</Text>
                          </View>
                        ) : null}
                      </View>

                      {!!task.description && (
                        <Text style={[styles.rowMeta, { color: theme.textSecondary }]} numberOfLines={2}>
                          {task.description}
                        </Text>
                      )}

                      <Text style={[styles.authorText, { color: theme.textSecondary }]}>
                        Автор: {authorName}
                      </Text>
                      <Text style={[styles.authorText, { color: theme.textSecondary }]}>
                        Исполнитель: {assigneeName}
                      </Text>

                      <View style={styles.metaRow}>
                        <View
                          style={[
                            styles.metaBadge,
                            { backgroundColor: task.status === 'done' ? '#EAF8EF' : theme.backgroundSoft },
                          ]}
                        >
                          <Text
                            style={[
                              styles.metaBadgeText,
                              { color: task.status === 'done' ? (theme.success || theme.blue) : theme.textSecondary },
                            ]}
                          >
                            {STATUS_LABELS[task.status]}
                          </Text>
                        </View>

                        <View style={[styles.metaBadge, { backgroundColor: theme.blueSoft }]}>
                          <Text style={[styles.metaBadgeText, { color: theme.blue }]}>
                            {PRIORITY_LABELS[task.priority]}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.rowActions}>
                      {canEdit ? (
                        <Pressable onPress={() => toggleDone(task)} style={styles.actionMiniBtn}>
                          <ActionSvgIcon
                            name="check"
                            color={task.status === 'done' ? (theme.success || theme.blue) : theme.textSecondary}
                          />
                        </Pressable>
                      ) : null}

                      {canEdit ? (
                        <Pressable onPress={() => openEdit(task)} style={styles.actionMiniBtn}>
                          <ActionSvgIcon name="edit" color={theme.blue} />
                        </Pressable>
                      ) : null}
                    </View>
                  </Pressable>
                </Swipeable>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {typeof form.id === 'number' ? 'Редактировать задачу' : 'Новая задача'}
            </Text>

            <TextInput
              value={form.title || ''}
              onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))}
              placeholder="Название задачи"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundSoft }]}
            />

            <TextInput
              value={form.description || ''}
              onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))}
              placeholder="Описание"
              placeholderTextColor={theme.textMuted}
              multiline
              style={[
                styles.input,
                styles.textarea,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundSoft },
              ]}
            />

            <Text style={[styles.label, { color: theme.textSecondary }]}>Статус</Text>
            <View style={styles.optionRow}>
              {(['todo', 'process', 'review', 'done'] as TaskStatus[]).map((status) => {
                const active = form.status === status;
                return (
                  <Pressable
                    key={status}
                    onPress={() => setForm((prev) => ({ ...prev, status }))}
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor: active ? theme.blue : theme.backgroundSoft,
                        borderColor: active ? theme.blue : theme.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '800' }}>
                      {STATUS_LABELS[status]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: theme.textSecondary }]}>Приоритет</Text>
            <View style={styles.optionRow}>
              {(['low', 'medium', 'high'] as TaskPriority[]).map((priority) => {
                const active = form.priority === priority;
                return (
                  <Pressable
                    key={priority}
                    onPress={() => setForm((prev) => ({ ...prev, priority }))}
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor: active ? theme.blue : theme.backgroundSoft,
                        borderColor: active ? theme.blue : theme.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '800' }}>
                      {PRIORITY_LABELS[priority]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setModalOpen(false)}
                style={[styles.secondaryBtn, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Отмена</Text>
              </Pressable>

              <Pressable onPress={submit} style={[styles.primaryBtn, { backgroundColor: theme.blue }]}>
                <Text style={styles.primaryBtnText}>{saving ? 'Сохранение...' : 'Сохранить'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, paddingBottom: 120 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '900' },
  sub: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  searchBox: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  searchInput: { minHeight: 46, fontSize: 15, fontWeight: '600' },

  chipsRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },

  list: { marginTop: 14, borderWidth: 1, borderRadius: 22, overflow: 'hidden' },
  row: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 15, fontWeight: '900', flex: 1 },
  rowMeta: { marginTop: 6, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  authorText: { marginTop: 6, fontSize: 12, fontWeight: '600' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionMiniBtn: { padding: 4 },

  metaRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  metaBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  metaBadgeText: { fontSize: 11, fontWeight: '900' },

  pinBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pinBadgeText: { fontSize: 10, fontWeight: '900' },

  swipeDelete: {
    width: 112,
    backgroundColor: '#E5484D',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  swipePin: {
    width: 126,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  swipeText: { color: '#fff', fontSize: 12, fontWeight: '900' },

  empty: { padding: 16, fontSize: 14, lineHeight: 20 },

  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(7, 12, 20, 0.35)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalCard: { borderWidth: 1, borderRadius: 24, padding: 18 },
  modalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 10,
  },
  textarea: { minHeight: 110, textAlignVertical: 'top' as const },
  label: { marginTop: 14, marginBottom: 8, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  secondaryBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '800' },
  primaryBtn: { flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});