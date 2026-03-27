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

import ScreenWrapper from '../../components/ScreenWrapper';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import apiClient, { fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import { getToken, saveToken } from '../../src/utils/storage';

type TaskStatus = 'todo' | 'process' | 'review' | 'done';
type TaskPriority = 'low' | 'medium' | 'high';
type FilterKey = 'all' | 'mine' | 'done' | 'offline';

type TaskItem = {
  id: number | string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to?: number | { id: number; first_name?: string; last_name?: string; email?: string } | null;
  assigned_to_data?: { id: number; first_name?: string; last_name?: string; email?: string } | null;
  created_by?: number | { id: number; first_name?: string; last_name?: string; email?: string } | null;
  created_by_data?: { id: number; first_name?: string; last_name?: string; email?: string } | null;
  client?: number | null;
  created_at?: string;
  updated_at?: string;
  isOffline?: boolean;
  _offlineAction?: 'CREATE' | 'UPDATE' | 'DELETE';
};

const OFFLINE_KEY = 'offline_tasks';
const CACHE_KEY = 'cache_tasks';

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
  if (typeof task.assigned_to === 'object') return task.assigned_to?.id;
  return task.assigned_to ?? task.assigned_to_data?.id ?? null;
}

function userNameFromAny(
  value: any,
  usersMap: Record<string, any>,
  fallback = 'Не указан'
) {
  if (!value && value !== 0) return fallback;

  if (typeof value === 'object') {
    const full = [value.first_name, value.last_name].filter(Boolean).join(' ').trim();
    return full || value.email || fallback;
  }

  const mapped = usersMap[String(value)];
  if (mapped) {
    return (
      [mapped.first_name, mapped.last_name].filter(Boolean).join(' ').trim() ||
      mapped.email ||
      fallback
    );
  }

  return `ID ${String(value)}`;
}

function mergeTasks(serverTasks: TaskItem[], offlineTasks: TaskItem[]) {
  const merged = [...serverTasks];

  offlineTasks.forEach((item) => {
    const index = merged.findIndex((x) => String(x.id) === String(item.id));

    if (item._offlineAction === 'DELETE') {
      if (index > -1) merged.splice(index, 1);
      return;
    }

    if (index > -1) {
      merged[index] = { ...merged[index], ...item, isOffline: true };
    } else {
      merged.push({ ...item, isOffline: true });
    }
  });

  return merged;
}

export default function TasksScreen() {
  const { theme } = useTheme();
  const { user } = useCurrentUser();

  const isAdmin = !!user && (user.is_superuser || user.is_staff || user.role === 'admin');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<TaskItem[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('mine');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<TaskItem>({
    id: '',
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
  });

  const readOfflineQueue = useCallback(async () => {
    try {
      const raw = await getToken(OFFLINE_KEY);
      return raw ? (JSON.parse(raw) as TaskItem[]) : [];
    } catch {
      return [];
    }
  }, []);

  const saveOfflineQueue = useCallback(async (items: TaskItem[]) => {
    setOfflineQueue(items);
    await saveToken(OFFLINE_KEY, JSON.stringify(items));
  }, []);

  const load = useCallback(async () => {
    try {
      const queue = await readOfflineQueue();

      let usersLookup: Record<string, any> = {};
      try {
        const users = await fetchAllPages('users/users/');
        usersLookup = (users || []).reduce((acc: any, item: any) => {
          acc[String(item.id)] = item;
          return acc;
        }, {});
        setUsersMap(usersLookup);
      } catch {
        setUsersMap({});
      }

      try {
        const server = await fetchAllPages('tasks/');
        const merged = mergeTasks(server as TaskItem[], queue);
        setTasks(merged);
        setOfflineQueue(queue);
        await saveToken(CACHE_KEY, JSON.stringify(merged));
      } catch {
        const cached = await getToken(CACHE_KEY);
        setTasks(cached ? JSON.parse(cached) : []);
        setOfflineQueue(queue);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [readOfflineQueue]);

  useEffect(() => {
    load();
  }, [load]);

  const syncOffline = useCallback(async () => {
    const queue = await readOfflineQueue();

    if (!queue.length) {
      Alert.alert('Синхронизация', 'Локальная очередь пустая.');
      return;
    }

    setSaving(true);
    const remaining: TaskItem[] = [];

    for (const item of queue) {
      try {
        if (item._offlineAction === 'CREATE') {
          await apiClient.post('tasks/', {
            title: item.title,
            description: item.description,
            status: item.status,
            priority: item.priority,
            assigned_to: user?.id,
            client: item.client || null,
          });
        } else if (item._offlineAction === 'UPDATE' && typeof item.id === 'number') {
          await apiClient.patch(`tasks/${item.id}/`, {
            title: item.title,
            description: item.description,
            status: item.status,
            priority: item.priority,
            client: item.client || null,
          });
        } else if (item._offlineAction === 'DELETE' && typeof item.id === 'number') {
          await apiClient.delete(`tasks/${item.id}/`);
        }
      } catch {
        remaining.push(item);
      }
    }

    await saveOfflineQueue(remaining);
    setSaving(false);
    await load();

    Alert.alert(
      'Синхронизация',
      remaining.length ? 'Часть задач осталась в локальной очереди.' : 'Все локальные задачи отправлены.'
    );
  }, [load, readOfflineQueue, saveOfflineQueue, user?.id]);

  const openCreate = () => {
    setForm({
      id: '',
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
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
      assigned_to: getAssignedId(task) || undefined,
      client: task.client || null,
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.title.trim()) {
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
          client: form.client || null,
        });
      } else {
        await apiClient.post('tasks/', {
          title: form.title.trim(),
          description: form.description?.trim() || '',
          status: form.status,
          priority: form.priority,
          assigned_to: user?.id,
          client: form.client || null,
        });
      }

      setSaving(false);
      setModalOpen(false);
      await load();
      return;
    } catch {}

    const queue = await readOfflineQueue();

    if (typeof form.id === 'number') {
      const draft: TaskItem = {
        ...form,
        assigned_to: user?.id,
        created_by: user?.id,
        _offlineAction: 'UPDATE',
        isOffline: true,
      };
      const index = queue.findIndex((x) => String(x.id) === String(form.id));
      if (index > -1) queue[index] = draft;
      else queue.push(draft);
    } else {
      queue.push({
        ...form,
        id: `temp_${Date.now()}`,
        assigned_to: user?.id,
        created_by: user?.id,
        _offlineAction: 'CREATE',
        isOffline: true,
      });
    }

    await saveOfflineQueue(queue);
    setSaving(false);
    setModalOpen(false);
    await load();
  };

  const removeTask = async (task: TaskItem) => {
    Alert.alert('Удаление', `Удалить задачу "${task.title}"?`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          if (typeof task.id !== 'number') {
            const queue = (await readOfflineQueue()).filter((x) => String(x.id) !== String(task.id));
            await saveOfflineQueue(queue);
            await load();
            return;
          }

          try {
            await apiClient.delete(`tasks/${task.id}/`);
            await load();
            return;
          } catch {}

          const queue = await readOfflineQueue();
          const exists = queue.find((x) => String(x.id) === String(task.id) && x._offlineAction === 'DELETE');
          if (!exists) {
            queue.push({ ...task, _offlineAction: 'DELETE', isOffline: true });
            await saveOfflineQueue(queue);
          }
          await load();
        },
      },
    ]);
  };

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const mine = getAssignedId(task) === user?.id;
      const done = task.status === 'done';
      const offline = !!task.isOffline || !!task._offlineAction;

      if (filter === 'mine' && !mine && !isAdmin) return false;
      if (filter === 'done' && !done) return false;
      if (filter === 'offline' && !offline) return false;

      if (!q) return true;

      const createdByName = userNameFromAny(task.created_by_data || task.created_by, usersMap, '');
      const assignedName = userNameFromAny(task.assigned_to_data || task.assigned_to, usersMap, '');

      return (
        String(task.title || '').toLowerCase().includes(q) ||
        String(task.description || '').toLowerCase().includes(q) ||
        createdByName.toLowerCase().includes(q) ||
        assignedName.toLowerCase().includes(q)
      );
    });
  }, [filter, isAdmin, search, tasks, user?.id, usersMap]);

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
            <Text style={[styles.title, { color: theme.text }]}>Задачи</Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>
              Оффлайн очередь: {offlineQueue.length}
            </Text>
          </View>

          <View style={styles.headActions}>
            <Pressable
              onPress={syncOffline}
              style={[
                styles.ghostBtn,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.ghostBtnText, { color: theme.blue }]}>
                {saving ? '...' : 'Sync'}
              </Text>
            </Pressable>

            <Pressable onPress={openCreate} style={[styles.primaryBtn, { backgroundColor: theme.blue }]}>
              <Text style={styles.primaryBtnText}>+ Задача</Text>
            </Pressable>
          </View>
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
              { key: 'done', label: 'Готово' },
              { key: 'offline', label: 'Локальные' },
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
            filteredTasks.map((task) => {
              const mine = getAssignedId(task) === user?.id;
              const canEdit = isAdmin || mine || typeof task.id !== 'number';

              const authorName = userNameFromAny(
                task.created_by_data || task.created_by,
                usersMap,
                typeof task.id === 'string' ? fullOfflineAuthor() : 'Автор не указан'
              );

              const assigneeName = userNameFromAny(
                task.assigned_to_data || task.assigned_to,
                usersMap,
                'Исполнитель не указан'
              );

              return (
                <Pressable
                  key={String(task.id)}
                  onPress={() => canEdit && openEdit(task)}
                  onLongPress={() => canEdit && removeTask(task)}
                  style={[styles.row, { borderBottomColor: theme.divider }]}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                      {task.title}
                    </Text>

                    {!!task.description && (
                      <Text
                        style={[styles.rowMeta, { color: theme.textSecondary }]}
                        numberOfLines={2}
                      >
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
                          styles.statusPill,
                          {
                            backgroundColor:
                              task.status === 'done'
                                ? '#EAF8EF'
                                : task.status === 'process'
                                ? '#EEF4FF'
                                : task.status === 'review'
                                ? '#FFF4E8'
                                : '#F4F6FA',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            {
                              color:
                                task.status === 'done'
                                  ? theme.success
                                  : task.status === 'process'
                                  ? theme.blue
                                  : task.status === 'review'
                                  ? theme.warning
                                  : theme.textSecondary,
                            },
                          ]}
                        >
                          {STATUS_LABELS[task.status]}
                        </Text>
                      </View>

                      <View style={[styles.priorityPill, { borderColor: theme.border }]}>
                        <Text style={[styles.priorityText, { color: theme.textSecondary }]}>
                          {PRIORITY_LABELS[task.priority]}
                        </Text>
                      </View>

                      {(task.isOffline || task._offlineAction) && (
                        <View style={[styles.offlinePill, { backgroundColor: theme.redSoft }]}>
                          <Text style={[styles.offlineText, { color: theme.red }]}>Offline</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {canEdit ? (
                    <Text style={[styles.editHint, { color: theme.blue }]}>Открыть</Text>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {typeof form.id === 'number' ? 'Редактировать задачу' : 'Новая задача'}
            </Text>

            <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
              <TextInput
                value={form.title}
                onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))}
                placeholder="Название задачи"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text }]}
              />
            </View>

            <View
              style={[
                styles.inputWrap,
                { backgroundColor: theme.backgroundSoft, borderColor: theme.border, minHeight: 100 },
              ]}
            >
              <TextInput
                value={form.description}
                onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))}
                placeholder="Описание / заметка"
                placeholderTextColor={theme.textMuted}
                multiline
                style={[
                  styles.input,
                  { color: theme.text, minHeight: 76, textAlignVertical: 'top' },
                ]}
              />
            </View>

            <Text style={[styles.modalSection, { color: theme.text }]}>Статус</Text>
            <View style={styles.chipsWrap}>
              {(['todo', 'process', 'review', 'done'] as TaskStatus[]).map((status) => {
                const active = form.status === status;
                return (
                  <Pressable
                    key={status}
                    onPress={() => setForm((prev) => ({ ...prev, status }))}
                    style={[
                      styles.formChip,
                      {
                        backgroundColor: active ? theme.blue : theme.surface,
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

            <Text style={[styles.modalSection, { color: theme.text }]}>Приоритет</Text>
            <View style={styles.chipsWrap}>
              {(['low', 'medium', 'high'] as TaskPriority[]).map((priority) => {
                const active = form.priority === priority;
                return (
                  <Pressable
                    key={priority}
                    onPress={() => setForm((prev) => ({ ...prev, priority }))}
                    style={[
                      styles.formChip,
                      {
                        backgroundColor: active ? theme.red : theme.surface,
                        borderColor: active ? theme.red : theme.border,
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
                style={[styles.modalBtn, { backgroundColor: theme.backgroundSoft }]}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Отмена</Text>
              </Pressable>

              <Pressable onPress={submit} style={[styles.modalBtn, { backgroundColor: theme.blue }]}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                  {saving ? 'Сохраняю...' : 'Сохранить'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );

  function fullOfflineAuthor() {
    return [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.email || 'Вы';
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, paddingBottom: 120 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '900' },
  sub: { marginTop: 6, fontSize: 13, fontWeight: '700' },
  ghostBtn: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  ghostBtnText: { fontWeight: '900' },
  primaryBtn: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '900' },
  searchBox: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, marginTop: 18 },
  searchInput: { fontSize: 15, fontWeight: '600' },
  chipsRow: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  list: { marginTop: 16, borderWidth: 1, borderRadius: 22, overflow: 'hidden' },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '900' },
  rowMeta: { marginTop: 6, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  authorText: { marginTop: 6, fontSize: 12, fontWeight: '700' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusText: { fontSize: 12, fontWeight: '900' },
  priorityPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  priorityText: { fontSize: 12, fontWeight: '800' },
  offlinePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  offlineText: { fontSize: 12, fontWeight: '900' },
  editHint: { fontSize: 13, fontWeight: '900' },
  empty: { padding: 18, fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8,18,28,0.35)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: { borderWidth: 1, borderRadius: 24, padding: 18 },
  modalTitle: { fontSize: 20, fontWeight: '900', marginBottom: 14 },
  inputWrap: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  input: { fontSize: 15, fontWeight: '600' },
  modalSection: { fontSize: 15, fontWeight: '900', marginTop: 4, marginBottom: 10 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  formChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 14 },
  modalBtnText: { fontWeight: '900', fontSize: 15 },
});