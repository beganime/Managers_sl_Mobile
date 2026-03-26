import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppScreen from '../../components/AppScreen';
import EmptyState from '../../components/EmptyState';
import PremiumCard from '../../components/PremiumCard';
import SectionHeader from '../../components/SectionHeader';
import { STORAGE_KEYS } from '../../src/config/app';
import { createTask, deleteTask, getTasks, updateTask } from '../../src/api/mobile';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useTheme } from '../../src/context/ThemeContext';

type OfflineTask = {
  id: string | number;
  title: string;
  description?: string;
  status: 'todo' | 'process' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  assigned_to?: number;
  _offlineAction?: 'CREATE' | 'UPDATE' | 'DELETE';
  isOffline?: boolean;
};

export default function TasksScreen() {
  const { theme } = useTheme();
  const { user } = useCurrentUser();
  const [tasks, setTasks] = useState<OfflineTask[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const [form, setForm] = useState<OfflineTask>({
    id: '',
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo',
  });

  const readOffline = useCallback(async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.offlineTasks);
    return raw ? JSON.parse(raw) as OfflineTask[] : [];
  }, []);

  const saveOffline = useCallback(async (items: OfflineTask[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.offlineTasks, JSON.stringify(items));
  }, []);

  const load = useCallback(async () => {
    try {
      const [serverTasks, offlineTasks] = await Promise.all([getTasks(), readOffline()]);
      let merged: OfflineTask[] = [...serverTasks];
      offlineTasks.forEach((item) => {
        if (item._offlineAction === 'DELETE') {
          merged = merged.filter((t: any) => t.id !== item.id);
        } else if (item._offlineAction === 'UPDATE') {
          const idx = merged.findIndex((t: any) => t.id === item.id);
          if (idx > -1) merged[idx] = { ...merged[idx], ...item };
          else merged.push(item);
        } else {
          merged.push(item);
        }
      });
      setTasks(merged);
      await AsyncStorage.setItem(STORAGE_KEYS.cachedTasks, JSON.stringify(merged));
      setIsOffline(false);
    } catch {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.cachedTasks);
      setTasks(raw ? JSON.parse(raw) : []);
      setIsOffline(true);
    } finally {
      setRefreshing(false);
    }
  }, [readOffline]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setForm({
      id: '',
      title: '',
      description: '',
      priority: 'medium',
      status: 'todo',
    });
    setModal(true);
  };

  const syncOffline = async () => {
    const queue = await readOffline();
    if (!queue.length) {
      Alert.alert('Синхронизация', 'Очередь пустая, все задачи уже отправлены.');
      return;
    }

    setSaving(true);
    const remaining: OfflineTask[] = [];

    for (const item of queue) {
      try {
        if (item._offlineAction === 'CREATE') {
          await createTask({
            title: item.title,
            description: item.description,
            priority: item.priority,
            status: item.status,
            assigned_to: user?.id,
          });
        } else if (item._offlineAction === 'UPDATE' && typeof item.id === 'number') {
          await updateTask(item.id, {
            title: item.title,
            description: item.description,
            priority: item.priority,
            status: item.status,
          });
        } else if (item._offlineAction === 'DELETE' && typeof item.id === 'number') {
          await deleteTask(item.id);
        }
      } catch {
        remaining.push(item);
      }
    }

    await saveOffline(remaining);
    setSaving(false);
    load();
    Alert.alert('Синхронизация', remaining.length ? 'Часть задач осталась в локальной очереди.' : 'Все локальные задачи отправлены.');
  };

  const submit = async () => {
    if (!form.title.trim()) {
      Alert.alert('Проверь данные', 'Название задачи обязательно.');
      return;
    }

    setSaving(true);
    try {
      if (typeof form.id === 'number') {
        await updateTask(form.id, {
          title: form.title,
          description: form.description,
          priority: form.priority,
          status: form.status,
        });
      } else {
        await createTask({
          title: form.title,
          description: form.description,
          priority: form.priority,
          status: form.status,
          assigned_to: user?.id,
        });
      }
      setModal(false);
      await load();
      setSaving(false);
      return;
    } catch {}

    const queue = await readOffline();
    if (typeof form.id === 'number') {
      const updated: OfflineTask = { ...form, _offlineAction: 'UPDATE', isOffline: true };
      const idx = queue.findIndex((item) => item.id === form.id);
      if (idx > -1) queue[idx] = updated;
      else queue.push(updated);
    } else {
      queue.push({
        ...form,
        id: `temp_${Date.now()}`,
        assigned_to: user?.id,
        _offlineAction: 'CREATE',
        isOffline: true,
      });
    }
    await saveOffline(queue);
    setModal(false);
    setSaving(false);
    await load();
  };

  const onDelete = async (task: OfflineTask) => {
    if (typeof task.id !== 'number') {
      const queue = (await readOffline()).filter((item) => item.id !== task.id);
      await saveOffline(queue);
      load();
      return;
    }

    try {
      await deleteTask(task.id);
      load();
      return;
    } catch {}

    const queue = await readOffline();
    queue.push({ ...task, _offlineAction: 'DELETE', isOffline: true });
    await saveOffline(queue);
    load();
  };

  const grouped = useMemo(() => {
    const active = tasks.filter((t) => t.status !== 'done');
    const done = tasks.filter((t) => t.status === 'done');
    return { active, done };
  }, [tasks]);

  return (
    <AppScreen scroll={false}>
      <View style={{ gap: 16 }}>
        <SectionHeader title="Задачи" subtitle={isOffline ? 'Офлайн-режим и локальная очередь включены' : 'План на сегодня и ближайшие дела'} actionLabel="Новая" onPress={openNew} />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={syncOffline} style={{ flex: 1 }}>
            <PremiumCard style={{ backgroundColor: theme.blueSoft }}>
              <Text style={{ color: theme.text, fontWeight: '900' }}>{saving ? 'Синхронизация…' : 'Синхронизировать'}</Text>
            </PremiumCard>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setRefreshing(true); load(); }} style={{ flex: 1 }}>
            <PremiumCard style={{ backgroundColor: theme.redSoft }}>
              <Text style={{ color: theme.text, fontWeight: '900' }}>Обновить</Text>
            </PremiumCard>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          <SectionHeader title="В работе" />
          {grouped.active.length ? grouped.active.map((task) => (
            <TouchableOpacity
              key={String(task.id)}
              onPress={() => { setForm(task); setModal(true); }}
              onLongPress={() => onDelete(task)}
            >
              <PremiumCard>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>{task.title}</Text>
                {task.description ? <Text style={{ color: theme.textSecondary, marginTop: 6 }}>{task.description}</Text> : null}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                  <Text style={{ color: theme.blue, fontWeight: '800' }}>{task.priority}</Text>
                  <Text style={{ color: task.isOffline ? theme.yellow : theme.textMuted, fontWeight: '700' }}>{task.isOffline ? 'Локально' : task.status}</Text>
                </View>
              </PremiumCard>
            </TouchableOpacity>
          )) : <EmptyState title="Активных задач нет" subtitle="Можно спокойно создать новую или дождаться синхронизации." />}

          {!!grouped.done.length && <SectionHeader title="Завершено" />}
          {grouped.done.slice(0, 8).map((task) => (
            <PremiumCard key={`done-${task.id}`} style={{ opacity: 0.8 }}>
              <Text style={{ color: theme.textSecondary, fontSize: 15, fontWeight: '800' }}>{task.title}</Text>
            </PremiumCard>
          ))}
        </ScrollView>

        <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.overlay }}>
            <PremiumCard style={{ margin: 16, paddingBottom: 24 }}>
              <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900' }}>
                {form.id ? 'Редактировать задачу' : 'Новая задача'}
              </Text>

              <View style={{ gap: 12, marginTop: 18 }}>
                <PremiumCard style={{ padding: 14 }}>
                  <TextInput
                    value={form.title}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))}
                    placeholder="Название задачи"
                    placeholderTextColor={theme.textMuted}
                    style={{ color: theme.text, fontWeight: '700' }}
                  />
                </PremiumCard>

                <PremiumCard style={{ padding: 14 }}>
                  <TextInput
                    value={form.description}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))}
                    placeholder="Описание"
                    placeholderTextColor={theme.textMuted}
                    multiline
                    style={{ color: theme.text, minHeight: 90, textAlignVertical: 'top' }}
                  />
                </PremiumCard>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {(['low', 'medium', 'high'] as const).map((priority) => (
                    <TouchableOpacity key={priority} style={{ flex: 1 }} onPress={() => setForm((prev) => ({ ...prev, priority }))}>
                      <PremiumCard style={{ padding: 14, backgroundColor: form.priority === priority ? theme.blueSoft : theme.surface }}>
                        <Text style={{ color: theme.text, textAlign: 'center', fontWeight: '800' }}>{priority}</Text>
                      </PremiumCard>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => setModal(false)} style={{ flex: 1 }}>
                    <PremiumCard style={{ backgroundColor: theme.redSoft }}>
                      <Text style={{ color: theme.text, textAlign: 'center', fontWeight: '900' }}>Отмена</Text>
                    </PremiumCard>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={submit} style={{ flex: 1 }}>
                    <PremiumCard style={{ backgroundColor: theme.blueSoft }}>
                      <Text style={{ color: theme.text, textAlign: 'center', fontWeight: '900' }}>{saving ? 'Сохраняю…' : 'Сохранить'}</Text>
                    </PremiumCard>
                  </TouchableOpacity>
                </View>
              </View>
            </PremiumCard>
          </View>
        </Modal>
      </View>
    </AppScreen>
  );
}
