// components/dashboard/ManagerDashboard.tsx
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import * as Device from 'expo-device';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Easing,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import RenderHtml from 'react-native-render-html';

import { CurrentUser } from '../../hooks/useCurrentUser';
import apiClient from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import { getToken, saveToken } from '../../src/utils/storage';
import ScreenWrapper from '../ScreenWrapper';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge:  true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

const { width } = Dimensions.get('window');

interface Props {
    user:      CurrentUser;
    onRefresh: () => void;
}

export default function ManagerDashboard({ user, onRefresh }: Props) {
    const router           = useRouter();
    const { theme }        = useTheme();
    const { width: cw }    = useWindowDimensions();
    const s                = makeStyles(theme);

    const [tasks,         setTasks]         = useState<any[]>([]);
    const [leads,         setLeads]         = useState<any[]>([]);
    const [dealsList,     setDealsList]     = useState<any[]>([]);
    const [shiftActive,   setShiftActive]   = useState(false);
    const [hasReport,     setHasReport]     = useState(false);
    const [loading,       setLoading]       = useState(true);
    const [refreshing,    setRefreshing]    = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [syncing,       setSyncing]       = useState(false);

    const [activeModal, setActiveModal] = useState<'report' | 'payment' | 'add_task' | 'edit_task' | null>(null);
    const [selectedTasks, setSelectedTasks] = useState<(number | string)[]>([]);

    const [formReport, setFormReport] = useState({ content: '', leads: '', deals: '' });
    const [formTask,   setFormTask]   = useState({ id: '', title: '', description: '', priority: 'medium', status: 'todo' });
    const [taskDeadline,  setTaskDeadline]  = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [formPayment, setFormPayment] = useState({ deal: '', amount: '', currency: 1, method: 'cash' });

    const moveAnim = useRef(new Animated.Value(0)).current;

    // ── Анимация фона ─────────────────────────────────────────────────────
    useEffect(() => {
        // Push-разрешения
        if (Device.isDevice) {
            Notifications.getPermissionsAsync().then(({ status }) => {
                if (status !== 'granted') Notifications.requestPermissionsAsync();
            });
        }

        Animated.loop(
            Animated.timing(moveAnim, {
                toValue: 1, duration: 35000,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: false,
            })
        ).start();
    }, []);

    const orb1X = moveAnim.interpolate({ inputRange: [0, 1], outputRange: [-100, 100] });
    const orb2Y = moveAnim.interpolate({ inputRange: [0, 1], outputRange: [50, -50] });

    // ── Офлайн-задачи ─────────────────────────────────────────────────────
    const getOfflineTasks  = async () => JSON.parse((await getToken('offline_tasks'))  || '[]');
    const saveOfflineTasks = async (arr: any[]) => saveToken('offline_tasks', JSON.stringify(arr));

    const syncOfflineTasks = async (silent = true) => {
        if (!silent) setSyncing(true);
        const offline = await getOfflineTasks();
        if (!offline.length) {
            if (!silent) { Alert.alert('Синхронизация', 'Все данные актуальны.'); setSyncing(false); }
            return;
        }
        let remaining: any[] = [], synced = 0;
        for (const t of offline) {
            try {
                if      (t._offlineAction === 'CREATE') await apiClient.post('tasks/', { title: t.title, description: t.description, priority: t.priority, status: t.status, assigned_to: t.assigned_to, deadline: t.deadline || null });
                else if (t._offlineAction === 'UPDATE') await apiClient.patch(`tasks/${t.id}/`, { title: t.title, description: t.description, priority: t.priority, status: t.status, deadline: t.deadline || null });
                else if (t._offlineAction === 'DELETE') await apiClient.delete(`tasks/${t.id}/`);
                synced++;
            } catch (e: any) {
                if (e.response?.status === 404) synced++;
                else remaining.push(t);
            }
        }
        await saveOfflineTasks(remaining);
        if (!silent) {
            setSyncing(false);
            if (synced > 0) Alert.alert('Успешно', `Синхронизировано: ${synced}`);
            else Alert.alert('Ошибка', 'Нет связи с сервером.');
        }
        fetchData(false);
    };

    // ── Загрузка данных ───────────────────────────────────────────────────
    const fetchData = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const [tasksRes, leadsRes, shiftRes, reportRes] = await Promise.allSettled([
                apiClient.get('tasks/'),
                apiClient.get('leads/mobile/'),
                apiClient.get('timetracking/shifts/current/'),
                apiClient.get('reports/daily/today/'),
            ]);

            if (leadsRes.status === 'fulfilled')
                setLeads(leadsRes.value.data.results ?? leadsRes.value.data);

            setShiftActive(shiftRes.status === 'fulfilled' && shiftRes.value.data.is_active);
            setHasReport(reportRes.status === 'fulfilled' && !!reportRes.value.data.id);

            const serverTasks = tasksRes.status === 'fulfilled'
                ? (tasksRes.value.data.results ?? tasksRes.value.data) : [];
            const offline = await getOfflineTasks();

            let merged = [...serverTasks];
            offline.forEach((ot: any) => {
                if      (ot._offlineAction === 'DELETE') merged = merged.filter(t => t.id !== ot.id);
                else if (ot._offlineAction === 'UPDATE') { const i = merged.findIndex(t => t.id === ot.id); if (i > -1) merged[i] = { ...merged[i], ...ot }; else merged.push(ot); }
                else if (ot._offlineAction === 'CREATE') merged.push(ot);
            });

            if (user.id) {
                merged = merged.filter(t =>
                    t.assigned_to === user.id ||
                    (typeof t.assigned_to === 'object' && t.assigned_to?.id === user.id)
                );
            }
            setTasks(merged);
        } catch { console.log('Ошибка загрузки дашборда'); }
        finally { setLoading(false); setRefreshing(false); }
    }, [user.id]);

    useEffect(() => { fetchData(); }, []);

    // ── Действия ──────────────────────────────────────────────────────────
    const openModal = (type: typeof activeModal, taskData?: any) => {
        if (type === 'add_task') { setFormTask({ id: '', title: '', description: '', priority: 'medium', status: 'todo' }); setTaskDeadline(null); }
        if (type === 'edit_task' && taskData) { setFormTask({ ...taskData }); setTaskDeadline(taskData.deadline ? new Date(taskData.deadline) : null); }
        if (type === 'payment' && !dealsList.length)
            apiClient.get('analytics/deals/').then(r => setDealsList(r.data.results ?? r.data));
        setActiveModal(type);
    };

    const toggleSelect = (id: number | string) =>
        setSelectedTasks(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

    const handleBatch = async (action: 'done' | 'delete') => {
        Alert.alert('Подтверждение', 'Вы уверены?', [
            { text: 'Отмена', style: 'cancel' },
            { text: 'Да', onPress: async () => {
                setLoading(true);
                let offline = await getOfflineTasks();
                for (const id of selectedTasks) {
                    try {
                        if (action === 'done')   await apiClient.patch(`tasks/${id}/`, { status: 'done' });
                        if (action === 'delete')  await apiClient.delete(`tasks/${id}/`);
                    } catch {
                        if (typeof id === 'string' && id.startsWith('temp_')) {
                            if (action === 'delete') offline = offline.filter((t: any) => t.id !== id);
                            if (action === 'done')   { const i = offline.findIndex((t: any) => t.id === id); if (i > -1) offline[i].status = 'done'; }
                        } else {
                            const i = offline.findIndex((t: any) => t.id === id);
                            const base = tasks.find(t => t.id === id) ?? {};
                            if (action === 'delete') { if (i > -1) offline[i]._offlineAction = 'DELETE'; else offline.push({ id, _offlineAction: 'DELETE' }); }
                            if (action === 'done')   { if (i > -1) { offline[i].status = 'done'; offline[i]._offlineAction = 'UPDATE'; } else offline.push({ ...base, status: 'done', _offlineAction: 'UPDATE', isOffline: true }); }
                        }
                    }
                }
                await saveOfflineTasks(offline);
                setSelectedTasks([]);
                fetchData(false);
            }},
        ]);
    };

    const handleShiftToggle = async () => {
        if (!shiftActive) {
            try { await apiClient.post('timetracking/shifts/', {}); setShiftActive(true); }
            catch (e: any) { if (e.response?.status === 400) setShiftActive(true); }
        } else {
            if (!hasReport) {
                Alert.alert('Внимание', 'Сначала отправьте отчёт!', [
                    { text: 'Написать', onPress: () => setActiveModal('report') },
                    { text: 'Отмена' },
                ]);
                return;
            }
            try { await apiClient.patch('timetracking/shifts/current/'); setShiftActive(false); } catch {}
        }
    };

    const handleTakeLead = async (id: number) => {
        try { await apiClient.patch(`leads/mobile/${id}/`, { status: 'contacted' }); fetchData(); } catch {}
    };

    const scheduleNotification = async (title: string, desc: string, date: Date | null) => {
        if (!date || date <= new Date()) return;
        try {
            await Notifications.scheduleNotificationAsync({
                content: { title: `⏰ ${title}`, body: desc.replace(/<[^>]+>/g, '') || 'Пора выполнить!', sound: true },
                trigger: date,
            });
        } catch {}
    };

    const submitForm = async (type: string) => {
        setSubmitLoading(true);
        try {
            if (type === 'report') {
                await apiClient.post('reports/daily/', {
                    content: formReport.content,
                    leads_processed: parseInt(formReport.leads || '0'),
                    deals_closed:    parseInt(formReport.deals  || '0'),
                });
                setHasReport(true);
            } else if (type === 'add_task') {
                const deadlineIso = taskDeadline?.toISOString() ?? null;
                const newTask = { id: `temp_${Date.now()}`, ...formTask, deadline: deadlineIso, assigned_to: user.id, _offlineAction: 'CREATE', isOffline: true };
                const offline = await getOfflineTasks();
                offline.push(newTask);
                await saveOfflineTasks(offline);
                await scheduleNotification(formTask.title, formTask.description, taskDeadline);
                syncOfflineTasks(true);
            } else if (type === 'edit_task') {
                const deadlineIso = taskDeadline?.toISOString() ?? null;
                const payload = { ...formTask, deadline: deadlineIso };
                try {
                    if (String(formTask.id).startsWith('temp_')) throw new Error('offline');
                    await apiClient.patch(`tasks/${formTask.id}/`, payload);
                    if (formTask.status !== 'done') await scheduleNotification(formTask.title, formTask.description, taskDeadline);
                } catch {
                    const offline = await getOfflineTasks();
                    const idx = offline.findIndex((t: any) => t.id === formTask.id);
                    if (idx > -1) offline[idx] = { ...offline[idx], ...payload, _offlineAction: offline[idx]._offlineAction || 'UPDATE' };
                    else offline.push({ ...payload, _offlineAction: 'UPDATE', isOffline: true });
                    await saveOfflineTasks(offline);
                }
            } else if (type === 'payment') {
                await apiClient.post('analytics/payments/', { ...formPayment, amount: parseFloat(formPayment.amount) });
            }
            setActiveModal(null);
            fetchData(false);
        } catch { Alert.alert('Ошибка', 'Проверьте введённые данные'); }
        finally { setSubmitLoading(false); }
    };

    // ── KPI ───────────────────────────────────────────────────────────────
    const sal         = user.managersalary;
    const revenue     = parseFloat(String(sal?.current_month_revenue ?? 0));
    const plan        = parseFloat(String(sal?.monthly_plan          ?? 1000));
    const balance     = parseFloat(String(sal?.current_balance       ?? 0));
    const fixed       = parseFloat(String(sal?.fixed_salary          ?? 0));
    const motTarget   = parseFloat(String(sal?.motivation_target     ?? 0));
    const motReward   = parseFloat(String(sal?.motivation_reward     ?? 0));
    const planPct     = plan > 0 ? Math.min((revenue / plan) * 100, 100) : 0;
    const leftToMot   = Math.max(motTarget - revenue, 0);
    const newLeads    = leads.filter(l => l.status === 'new');

    const htmlBase = { body: { color: theme.textSub, fontSize: 13, marginTop: 4 } };

    if (loading) return (
        <ScreenWrapper>
            <View style={s.center}><ActivityIndicator size="large" color={theme.primaryDeep} /></View>
        </ScreenWrapper>
    );

    return (
        <ScreenWrapper>
            {/* Фоновые орбы */}
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient colors={theme.gradientBg as any} style={StyleSheet.absoluteFillObject} />
                <Animated.View style={[s.orb, { top: '5%', right: orb1X, backgroundColor: theme.primaryDeep, opacity: 0.06 }]} />
                <Animated.View style={[s.orb, { bottom: '15%', left: orb1X, top: orb2Y, backgroundColor: theme.accent, opacity: 0.04, width: 400, height: 400 }]} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.container}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(true); onRefresh(); }} tintColor={theme.primary} />}
            >
                {/* Шапка профиля */}
                <BlurView intensity={60} tint={theme.mode === 'dark' ? 'dark' : 'light'} style={[s.glassHeader, { borderColor: theme.borderGlass }]}>
                    <View style={s.userRow}>
                        <View style={[s.avatarCircle, { backgroundColor: theme.primaryDeep }]}>
                            <Text style={s.avatarText}>{user.first_name?.[0] ?? 'M'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.welcomeText, { color: theme.textSub }]}>С возвращением,</Text>
                            <Text style={[s.userName, { color: theme.text }]} numberOfLines={1}>
                                {user.first_name} {user.last_name}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity style={[s.iconBtn, { borderColor: theme.border, backgroundColor: theme.bgGlass }]} onPress={() => router.push('/profile')}>
                        <Ionicons name="settings-outline" size={22} color={theme.primaryDeep} />
                    </TouchableOpacity>
                </BlurView>

                {/* KPI */}
                <Text style={[s.sectionTitle, { color: theme.textSub }]}>Показатели продаж</Text>
                <BlurView intensity={50} tint={theme.mode === 'dark' ? 'dark' : 'light'} style={[s.glassCard, { borderColor: theme.borderGlass }]}>
                    <View style={s.kpiRow}>
                        <View style={s.kpiBox}>
                            <Text style={[s.kpiLabel, { color: theme.textSub }]}>Выручка (USD)</Text>
                            <Text style={[s.kpiValue, { color: theme.text }]}>${revenue.toLocaleString()}</Text>
                        </View>
                        <View style={[s.kpiBox, { alignItems: 'flex-end' }]}>
                            <Text style={[s.kpiLabel, { color: theme.textSub }]}>План месяца</Text>
                            <Text style={[s.kpiValue, { color: theme.textSub }]}>${plan.toLocaleString()}</Text>
                        </View>
                    </View>
                    <View style={[s.progressContainer, { backgroundColor: theme.border }]}>
                        <LinearGradient colors={[theme.primaryDeep, theme.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={[s.progressBar, { width: `${planPct}%` as any }]} />
                    </View>
                    <View style={s.kpiFooter}>
                        {leftToMot > 0
                            ? <Text style={[s.kpiFooterText, { color: theme.textSub }]}>До бонуса: <Text style={{ fontWeight: '900', color: theme.warning }}>${leftToMot.toLocaleString()}</Text></Text>
                            : <Text style={[s.kpiFooterText, { color: theme.textSub }]}>Бонус <Text style={{ fontWeight: '900', color: theme.accent }}>выполнен 🎉</Text></Text>
                        }
                        <Text style={[s.kpiFooterText, { color: theme.textSub }]}>{Math.round(planPct)}%</Text>
                    </View>
                </BlurView>

                {/* Управление / смена */}
                <Text style={[s.sectionTitle, { color: theme.textSub }]}>Управление</Text>
                <BlurView intensity={50} tint={theme.mode === 'dark' ? 'dark' : 'light'} style={[s.glassCard, { borderColor: theme.borderGlass }]}>
                    <View style={s.shiftHeader}>
                        <View style={s.shiftInfo}>
                            <View style={[s.statusPulse, { backgroundColor: shiftActive ? theme.accent : theme.border }]} />
                            <Text style={[s.shiftTitle, { color: theme.text }]}>{shiftActive ? 'Вы на смене' : 'Смена закрыта'}</Text>
                        </View>
                        <TouchableOpacity
                            style={[s.shiftBtn, { backgroundColor: shiftActive ? theme.danger + '18' : theme.accent + '18' }]}
                            onPress={handleShiftToggle}
                        >
                            <Text style={[s.shiftBtnText, { color: shiftActive ? theme.danger : theme.accent }]}>
                                {shiftActive ? 'Завершить' : 'Начать работу'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <View style={[s.divider, { backgroundColor: theme.border }]} />
                    <View style={s.actionsGrid}>
                        {[
                            { label: 'Клиент',  icon: 'person-add', color: theme.primary,  route: '/add-client'  },
                            { label: 'Сделка',  icon: 'briefcase',  color: theme.warning,  route: '/add-deal'    },
                            { label: 'Задачи',  icon: 'checkbox',   color: theme.accent,   route: '/tasks'       },
                            { label: 'Отчёт',   icon: 'document-text', color: hasReport ? theme.accent : theme.purple,
                              onPress: () => openModal('report') },
                        ].map((a, i) => (
                            <TouchableOpacity key={i} style={s.actionBtn}
                                onPress={a.onPress ?? (() => router.push(a.route as any))}
                            >
                                <View style={[s.actionIcon, { backgroundColor: a.color + '18' }]}>
                                    <Ionicons name={a.icon as any} size={24} color={a.color} />
                                </View>
                                <Text style={[s.actionText, { color: theme.textSub }]}>{a.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </BlurView>

                {/* Новые заявки */}
                {newLeads.length > 0 && (
                    <>
                        <Text style={[s.sectionTitle, { color: theme.textSub }]}>Новые заявки ({newLeads.length})</Text>
                        {newLeads.map(l => (
                            <BlurView key={l.id} intensity={60} tint={theme.mode === 'dark' ? 'dark' : 'light'}
                                style={[s.listCard, { borderColor: theme.borderGlass }]}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.listTitle, { color: theme.text }]}>{l.full_name}</Text>
                                    <Text style={[s.listSub, { color: theme.textSub }]}>{l.phone} · {l.direction || 'Консультация'}</Text>
                                </View>
                                <TouchableOpacity style={[s.takeBtn, { backgroundColor: theme.primaryDeep }]} onPress={() => handleTakeLead(l.id)}>
                                    <Text style={s.takeBtnText}>Взять</Text>
                                </TouchableOpacity>
                            </BlurView>
                        ))}
                    </>
                )}

                {/* Задачи */}
                <View style={s.sectionRow}>
                    <Text style={[s.sectionTitle, { marginBottom: 0, color: theme.textSub }]}>Мои задачи</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity onPress={() => syncOfflineTasks(false)} style={[s.syncBtn, { borderColor: theme.border }]}>
                            {syncing ? <ActivityIndicator size="small" color={theme.primaryDeep} /> : <Ionicons name="sync" size={18} color={theme.primaryDeep} />}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openModal('add_task')} style={[s.addTaskBtn, { backgroundColor: theme.primaryDeep }]}>
                            <Ionicons name="add" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {(['todo', 'process', 'done'] as const).map(status => {
                    const list = tasks.filter(t => t.status === status);
                    if (list.length === 0) return null;
                    return (
                        <View key={status}>
                            <Text style={[s.kanbanLabel, { color: theme.textSub }]}>
                                {status === 'todo' ? '🎯 Надо сделать' : status === 'process' ? '⚙️ В работе' : '✅ Завершено'}
                            </Text>
                            {list.map(t => {
                                const dl       = t.deadline ? new Date(t.deadline) : null;
                                const expired  = dl && dl < new Date() && status !== 'done';
                                const soon     = dl && dl > new Date() && status !== 'done';
                                const selected = selectedTasks.includes(t.id);
                                return (
                                    <TouchableOpacity key={t.id}
                                        onLongPress={() => toggleSelect(t.id)}
                                        onPress={() => selectedTasks.length > 0 ? toggleSelect(t.id) : openModal('edit_task', t)}
                                    >
                                        <BlurView intensity={selected ? 80 : 50} tint={theme.mode === 'dark' ? 'dark' : 'light'}
                                            style={[s.taskCard, { borderColor: selected ? theme.primaryDeep : theme.borderGlass }]}
                                        >
                                            <View style={[s.statusDot, {
                                                backgroundColor: t.priority === 'high' ? theme.danger : t.priority === 'low' ? theme.accent : theme.warning
                                            }]} />
                                            <View style={{ flex: 1, paddingRight: 10 }}>
                                                <Text style={[s.taskText, { color: theme.text }, t.status === 'done' && s.taskDone]}>
                                                    {t.title}
                                                </Text>
                                                {t.description ? (
                                                    <RenderHtml
                                                        contentWidth={cw - 100}
                                                        source={{ html: t.description }}
                                                        baseStyle={{ color: theme.textSub, fontSize: 13 }}
                                                    />
                                                ) : null}
                                                {dl && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 }}>
                                                        <Ionicons
                                                            name={soon ? 'notifications' : 'time-outline'} size={12}
                                                            color={expired ? theme.danger : soon ? theme.accent : theme.textMuted}
                                                        />
                                                        <Text style={{ fontSize: 11, fontWeight: '800', color: expired ? theme.danger : soon ? theme.accent : theme.textMuted }}>
                                                            {dl.toLocaleDateString()} {String(dl.getHours()).padStart(2,'0')}:{String(dl.getMinutes()).padStart(2,'0')}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            {t.isOffline && <Ionicons name="cloud-offline" size={14} color={theme.warning} />}
                                        </BlurView>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    );
                })}
            </ScrollView>

            {/* Batch-панель */}
            {selectedTasks.length > 0 && (
                <BlurView intensity={80} tint="dark" style={s.batchBar}>
                    <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>{selectedTasks.length} выбрано</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity style={[s.batchBtn, { backgroundColor: theme.accent }]} onPress={() => handleBatch('done')}>
                            <Ionicons name="checkmark" size={18} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.batchBtn, { backgroundColor: theme.danger }]} onPress={() => handleBatch('delete')}>
                            <Ionicons name="trash" size={18} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </BlurView>
            )}

            {/* Модалка */}
            <Modal visible={activeModal !== null} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
                    <BlurView intensity={90} tint={theme.mode === 'dark' ? 'dark' : 'light'} style={[s.modalContent, { backgroundColor: theme.bgGlass }]}>
                        <View style={s.modalHeader}>
                            <Text style={[s.modalTitle, { color: theme.text }]}>
                                {activeModal === 'add_task' ? 'Новая задача'
                                    : activeModal === 'edit_task' ? 'Редактировать задачу'
                                    : activeModal === 'report'   ? 'Отчёт за смену'
                                    : 'Регистрация платежа'}
                            </Text>
                            <TouchableOpacity onPress={() => setActiveModal(null)}>
                                <Ionicons name="close-circle" size={28} color={theme.textSub} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            {(activeModal === 'add_task' || activeModal === 'edit_task') && (
                                <View>
                                    <Text style={[s.label, { color: theme.textSub }]}>Заголовок *</Text>
                                    <TextInput style={[s.input, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
                                        placeholder="Что нужно сделать?" placeholderTextColor={theme.textMuted}
                                        value={formTask.title} onChangeText={v => setFormTask(f => ({ ...f, title: v }))} />

                                    <Text style={[s.label, { color: theme.textSub }]}>Описание</Text>
                                    <TextInput style={[s.input, s.inputTall, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
                                        multiline placeholder="Детали..." placeholderTextColor={theme.textMuted}
                                        value={formTask.description} onChangeText={v => setFormTask(f => ({ ...f, description: v }))} />

                                    <Text style={[s.label, { color: theme.textSub }]}>Дедлайн</Text>
                                    <TouchableOpacity style={[s.input, { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bgInput, borderColor: theme.border }]}
                                        onPress={() => setShowDatePicker(true)}
                                    >
                                        <Ionicons name="calendar" size={18} color={taskDeadline ? theme.primary : theme.textMuted} style={{ marginRight: 10 }} />
                                        <Text style={{ flex: 1, color: taskDeadline ? theme.text : theme.textMuted, fontWeight: '700', fontSize: 15 }}>
                                            {taskDeadline
                                                ? `${taskDeadline.toLocaleDateString()} ${String(taskDeadline.getHours()).padStart(2,'0')}:${String(taskDeadline.getMinutes()).padStart(2,'0')}`
                                                : 'Без дедлайна'}
                                        </Text>
                                        {taskDeadline && <TouchableOpacity onPress={() => setTaskDeadline(null)}><Ionicons name="close-circle" size={18} color={theme.danger} /></TouchableOpacity>}
                                    </TouchableOpacity>
                                    {showDatePicker && (
                                        <DateTimePicker value={taskDeadline ?? new Date()} mode="datetime"
                                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                            onChange={(_, d) => { if (Platform.OS === 'android') setShowDatePicker(false); if (d) setTaskDeadline(d); }}
                                            textColor={theme.text}
                                        />
                                    )}
                                    {showDatePicker && Platform.OS === 'ios' && (
                                        <TouchableOpacity style={[s.pickerDone, { backgroundColor: theme.primaryDeep }]} onPress={() => setShowDatePicker(false)}>
                                            <Text style={{ color: '#fff', fontWeight: '900' }}>Готово</Text>
                                        </TouchableOpacity>
                                    )}

                                    <Text style={[s.label, { color: theme.textSub }]}>Приоритет</Text>
                                    <View style={s.chipRow}>
                                        {(['low','medium','high'] as const).map(p => (
                                            <TouchableOpacity key={p}
                                                style={[s.chip, { backgroundColor: formTask.priority === p ? theme.primaryDeep : theme.bgChip, borderColor: formTask.priority === p ? theme.primaryDeep : theme.border }]}
                                                onPress={() => setFormTask(f => ({ ...f, priority: p }))}
                                            >
                                                <Text style={[s.chipText, { color: formTask.priority === p ? '#fff' : theme.textSub }]}>
                                                    {p === 'low' ? 'Низкий' : p === 'medium' ? 'Средний' : 'Высокий'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={[s.label, { color: theme.textSub }]}>Статус</Text>
                                    <View style={s.chipRow}>
                                        {(['todo','process','done'] as const).map(st => (
                                            <TouchableOpacity key={st}
                                                style={[s.chip, { backgroundColor: formTask.status === st ? theme.primaryDeep : theme.bgChip, borderColor: formTask.status === st ? theme.primaryDeep : theme.border }]}
                                                onPress={() => setFormTask(f => ({ ...f, status: st }))}
                                            >
                                                <Text style={[s.chipText, { color: formTask.status === st ? '#fff' : theme.textSub }]}>
                                                    {st === 'todo' ? 'Сделать' : st === 'process' ? 'В работе' : 'Готово'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {activeModal === 'report' && (
                                <View>
                                    <Text style={[s.label, { color: theme.textSub }]}>Что сделано за день?</Text>
                                    <TextInput style={[s.input, s.inputTall, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
                                        multiline placeholder="Провёл консультации, закрыл сделку..."
                                        placeholderTextColor={theme.textMuted} value={formReport.content}
                                        onChangeText={v => setFormReport(f => ({ ...f, content: v }))} />
                                    <View style={{ flexDirection: 'row', gap: 15 }}>
                                        {[
                                            { label: 'Новых лидов',    key: 'leads' },
                                            { label: 'Закрыто сделок', key: 'deals' },
                                        ].map(f => (
                                            <View key={f.key} style={{ flex: 1 }}>
                                                <Text style={[s.label, { color: theme.textSub }]}>{f.label}</Text>
                                                <TextInput style={[s.input, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
                                                    keyboardType="numeric" placeholder="0" placeholderTextColor={theme.textMuted}
                                                    value={(formReport as any)[f.key]}
                                                    onChangeText={v => setFormReport(prev => ({ ...prev, [f.key]: v }))} />
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {activeModal === 'payment' && (
                                <View>
                                    <Text style={[s.label, { color: theme.textSub }]}>Выберите сделку</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                                        {dealsList.length === 0
                                            ? <Text style={{ color: theme.textMuted }}>Нет активных сделок</Text>
                                            : dealsList.map(d => (
                                                <TouchableOpacity key={d.id}
                                                    style={[s.chip, { backgroundColor: formPayment.deal === d.id ? theme.primaryDeep : theme.bgChip, borderColor: formPayment.deal === d.id ? theme.primaryDeep : theme.border }]}
                                                    onPress={() => setFormPayment(f => ({ ...f, deal: d.id }))}
                                                >
                                                    <Text style={[s.chipText, { color: formPayment.deal === d.id ? '#fff' : theme.textSub }]}>
                                                        #{d.id} (${d.total_to_pay_usd ?? d.price_client})
                                                    </Text>
                                                </TouchableOpacity>
                                            ))
                                        }
                                    </ScrollView>
                                    <Text style={[s.label, { color: theme.textSub }]}>Сумма (USD)</Text>
                                    <TextInput style={[s.input, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
                                        keyboardType="numeric" placeholder="0.00" placeholderTextColor={theme.textMuted}
                                        value={formPayment.amount} onChangeText={v => setFormPayment(f => ({ ...f, amount: v }))} />
                                </View>
                            )}

                            <TouchableOpacity style={[s.submitBtn, { backgroundColor: theme.primaryDeep }]}
                                onPress={() => submitForm(activeModal!)} disabled={submitLoading}
                            >
                                {submitLoading ? <ActivityIndicator color="#FFF" /> : <Text style={s.submitBtnText}>Сохранить</Text>}
                            </TouchableOpacity>
                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </BlurView>
                </KeyboardAvoidingView>
            </Modal>
        </ScreenWrapper>
    );
}

function makeStyles(t: any) {
    return StyleSheet.create({
        center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
        container: { padding: 20, paddingBottom: 120 },
        orb:       { position: 'absolute', width: 450, height: 450, borderRadius: 225 },

        glassHeader: {
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            padding: 20, borderRadius: 32, marginBottom: 25,
            borderWidth: 1, overflow: 'hidden',
        },
        userRow:     { flexDirection: 'row', alignItems: 'center', flex: 1 },
        avatarCircle:{ width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
        avatarText:  { color: '#FFF', fontSize: 22, fontWeight: '900' },
        welcomeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
        userName:    { fontSize: 18, fontWeight: '900' },
        iconBtn:     { padding: 12, borderRadius: 18, borderWidth: 1 },

        sectionTitle: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
        sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 10 },

        glassCard: { padding: 24, borderRadius: 32, borderWidth: 1, marginBottom: 25, overflow: 'hidden' },

        kpiRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
        kpiBox:       { flex: 1 },
        kpiLabel:     { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
        kpiValue:     { fontSize: 28, fontWeight: '900' },
        progressContainer: { height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 10 },
        progressBar:  { height: '100%', borderRadius: 5 },
        kpiFooter:    { flexDirection: 'row', justifyContent: 'space-between' },
        kpiFooterText:{ fontSize: 13, fontWeight: '700' },

        shiftHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
        shiftInfo:   { flexDirection: 'row', alignItems: 'center' },
        statusPulse: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
        shiftTitle:  { fontSize: 15, fontWeight: '800' },
        shiftBtn:    { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
        shiftBtnText:{ fontSize: 13, fontWeight: '900' },
        divider:     { height: 1, marginBottom: 18 },

        actionsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
        actionBtn:   { alignItems: 'center', flex: 1 },
        actionIcon:  { width: 56, height: 56, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
        actionText:  { fontSize: 12, fontWeight: '800' },

        listCard:   { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 22, marginBottom: 12, borderWidth: 1, overflow: 'hidden' },
        listTitle:  { fontSize: 15, fontWeight: '900', marginBottom: 3 },
        listSub:    { fontSize: 12, fontWeight: '600' },
        takeBtn:    { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
        takeBtnText:{ color: '#FFF', fontSize: 13, fontWeight: '900' },

        addTaskBtn:  { backgroundColor: '#0D416D', width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
        syncBtn:     { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
        kanbanLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 4, marginBottom: 10, marginTop: 14 },
        taskCard:    { flexDirection: 'row', alignItems: 'flex-start', padding: 16, borderRadius: 22, marginBottom: 10, borderWidth: 1, overflow: 'hidden' },
        statusDot:   { width: 6, height: 30, borderRadius: 3, marginRight: 14, marginTop: 2 },
        taskText:    { fontSize: 15, fontWeight: '800', marginBottom: 3 },
        taskDone:    { textDecorationLine: 'line-through', opacity: 0.5 },

        batchBar: {
            position: 'absolute', bottom: 30, left: 20, right: 20,
            padding: 16, paddingHorizontal: 24, borderRadius: 30,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        },
        batchBtn: { padding: 12, borderRadius: 14, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

        modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.5)' },
        modalContent: { borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 28, maxHeight: '92%', overflow: 'hidden' },
        modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
        modalTitle:   { fontSize: 22, fontWeight: '900' },
        label:        { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7, marginLeft: 4 },
        input:        { borderRadius: 16, paddingHorizontal: 16, height: 52, fontSize: 15, fontWeight: '700', borderWidth: 1, marginBottom: 18 },
        inputTall:    { height: 100, textAlignVertical: 'top', paddingTop: 14 },
        pickerDone:   { alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 16 },
        chipRow:      { flexDirection: 'row', gap: 8, marginBottom: 18, flexWrap: 'wrap' },
        chip:         { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
        chipText:     { fontSize: 13, fontWeight: '800' },
        submitBtn:    { paddingVertical: 18, borderRadius: 20, alignItems: 'center', marginTop: 8 },
        submitBtnText:{ color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
    });
}