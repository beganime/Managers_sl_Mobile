// app/(app)/index.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
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
    useWindowDimensions
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';
import { getToken, saveToken } from '../../src/utils/storage';

// --- ИМПОРТЫ ДЛЯ ПУШЕЙ, HTML И ВЫБОРА ДАТЫ ---
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import RenderHtml from 'react-native-render-html';

// Настройка поведения уведомлений
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

const { width, height } = Dimensions.get('window');

export default function DashboardScreen() {
    const router = useRouter();
    const { width: contentWidth } = useWindowDimensions();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [tasks, setTasks] = useState<any[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [dealsList, setDealsList] = useState<any[]>([]);
    
    const [shiftActive, setShiftActive] = useState(false);
    const [hasReportToday, setHasReportToday] = useState(false);
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    
    const [activeModal, setActiveModal] = useState<'report' | 'payment' | 'add_task' | 'edit_task' | null>(null);
    const [selectedTasks, setSelectedTasks] = useState<(number|string)[]>([]);

    const [formReport, setFormReport] = useState({ content: '', leads: '', deals: '' });
    
    // Стейты для задачи (deadline теперь храним как объект Date для пикера)
    const [formTask, setFormTask] = useState({ id: '', title: '', description: '', priority: 'medium', status: 'todo' });
    const [taskDeadline, setTaskDeadline] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    
    const [formPayment, setFormPayment] = useState({ 
        deal: '', amount: '', currency: 1, method: 'cash', net_income_usd: 0 
    });

    const moveAnim = useRef(new Animated.Value(0)).current;

    // --- ИНИЦИАЛИЗАЦИЯ ПУШ-УВЕДОМЛЕНИЙ ---
    useEffect(() => {
        const requestPushPermissions = async () => {
            if (Device.isDevice) {
                const { status: existingStatus } = await Notifications.getPermissionsAsync();
                let finalStatus = existingStatus;
                if (existingStatus !== 'granted') {
                    const { status } = await Notifications.requestPermissionsAsync();
                    finalStatus = status;
                }
                if (finalStatus !== 'granted') {
                    console.log('Нет прав на отправку Push-уведомлений!');
                }
            }
        };
        requestPushPermissions();

        Animated.loop(
            Animated.timing(moveAnim, {
                toValue: 1,
                duration: 35000,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: false,
            })
        ).start();
    }, []);

    const orb1X = moveAnim.interpolate({ inputRange: [0, 1], outputRange: [-100, 100] });
    const orb2Y = moveAnim.interpolate({ inputRange: [0, 1], outputRange: [50, -50] });

    const getOfflineTasks = async () => {
        const stored = await getToken('offline_tasks');
        return stored ? JSON.parse(stored) : [];
    };

    const saveOfflineTasks = async (offlineTasksArray: any[]) => {
        await saveToken('offline_tasks', JSON.stringify(offlineTasksArray));
    };

    const syncOfflineTasks = async (silent = true) => {
        if (!silent) setSyncing(true);
        const offlineTasks = await getOfflineTasks();
        
        if (offlineTasks.length === 0) {
            if (!silent) { Alert.alert("Синхронизация", "Все данные актуальны."); setSyncing(false); }
            return;
        }

        const remainingOffline = [];
        let syncedCount = 0;

        for (const task of offlineTasks) {
            try {
                if (task._offlineAction === 'CREATE') {
                    await apiClient.post('tasks/', {
                        title: task.title, description: task.description,
                        priority: task.priority, status: task.status, assigned_to: task.assigned_to,
                        deadline: task.deadline || null
                    });
                } else if (task._offlineAction === 'UPDATE') {
                    await apiClient.patch(`tasks/${task.id}/`, {
                        title: task.title, description: task.description,
                        priority: task.priority, status: task.status,
                        deadline: task.deadline || null
                    });
                } else if (task._offlineAction === 'DELETE') {
                    await apiClient.delete(`tasks/${task.id}/`);
                }
                syncedCount++;
            } catch (e: any) {
                if (e.response?.status === 404) syncedCount++;
                else remainingOffline.push(task);
            }
        }
        
        await saveOfflineTasks(remainingOffline);
        
        if (!silent) {
            setSyncing(false);
            if (syncedCount > 0) Alert.alert("Успешно", `Синхронизировано элементов: ${syncedCount}`);
            else Alert.alert("Ошибка", "Нет связи с сервером.");
        }
        fetchData(false);
    };

    const fetchData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const [tasksRes, leadsRes, shiftRes, reportRes, userRes] = await Promise.allSettled([
                apiClient.get('tasks/'),
                apiClient.get('leads/mobile/'),
                apiClient.get('timetracking/shifts/current/'),
                apiClient.get('reports/daily/today/'),
                apiClient.get('users/users/me/')
            ]);
            
            if (userRes.status === 'fulfilled') setCurrentUser(userRes.value.data);
            if (leadsRes.status === 'fulfilled') setLeads(leadsRes.value.data.results || leadsRes.value.data);
            
            if (shiftRes.status === 'fulfilled' && shiftRes.value.data.is_active) setShiftActive(true);
            else setShiftActive(false);

            if (reportRes.status === 'fulfilled' && reportRes.value.data.id) setHasReportToday(true);
            else setHasReportToday(false);

            let serverTasks = tasksRes.status === 'fulfilled' ? (tasksRes.value.data.results || tasksRes.value.data) : [];
            const offlineTasks = await getOfflineTasks();
            
            let mergedTasks = [...serverTasks];
            offlineTasks.forEach((offTask: any) => {
                if (offTask._offlineAction === 'DELETE') {
                    mergedTasks = mergedTasks.filter(t => t.id !== offTask.id);
                } else if (offTask._offlineAction === 'UPDATE') {
                    const idx = mergedTasks.findIndex(t => t.id === offTask.id);
                    if (idx > -1) mergedTasks[idx] = { ...mergedTasks[idx], ...offTask };
                    else mergedTasks.push(offTask);
                } else if (offTask._offlineAction === 'CREATE') {
                    mergedTasks.push(offTask);
                }
            });

            setTasks(mergedTasks);

        } catch (error) {
            console.error('Ошибка загрузки', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData(false);
        }, [])
    );

    const openModal = (type: typeof activeModal, taskData?: any) => {
        if (type === 'add_task') { 
            setFormTask({ id: '', title: '', description: '', priority: 'medium', status: 'todo' });
            setTaskDeadline(null);
        }
        if (type === 'edit_task' && taskData) { 
            setFormTask({ ...taskData });
            setTaskDeadline(taskData.deadline ? new Date(taskData.deadline) : null);
        }
        if (type === 'payment' && dealsList.length === 0) {
            apiClient.get('analytics/deals/').then(r => setDealsList(r.data.results || r.data));
        }
        setActiveModal(type);
    };

    const toggleSelectTask = (id: number | string) => {
        if (selectedTasks.includes(id)) setSelectedTasks(selectedTasks.filter(tId => tId !== id));
        else setSelectedTasks([...selectedTasks, id]);
    };

    const handleBatchAction = async (action: 'done' | 'delete') => {
        Alert.alert("Подтверждение", `Вы уверены?`, [
            { text: "Отмена", style: "cancel" },
            { 
                text: "Да", 
                onPress: async () => {
                    setLoading(true);
                    let offline = await getOfflineTasks();
                    
                    for (const id of selectedTasks) {
                        try {
                            if (action === 'done') await apiClient.patch(`tasks/${id}/`, { status: 'done' });
                            if (action === 'delete') await apiClient.delete(`tasks/${id}/`);
                        } catch (e) {
                            if (typeof id === 'string' && id.startsWith('temp_')) {
                                if (action === 'delete') offline = offline.filter((t: any) => t.id !== id);
                                if (action === 'done') {
                                    const idx = offline.findIndex((t: any) => t.id === id);
                                    if (idx > -1) offline[idx].status = 'done';
                                }
                            } else {
                                const existingIdx = offline.findIndex((t: any) => t.id === id);
                                if (action === 'delete') {
                                    if (existingIdx > -1) offline[existingIdx]._offlineAction = 'DELETE';
                                    else offline.push({ id, _offlineAction: 'DELETE' });
                                } else if (action === 'done') {
                                    const taskData = tasks.find(t => t.id === id) || {};
                                    if (existingIdx > -1) {
                                        offline[existingIdx].status = 'done';
                                        offline[existingIdx]._offlineAction = 'UPDATE';
                                    } else {
                                        offline.push({ ...taskData, status: 'done', _offlineAction: 'UPDATE', isOffline: true });
                                    }
                                }
                            }
                        }
                    }
                    
                    await saveOfflineTasks(offline);
                    setSelectedTasks([]);
                    fetchData(false);
                }
            }
        ]);
    };

    const handleShiftToggle = async () => {
        if (!shiftActive) {
            try {
                await apiClient.post('timetracking/shifts/', {});
                setShiftActive(true);
            } catch (e: any) { if (e.response?.status === 400) setShiftActive(true); }
        } else {
            if (!hasReportToday) {
                Alert.alert("Внимание", "Сначала отправьте отчет за день!", [{ text: "Написать", onPress: () => setActiveModal('report') }, { text: "Отмена" }]);
                return;
            }
            try { await apiClient.patch('timetracking/shifts/current/'); setShiftActive(false); } catch (e) {}
        }
    };

    const handleTakeLead = async (id: number) => {
        try {
            await apiClient.patch(`leads/mobile/${id}/`, { status: 'contacted' });
            fetchData();
        } catch (e) {}
    };

    const scheduleTaskNotification = async (title: string, descHtml: string, dateObj: Date | null) => {
        if (!dateObj) return;
        
        try {
            if (dateObj > new Date()) {
                const cleanBody = descHtml ? descHtml.replace(/<[^>]+>/g, '') : 'Пора выполнить задачу!';
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: `⏰ Напоминание: ${title}`,
                        body: cleanBody,
                        sound: true,
                        data: { type: 'task_reminder' }
                    },
                    trigger: dateObj,
                });
            }
        } catch (error) {
            console.log("Ошибка планирования пуша:", error);
        }
    };

    const onChangeDate = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowDatePicker(false);
        if (selectedDate) setTaskDeadline(selectedDate);
    };

    const submitForm = async (type: string) => {
        setSubmitLoading(true);
        try {
            if (type === 'report') {
                await apiClient.post('reports/daily/', {
                    content: formReport.content, leads_processed: parseInt(formReport.leads || '0'), deals_closed: parseInt(formReport.deals || '0')
                });
                setHasReportToday(true);
            } 
            else if (type === 'add_task') {
                const deadlineIso = taskDeadline ? taskDeadline.toISOString() : null;
                const newTask = { id: `temp_${Date.now()}`, ...formTask, deadline: deadlineIso, assigned_to: currentUser?.id, _offlineAction: 'CREATE', isOffline: true };
                const offline = await getOfflineTasks();
                offline.push(newTask); 
                await saveOfflineTasks(offline);
                
                await scheduleTaskNotification(formTask.title, formTask.description, taskDeadline);
                syncOfflineTasks(true);
            }
            else if (type === 'edit_task') {
                const deadlineIso = taskDeadline ? taskDeadline.toISOString() : null;
                let payload = { ...formTask, deadline: deadlineIso };
                
                try {
                    if (typeof formTask.id === 'string' && formTask.id.startsWith('temp_')) throw new Error('Offline Task');
                    await apiClient.patch(`tasks/${formTask.id}/`, payload);
                    
                    if (formTask.status !== 'done') {
                        await scheduleTaskNotification(formTask.title, formTask.description, taskDeadline);
                    }
                } catch (e) {
                    const offline = await getOfflineTasks();
                    const idx = offline.findIndex((t: any) => t.id === formTask.id);
                    if (idx > -1) {
                        offline[idx] = { ...offline[idx], ...payload, _offlineAction: offline[idx]._offlineAction || 'UPDATE' };
                    } else {
                        offline.push({ ...payload, _offlineAction: 'UPDATE', isOffline: true });
                    }
                    await saveOfflineTasks(offline);
                }
            }
            else if (type === 'payment') {
                await apiClient.post('analytics/payments/', { ...formPayment, amount: parseFloat(formPayment.amount) });
            }
            
            setActiveModal(null);
            fetchData(false);
        } catch (error: any) {
            Alert.alert("Ошибка", "Проверьте введенные данные");
        } finally { setSubmitLoading(false); }
    };

    const salaryInfo = currentUser?.managersalary || { monthly_plan: 0, current_month_revenue: 0, current_balance: 0, fixed_salary: 0, motivation_target: 0, motivation_reward: 0 };
    const planProgress = parseFloat(salaryInfo.monthly_plan) > 0 ? Math.min((parseFloat(salaryInfo.current_month_revenue) / parseFloat(salaryInfo.monthly_plan)) * 100, 100) : 0;
    const leftToMot = Math.max(parseFloat(salaryInfo.motivation_target) - parseFloat(salaryInfo.current_month_revenue), 0);

    const newLeads = leads.filter(l => l.status === 'new');

    const htmlBaseStyles = {
        body: { color: '#64748B', fontSize: 13, marginTop: 4, fontWeight: '500' as any },
        b: { color: '#1E293B', fontWeight: '800' as any },
        p: { margin: 0, padding: 0 }
    };

    if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color="#0D416D" /></View></ScreenWrapper>;

    return (
        <ScreenWrapper>
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient colors={['#F8FAFC', '#F1F5F9', '#E2E8F0']} style={StyleSheet.absoluteFillObject} />
                <Animated.View style={[styles.orb, { top: '5%', right: orb1X, backgroundColor: '#0D416D', opacity: 0.06 }]} />
                <Animated.View style={[styles.orb, { bottom: '15%', left: orb1X, top: orb2Y, backgroundColor: '#10b981', opacity: 0.04, width: 400, height: 400 }]} />
            </View>

            <ScrollView 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor="#0D416D" />}
            >
                {/* --- ШАПКА ПРОФИЛЯ --- */}
                <BlurView intensity={60} tint="light" style={styles.glassHeader}>
                    <View style={styles.userRow}>
                        {currentUser?.avatar ? (
                            <View style={styles.avatarCircle}>
                                <ActivityIndicator color="#fff" size="small" style={StyleSheet.absoluteFillObject} />
                                <Text style={styles.avatarText}>{currentUser?.first_name?.[0] || 'M'}</Text>
                            </View>
                        ) : (
                            <View style={styles.avatarCircle}><Text style={styles.avatarText}>{currentUser?.first_name?.[0] || 'M'}</Text></View>
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.welcomeText}>С возвращением,</Text>
                            <Text style={styles.userNameText} numberOfLines={1}>{currentUser?.first_name} {currentUser?.last_name}</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/profile')}>
                        <Ionicons name="settings-outline" size={22} color="#0D416D" />
                    </TouchableOpacity>
                </BlurView>

                {/* --- ПОКАЗАТЕЛИ ПРОДАЖ (KPI) --- */}
                <Text style={styles.sectionTitle}>Показатели продаж</Text>
                <BlurView intensity={50} tint="light" style={styles.glassCard}>
                    <View style={styles.kpiRow}>
                        <View style={styles.kpiBox}>
                            <Text style={styles.kpiLabel}>Выручка (USD)</Text>
                            <Text style={styles.kpiValue}>${parseFloat(salaryInfo.current_month_revenue).toLocaleString()}</Text>
                        </View>
                        <View style={[styles.kpiBox, { alignItems: 'flex-end' }]}>
                            <Text style={styles.kpiLabel}>План месяца</Text>
                            <Text style={[styles.kpiValue, { color: '#64748B' }]}>${parseFloat(salaryInfo.monthly_plan).toLocaleString()}</Text>
                        </View>
                    </View>
                    <View style={styles.progressContainer}>
                        <LinearGradient colors={['#0D416D', '#3b82f6']} start={{x:0, y:0}} end={{x:1, y:0}} style={[styles.progressBar, { width: `${planProgress}%` }]} />
                    </View>
                    <View style={styles.kpiFooter}>
                        {leftToMot > 0 ? (
                            <Text style={styles.kpiFooterText}>До бонуса: <Text style={{fontWeight:'900', color:'#f59e0b'}}>${leftToMot.toLocaleString()}</Text></Text>
                        ) : (
                            <Text style={styles.kpiFooterText}>Бонус <Text style={{fontWeight:'900', color:'#10b981'}}>выполнен 🎉</Text></Text>
                        )}
                        <Text style={styles.kpiFooterText}>{Math.round(planProgress)}%</Text>
                    </View>
                </BlurView>

                {/* --- БЫСТРЫЕ ДЕЙСТВИЯ И СМЕНА --- */}
                <Text style={styles.sectionTitle}>Управление</Text>
                <BlurView intensity={50} tint="light" style={styles.glassCard}>
                    <View style={styles.shiftHeader}>
                        <View style={styles.shiftInfo}>
                            <View style={[styles.statusPulse, { backgroundColor: shiftActive ? '#10b981' : '#cbd5e1' }]} />
                            <Text style={styles.shiftTitle}>{shiftActive ? 'Вы на смене' : 'Смена закрыта'}</Text>
                        </View>
                        <TouchableOpacity style={[styles.shiftBtn, { backgroundColor: shiftActive ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.15)' }]} onPress={handleShiftToggle}>
                            <Text style={[styles.shiftBtnText, { color: shiftActive ? '#ef4444' : '#10b981' }]}>{shiftActive ? 'Завершить' : 'Начать работу'}</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.actionsGrid}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/add-client')}>
                            <View style={styles.actionIcon}><Ionicons name="person-add" size={24} color="#3b82f6" /></View>
                            <Text style={styles.actionText}>Клиент</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/add-deal')}>
                            <View style={[styles.actionIcon, {backgroundColor: 'rgba(245, 158, 11, 0.1)'}]}><Ionicons name="briefcase" size={24} color="#f59e0b" /></View>
                            <Text style={styles.actionText}>Сделка</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => openModal('payment')}>
                            <View style={[styles.actionIcon, {backgroundColor: 'rgba(16, 185, 129, 0.1)'}]}><Ionicons name="card" size={24} color="#10b981" /></View>
                            <Text style={styles.actionText}>Платеж</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => openModal('report')}>
                            <View style={[styles.actionIcon, {backgroundColor: hasReportToday ? 'rgba(16,185,129,0.15)' : 'rgba(139, 92, 246, 0.1)'}]}><Ionicons name="document-text" size={24} color={hasReportToday ? "#10b981" : "#8b5cf6"} /></View>
                            <Text style={styles.actionText}>Отчет</Text>
                        </TouchableOpacity>
                    </View>
                </BlurView>

                {/* --- НОВЫЕ ЗАЯВКИ С САЙТА --- */}
                {newLeads.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Новые заявки ({newLeads.length})</Text>
                        {newLeads.map(l => (
                            <BlurView key={l.id} intensity={60} tint="light" style={styles.listCard}>
                                <View style={{flex:1}}>
                                    <Text style={styles.listTitle}>{l.full_name}</Text>
                                    <Text style={styles.listSubtitle}>{l.phone}  •  {l.direction || 'Консультация'}</Text>
                                </View>
                                <TouchableOpacity style={styles.takeBtn} onPress={() => handleTakeLead(l.id)}>
                                    <Text style={styles.takeBtnText}>Взять</Text>
                                </TouchableOpacity>
                            </BlurView>
                        ))}
                    </>
                )}

                {/* --- ЗАДАЧИ --- */}
                <View style={styles.sectionRow}>
                    <Text style={[styles.sectionTitle, { marginBottom: 0, marginLeft: 0 }]}>Мои задачи</Text>
                    <View style={{flexDirection:'row', gap:10}}>
                        <TouchableOpacity onPress={() => syncOfflineTasks(false)} style={styles.syncBtn}>
                            {syncing ? <ActivityIndicator size="small" color="#0D416D" /> : <Ionicons name="sync" size={18} color="#0D416D" />}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openModal('add_task')} style={styles.addTaskBtn}>
                            <Ionicons name="add" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {['todo', 'process', 'done'].map(status => {
                    const statusTasks = tasks.filter(t => t.status === status);
                    if (statusTasks.length === 0 && status === 'done') return null; 
                    return (
                        <View key={status}>
                            <Text style={styles.kanbanLabel}>
                                {status === 'todo' ? '🎯 Надо сделать' : status === 'process' ? '⚙️ В работе' : '✅ Завершено'}
                            </Text>
                            {statusTasks.map(t => {
                                const dlDate = t.deadline ? new Date(t.deadline) : null;
                                const isExpired = dlDate && dlDate < new Date() && status !== 'done';
                                const isPendingPush = dlDate && dlDate > new Date() && status !== 'done';

                                return (
                                    <TouchableOpacity 
                                        key={t.id} 
                                        onLongPress={() => toggleSelectTask(t.id)} 
                                        onPress={() => selectedTasks.length > 0 ? toggleSelectTask(t.id) : openModal('edit_task', t)}
                                    >
                                        <BlurView intensity={selectedTasks.includes(t.id) ? 80 : 50} tint={selectedTasks.includes(t.id) ? "dark" : "light"} style={[styles.taskCard, selectedTasks.includes(t.id) && {borderColor: '#0D416D'}]}>
                                            <View style={[styles.statusDot, {backgroundColor: t.priority === 'high' ? '#ef4444' : t.priority === 'low' ? '#10b981' : '#f59e0b'}]} />
                                            
                                            <View style={{ flex: 1, paddingRight: 10 }}>
                                                <Text style={[styles.taskText, t.status === 'done' && {textDecorationLine:'line-through', color: '#94A3B8'}]}>{t.title}</Text>
                                                
                                                {t.description ? (
                                                    <View style={{marginTop: 4}}>
                                                        <RenderHtml 
                                                            contentWidth={contentWidth - 100} 
                                                            source={{ html: t.description }} 
                                                            baseStyle={htmlBaseStyles.body}
                                                            tagsStyles={{ b: htmlBaseStyles.b, strong: htmlBaseStyles.b, p: htmlBaseStyles.p }}
                                                        />
                                                    </View>
                                                ) : null}

                                                {/* Индикатор времени и пушей */}
                                                {dlDate && (
                                                    <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4}}>
                                                        <Ionicons name={isPendingPush ? "notifications" : "time-outline"} size={14} color={isExpired ? '#ef4444' : isPendingPush ? '#10b981' : '#64748B'} />
                                                        <Text style={{fontSize: 11, fontWeight: '800', color: isExpired ? '#ef4444' : isPendingPush ? '#10b981' : '#64748B'}}>
                                                            {dlDate.toLocaleDateString()} {String(dlDate.getHours()).padStart(2,'0')}:{String(dlDate.getMinutes()).padStart(2,'0')}
                                                            {isPendingPush && ' (Будет пуш)'}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            
                                            {t.isOffline && <Ionicons name="cloud-offline" size={16} color="#f59e0b" style={{marginLeft: 10}} />}
                                        </BlurView>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    );
                })}
            </ScrollView>

            {selectedTasks.length > 0 && (
                <BlurView intensity={80} tint="dark" style={styles.batchBar}>
                    <Text style={{color:'#FFF', fontWeight:'900', fontSize: 15}}>{selectedTasks.length} выбрано</Text>
                    <View style={{flexDirection:'row', gap:10}}>
                        <TouchableOpacity style={[styles.batchBtn, {backgroundColor:'#10b981'}]} onPress={() => handleBatchAction('done')}>
                            <Ionicons name="checkmark" size={18} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.batchBtn, {backgroundColor:'#ef4444'}]} onPress={() => handleBatchAction('delete')}>
                            <Ionicons name="trash" size={18} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </BlurView>
            )}

            {/* --- УНИВЕРСАЛЬНОЕ МОДАЛЬНОЕ ОКНО --- */}
            <Modal visible={activeModal !== null} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <BlurView intensity={90} tint="light" style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {activeModal === 'add_task' ? 'Новая задача' : activeModal === 'edit_task' ? 'Редактировать задачу' : activeModal === 'report' ? 'Отчет за смену' : 'Регистрация платежа'}
                            </Text>
                            <TouchableOpacity style={styles.closeBtn} onPress={() => setActiveModal(null)}>
                                <Ionicons name="close" size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            {(activeModal === 'add_task' || activeModal === 'edit_task') && (
                                <View>
                                    <Text style={styles.label}>Заголовок *</Text>
                                    <TextInput style={styles.input} placeholder="Что нужно сделать?" placeholderTextColor="#94A3B8" value={formTask.title} onChangeText={v => setFormTask({...formTask, title:v})} />
                                    
                                    <Text style={styles.label}>Описание (HTML поддерживается)</Text>
                                    <TextInput style={[styles.input, {height:100, textAlignVertical: 'top', paddingTop: 16}]} multiline placeholder="Детали задачи..." placeholderTextColor="#94A3B8" value={formTask.description} onChangeText={v => setFormTask({...formTask, description:v})} />
                                    
                                    <Text style={styles.label}>Дедлайн / Напоминание</Text>
                                    <View style={[styles.input, {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}]}>
                                        <Text style={{color: taskDeadline ? '#1E293B' : '#94A3B8', fontWeight: '700', fontSize: 15}}>
                                            {taskDeadline ? `${taskDeadline.toLocaleDateString()} ${String(taskDeadline.getHours()).padStart(2,'0')}:${String(taskDeadline.getMinutes()).padStart(2,'0')}` : 'Без времени'}
                                        </Text>
                                        <View style={{flexDirection: 'row', gap: 10}}>
                                            {taskDeadline && (
                                                <TouchableOpacity onPress={() => setTaskDeadline(null)}>
                                                    <Ionicons name="close-circle" size={24} color="#ef4444" />
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                                                <Ionicons name="calendar" size={24} color="#0D416D" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <Text style={{fontSize: 10, color: '#94A3B8', marginBottom: 20, marginLeft: 6}}>Если указать время, придет Push-уведомление</Text>

                                    {/* ПИКЕР ДАТЫ/ВРЕМЕНИ */}
                                    {showDatePicker && (
                                        <DateTimePicker
                                            value={taskDeadline || new Date()}
                                            mode="datetime"
                                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                            onChange={onChangeDate}
                                            textColor="#0F172A"
                                        />
                                    )}
                                    {showDatePicker && Platform.OS === 'ios' && (
                                        <TouchableOpacity style={{backgroundColor: '#0D416D', padding: 10, borderRadius: 10, alignItems: 'center', marginBottom: 20}} onPress={() => setShowDatePicker(false)}>
                                            <Text style={{color: '#fff', fontWeight: 'bold'}}>Готово</Text>
                                        </TouchableOpacity>
                                    )}

                                    <Text style={styles.label}>Приоритет</Text>
                                    <View style={styles.chipRow}>
                                        {['low', 'medium', 'high'].map(p => (
                                            <TouchableOpacity key={p} style={[styles.modalChip, formTask.priority === p && styles.modalChipActive]} onPress={() => setFormTask({...formTask, priority: p})}>
                                                <Text style={[styles.modalChipText, formTask.priority === p && {color:'#FFF'}]}>{p === 'low' ? 'Низкий' : p === 'medium' ? 'Средний' : 'Высокий'}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={styles.label}>Статус</Text>
                                    <View style={styles.chipRow}>
                                        {['todo', 'process', 'done'].map(s => (
                                            <TouchableOpacity key={s} style={[styles.modalChip, formTask.status === s && styles.modalChipActive]} onPress={() => setFormTask({...formTask, status: s})}>
                                                <Text style={[styles.modalChipText, formTask.status === s && {color:'#FFF'}]}>{s === 'todo' ? 'Сделать' : s === 'process' ? 'В работе' : 'Готово'}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}
                            
                            {activeModal === 'report' && (
                                <View>
                                    <Text style={styles.label}>Что было сделано за день?</Text>
                                    <TextInput style={[styles.input, {height:120, textAlignVertical: 'top', paddingTop: 16}]} multiline placeholder="Провел 5 консультаций, закрыл сделку..." placeholderTextColor="#94A3B8" value={formReport.content} onChangeText={v => setFormReport({...formReport, content:v})} />
                                    <View style={{flexDirection: 'row', gap: 15}}>
                                        <View style={{flex:1}}>
                                            <Text style={styles.label}>Новых лидов</Text>
                                            <TextInput style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor="#94A3B8" value={formReport.leads} onChangeText={v => setFormReport({...formReport, leads:v})} />
                                        </View>
                                        <View style={{flex:1}}>
                                            <Text style={styles.label}>Закрыто сделок</Text>
                                            <TextInput style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor="#94A3B8" value={formReport.deals} onChangeText={v => setFormReport({...formReport, deals:v})} />
                                        </View>
                                    </View>
                                </View>
                            )}

                            {activeModal === 'payment' && (
                                <View>
                                    <Text style={styles.label}>Выберите сделку</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:20}}>
                                        {dealsList.length === 0 ? <Text style={{color: '#94A3B8'}}>Нет активных сделок</Text> : dealsList.map(d => (
                                            <TouchableOpacity key={d.id} style={[styles.modalChip, formPayment.deal === d.id && styles.modalChipActive]} onPress={() => setFormPayment({...formPayment, deal:d.id})}>
                                                <Text style={[styles.modalChipText, formPayment.deal === d.id && {color:'#FFF'}]}>Сделка #{d.id} (${d.total_to_pay_usd || d.price_client})</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                    <Text style={styles.label}>Сумма платежа (USD)</Text>
                                    <TextInput style={styles.input} keyboardType="numeric" placeholder="0.00" placeholderTextColor="#94A3B8" value={formPayment.amount} onChangeText={v => setFormPayment({...formPayment, amount:v})} />
                                </View>
                            )}

                            <TouchableOpacity style={styles.submitBtn} onPress={() => submitForm(activeModal!)} disabled={submitLoading}>
                                {submitLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Сохранить</Text>}
                            </TouchableOpacity>
                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </BlurView>
                </KeyboardAvoidingView>
            </Modal>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    orb: { position: 'absolute', width: 450, height: 450, borderRadius: 225 },
    
    glassHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderRadius: 32, backgroundColor: 'rgba(255, 255, 255, 0.6)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.9)', marginBottom: 25, overflow: 'hidden' },
    userRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatarCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#0D416D', justifyContent: 'center', alignItems: 'center', marginRight: 15, shadowColor: '#0D416D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 },
    avatarText: { color: '#FFF', fontSize: 22, fontWeight: '900' },
    welcomeText: { fontSize: 12, color: '#64748B', fontWeight: '800', textTransform:'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    userNameText: { fontSize: 18, color: '#0F172A', fontWeight: '900' },
    iconBtn: { padding: 12, borderRadius: 18, backgroundColor: 'rgba(255, 255, 255, 0.8)', borderWidth: 1, borderColor: '#E2E8F0' },
    
    sectionTitle: { fontSize: 13, fontWeight: '900', color: '#334155', marginBottom: 12, marginLeft: 6, textTransform:'uppercase', letterSpacing:1.5 },
    
    glassCard: { padding: 24, borderRadius: 32, backgroundColor: 'rgba(255, 255, 255, 0.5)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.9)', marginBottom: 30, overflow: 'hidden' },
    kpiRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    kpiBox: { flex: 1 },
    kpiLabel: { fontSize: 11, color: '#64748B', fontWeight: '800', marginBottom: 6, textTransform:'uppercase', letterSpacing: 0.5 },
    kpiValue: { fontSize: 28, fontWeight: '900', color: '#0F172A' },
    progressContainer: { height: 10, backgroundColor: 'rgba(15, 23, 42, 0.05)', borderRadius: 5, overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: 5 },
    kpiFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
    kpiFooterText: { fontSize: 13, color: '#475569', fontWeight: '700' },
    
    shiftHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    shiftInfo: { flexDirection: 'row', alignItems: 'center' },
    statusPulse: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
    shiftTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
    shiftBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
    shiftBtnText: { fontSize: 13, fontWeight: '900' },
    divider: { height: 1, backgroundColor: 'rgba(15, 23, 42, 0.05)', marginBottom: 20 },
    actionsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
    actionBtn: { alignItems: 'center', flex: 1 },
    actionIcon: { width: 56, height: 56, borderRadius: 24, justifyContent:'center', alignItems:'center', backgroundColor: 'rgba(59, 130, 246, 0.1)', marginBottom: 8 },
    actionText: { fontSize: 12, fontWeight: '800', color: '#475569' },
    
    listCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24, backgroundColor: 'rgba(255, 255, 255, 0.6)', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.9)', overflow: 'hidden' },
    listTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
    listSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '600' },
    takeBtn: { backgroundColor: '#0D416D', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
    takeBtnText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
    
    sectionRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:15, marginTop: 10 },
    addTaskBtn: { backgroundColor:'#0D416D', width: 44, height: 44, borderRadius: 16, justifyContent:'center', alignItems:'center', shadowColor: '#0D416D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
    syncBtn: { backgroundColor:'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: '#E2E8F0', width: 44, height: 44, borderRadius: 16, justifyContent:'center', alignItems:'center' },
    kanbanLabel: { fontSize: 12, fontWeight: '900', color: '#475569', marginLeft: 6, marginBottom: 12, marginTop: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
    taskCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 18, borderRadius: 24, marginBottom: 12, backgroundColor: 'rgba(255, 255, 255, 0.6)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.9)', overflow: 'hidden' },
    statusDot: { width: 6, height: 30, borderRadius: 3, marginRight: 15, marginTop: 2 },
    taskText: { fontSize: 16, color: '#1E293B', fontWeight: '800' },
    
    batchBar: { position:'absolute', bottom: 30, left: 20, right: 20, padding: 16, paddingHorizontal: 24, borderRadius: 30, flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor: 'rgba(15,23,42,0.9)', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
    batchBtn: { padding: 12, borderRadius: 16, marginLeft: 10, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    
    modalOverlay: { flex:1, justifyContent:'flex-end', backgroundColor:'rgba(15,23,42,0.4)' },
    modalContent: { borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 30, maxHeight: '90%', backgroundColor: 'rgba(241, 245, 249, 0.95)', overflow: 'hidden' },
    modalHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 25 },
    modalTitle: { fontSize: 22, fontWeight:'900', color:'#0F172A' },
    closeBtn: { backgroundColor: 'rgba(15, 23, 42, 0.05)', padding: 8, borderRadius: 16 },
    label: { fontSize: 11, fontWeight: '900', color: '#475569', marginBottom: 8, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { backgroundColor:'rgba(255, 255, 255, 0.8)', borderRadius: 16, padding: 16, fontSize: 15, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20, color:'#1E293B', fontWeight:'700', outlineStyle: 'none' },
    chipRow: { flexDirection:'row', flexWrap: 'wrap', gap:10, marginBottom:20 },
    modalChip: { backgroundColor:'rgba(255, 255, 255, 0.7)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', marginRight: 8, marginBottom: 8 },
    modalChipActive: { backgroundColor:'#0D416D', borderColor:'#0D416D' },
    modalChipText: { fontSize: 13, fontWeight:'800', color:'#475569' },
    submitBtn: { backgroundColor:'#0D416D', padding: 20, borderRadius: 20, alignItems:'center', marginTop: 10, shadowColor: '#0D416D', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5 },
    submitBtnText: { color:'#FFF', fontSize: 16, fontWeight:'900', letterSpacing: 0.5 },
});