import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { CurrentUser } from '../../hooks/useCurrentUser';
import apiClient, { fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import { getToken } from '../../src/utils/storage';
import ScreenWrapper from '../ScreenWrapper';

interface Props {
  user: CurrentUser;
  onRefresh: () => void;
}

function money(v: number) {
  return `$${Math.round(v || 0).toLocaleString('ru-RU')}`;
}

function isMineOrShared(client: any, userId: number) {
  if (!client) return false;
  if (client.manager === userId) return true;
  if (Array.isArray(client.shared_with) && client.shared_with.includes(userId)) return true;
  if (Array.isArray(client.shared_with_data) && client.shared_with_data.some((u: any) => u.id === userId)) return true;
  return false;
}

export default function ManagerDashboard({ user, onRefresh }: Props) {
  const { theme } = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tasks, setTasks] = useState<any[]>([]);
  const [teamTasks, setTeamTasks] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [hasReport, setHasReport] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const cachedOfflineTasks = JSON.parse((await getToken('offline_tasks')) || '[]');

      const [tasksResponse, clientsResponse, reportResponse] = await Promise.allSettled([
        fetchAllPages('tasks/'),
        fetchAllPages('clients/'),
        apiClient.get('reports/daily/today/'),
      ]);

      const serverTasks = tasksResponse.status === 'fulfilled' ? tasksResponse.value : [];
      const serverClients = clientsResponse.status === 'fulfilled' ? clientsResponse.value : [];

      const mergedTasks = [...serverTasks];
      cachedOfflineTasks.forEach((task: any) => {
        const index = mergedTasks.findIndex((x) => x.id === task.id);
        if (task._offlineAction === 'DELETE') {
          if (index > -1) mergedTasks.splice(index, 1);
          return;
        }
        if (index > -1) {
          mergedTasks[index] = { ...mergedTasks[index], ...task };
        } else {
          mergedTasks.push(task);
        }
      });

      const ownTasks = mergedTasks
        .filter((t) => {
          const assignedId =
            typeof t.assigned_to === 'object' ? t.assigned_to?.id : t.assigned_to;
          return assignedId === user.id;
        })
        .sort((a, b) => String(a.status).localeCompare(String(b.status)));

      const visibleTeamTasks = mergedTasks
        .filter((t) => {
          const assignedId =
            typeof t.assigned_to === 'object' ? t.assigned_to?.id : t.assigned_to;
          return assignedId !== user.id;
        })
        .slice(0, 5);

      const myClients = serverClients.filter((c) => isMineOrShared(c, user.id)).slice(0, 5);

      setTasks(ownTasks);
      setTeamTasks(visibleTeamTasks);
      setClients(myClients);
      setHasReport(reportResponse.status === 'fulfilled' && !!reportResponse.value?.data);
    } catch (e) {
      console.log('Manager dashboard load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.id]);

  useEffect(() => {
    load();
  }, [load]);

  const revenue = useMemo(
    () => parseFloat(String(user.managersalary?.current_month_revenue || 0)),
    [user.managersalary]
  );

  const plan = useMemo(
    () => parseFloat(String(user.managersalary?.monthly_plan || 0)),
    [user.managersalary]
  );

  const balance = useMemo(
    () => parseFloat(String(user.managersalary?.current_balance || 0)),
    [user.managersalary]
  );

  const progress = plan > 0 ? Math.min(Math.round((revenue / plan) * 100), 100) : 0;

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
      <LinearGradient colors={theme.gradientMain as [string, string, ...string[]]} style={StyleSheet.absoluteFillObject} />

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
              onRefresh();
            }}
            tintColor={theme.blue}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <View>
            <Text style={[styles.caption, { color: theme.textSecondary }]}>Менеджер</Text>
            <Text style={[styles.title, { color: theme.text }]}>
              {user.first_name} {user.last_name}
            </Text>
          </View>

          <Pressable onPress={() => setFabOpen(true)} style={[styles.fabMini, { backgroundColor: theme.surface }]}>
            <Text style={[styles.fabMiniText, { color: theme.blue }]}>＋</Text>
          </Pressable>
        </View>

        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(revenue)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Выручка за месяц</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(balance)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Бонусный баланс</Text>
          </View>
        </View>

        <View style={[styles.progressCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.progressRow}>
            <Text style={[styles.progressTitle, { color: theme.text }]}>План</Text>
            <Text style={[styles.progressValue, { color: theme.blue }]}>{progress}%</Text>
          </View>
          <View style={[styles.progressBarBg, { backgroundColor: theme.backgroundSoft }]}>
            <View style={[styles.progressBarFill, { backgroundColor: theme.blue, width: `${progress}%` }]} />
          </View>
          <Text style={[styles.progressSub, { color: theme.textSecondary }]}>
            {money(revenue)} из {money(plan)}
          </Text>
        </View>

        <Text style={[styles.section, { color: theme.text }]}>Мои задачи</Text>
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {tasks.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>Нет задач. Можно работать оффлайн и добавить их в разделе “Задачи”.</Text>
          ) : (
            tasks.slice(0, 7).map((task) => (
              <Pressable
                key={String(task.id)}
                onPress={() => router.push('/tasks' as any)}
                style={[styles.row, { borderBottomColor: theme.divider }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                    {task.title}
                  </Text>
                  <Text style={[styles.rowMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {task.description || 'Без описания'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor:
                        task.status === 'done'
                          ? '#E9F8EF'
                          : task.status === 'process'
                          ? '#EEF4FF'
                          : '#FFF5E6',
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
                            : theme.warning,
                      },
                    ]}
                  >
                    {task.status === 'done' ? 'Готово' : task.status === 'process' ? 'В работе' : 'To do'}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>

        <Text style={[styles.section, { color: theme.text }]}>Общий список команды</Text>
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {teamTasks.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>Пока нет видимых общих задач.</Text>
          ) : (
            teamTasks.map((task) => {
              const author =
                typeof task.assigned_to === 'object'
                  ? `${task.assigned_to?.first_name || ''} ${task.assigned_to?.last_name || ''}`.trim()
                  : `ID ${task.assigned_to}`;
              return (
                <Pressable
                  key={`team-${task.id}`}
                  onPress={() => router.push('/tasks' as any)}
                  style={[styles.row, { borderBottomColor: theme.divider }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                      {task.title}
                    </Text>
                    <Text style={[styles.rowMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                      {task.description || 'Без заметки'} · {author || 'Автор не указан'}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        <Text style={[styles.section, { color: theme.text }]}>Мои клиенты</Text>
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {clients.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>Нет клиентов в видимой базе.</Text>
          ) : (
            clients.map((client) => (
              <Pressable
                key={client.id}
                onPress={() => router.push(`/client/${client.id}` as any)}
                style={[styles.row, { borderBottomColor: theme.divider }]}
              >
                <View>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>{client.full_name}</Text>
                  <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                    {client.phone || 'Без телефона'} · {client.city || 'Без города'}
                  </Text>
                </View>
                <Text style={[styles.rowValue, { color: theme.blue }]}>{client.status || 'new'}</Text>
              </Pressable>
            ))
          )}
        </View>

        <View style={[styles.reportCard, { backgroundColor: hasReport ? '#EAF8EF' : theme.redSoft, borderColor: theme.border }]}>
          <Text style={[styles.reportTitle, { color: theme.text }]}>
            {hasReport ? 'Отчёт за сегодня уже отправлен' : 'Отчёт за сегодня ещё не отправлен'}
          </Text>
          <Pressable onPress={() => router.push('/profile' as any)}>
            <Text style={[styles.reportAction, { color: hasReport ? theme.success : theme.red }]}>
              {hasReport ? 'Проверить' : 'Открыть и заполнить'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={fabOpen} transparent animationType="fade" onRequestClose={() => setFabOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setFabOpen(false)}>
          <View style={[styles.fabMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable onPress={() => { setFabOpen(false); router.push('/payment/create' as any); }} style={styles.fabAction}>
              <Text style={[styles.fabActionText, { color: theme.text }]}>Быстрый доход / платёж</Text>
            </Pressable>
            <Pressable onPress={() => { setFabOpen(false); router.push('/tasks' as any); }} style={styles.fabAction}>
              <Text style={[styles.fabActionText, { color: theme.text }]}>Быстрая заметка / задача</Text>
            </Pressable>
            <Pressable onPress={() => { setFabOpen(false); router.push('/add-client' as any); }} style={styles.fabAction}>
              <Text style={[styles.fabActionText, { color: theme.text }]}>Добавить клиента</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, paddingBottom: 120 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  caption: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '900', marginTop: 4 },
  fabMini: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabMiniText: { fontSize: 24, fontWeight: '900', marginTop: -2 },
  kpiGrid: { flexDirection: 'row', gap: 12, marginTop: 22 },
  kpiCard: { flex: 1, borderRadius: 22, borderWidth: 1, padding: 18 },
  kpiValue: { fontSize: 22, fontWeight: '900' },
  kpiLabel: { marginTop: 8, fontSize: 13, fontWeight: '700' },
  progressCard: { marginTop: 14, borderRadius: 22, borderWidth: 1, padding: 18 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle: { fontSize: 15, fontWeight: '900' },
  progressValue: { fontSize: 14, fontWeight: '900' },
  progressBarBg: { marginTop: 12, height: 10, borderRadius: 999, overflow: 'hidden' },
  progressBarFill: { height: 10, borderRadius: 999 },
  progressSub: { marginTop: 10, fontSize: 13, fontWeight: '700' },
  section: { fontSize: 18, fontWeight: '900', marginTop: 24, marginBottom: 12 },
  panel: { borderWidth: 1, borderRadius: 22, overflow: 'hidden' },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowMeta: { marginTop: 4, fontSize: 12, fontWeight: '600' },
  rowValue: { fontSize: 13, fontWeight: '900' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusText: { fontSize: 12, fontWeight: '900' },
  empty: { padding: 16, fontSize: 14, lineHeight: 20 },
  reportCard: { marginTop: 20, borderWidth: 1, borderRadius: 22, padding: 16 },
  reportTitle: { fontSize: 15, fontWeight: '900' },
  reportAction: { marginTop: 8, fontSize: 14, fontWeight: '900' },
  modalBg: { flex: 1, backgroundColor: 'rgba(10,20,30,0.28)', justifyContent: 'flex-end', padding: 20 },
  fabMenu: { borderRadius: 24, borderWidth: 1, paddingVertical: 8, marginBottom: 90 },
  fabAction: { paddingHorizontal: 16, paddingVertical: 16 },
  fabActionText: { fontSize: 15, fontWeight: '800' },
});