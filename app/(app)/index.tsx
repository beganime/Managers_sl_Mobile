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
    View
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';
import { getToken, saveToken } from '../../src/utils/storage';

const { width, height } = Dimensions.get('window');

export default function DashboardScreen() {
    const router = useRouter();

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
    const [formTask, setFormTask] = useState({ id: '', title: '', description: '', priority: 'medium', status: 'todo' });
    const [formPayment, setFormPayment] = useState({ 
        deal: '', amount: '', currency: 1, method: 'cash', net_income_usd: 0 
    });

    const moveAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
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

    // --- ЛОГИКА ОФФЛАЙН ЗАДАЧ ---
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
                        priority: task.priority, status: task.status, assigned_to: task.assigned_to
                    });
                } else if (task._offlineAction === 'UPDATE') {
                    await apiClient.patch(`tasks/${task.id}/`, {
                        title: task.title, description: task.description,
                        priority: task.priority, status: task.status
                    });
                } else if (task._offlineAction === 'DELETE') {
                    await apiClient.delete(`tasks/${task.id}/`);
                }
                syncedCount++;
            } catch (e: any) {
                // Если при удалении/обновлении сервер вернул 404, значит задача уже удалена. Пропускаем.
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
            // Запросы БЕЗ начального слэша, чтобы Axios корректно склеил их с BASE_URL
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
            
            // Объединяем серверные задачи с локальными модификациями
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
        if (type === 'add_task') { setFormTask({ id: '', title: '', description: '', priority: 'medium', status: 'todo' }); }
        if (type === 'edit_task' && taskData) { setFormTask({ ...taskData }); }
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
                            // ЕСЛИ СЕРВЕР НЕДОСТУПЕН (ОФФЛАЙН), СОХРАНЯЕМ В ЛОКАЛЬНУЮ ОЧЕРЕДЬ
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
                Alert.alert("Внимание", "Сначала отправьте отчет!", [{ text: "Написать", onPress: () => setActiveModal('report') }, { text: "Отмена" }]);
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
                const newTask = { id: `temp_${Date.now()}`, ...formTask, assigned_to: currentUser?.id, _offlineAction: 'CREATE', isOffline: true };
                const offline = await getOfflineTasks();
                offline.push(newTask); 
                await saveOfflineTasks(offline);
                syncOfflineTasks(true); // Пробуем сразу отправить
            }
            else if (type === 'edit_task') {
                try {
                    if (typeof formTask.id === 'string' && formTask.id.startsWith('temp_')) throw new Error('Offline Task');
                    await apiClient.patch(`tasks/${formTask.id}/`, formTask);
                } catch (e) {
                    // Если оффлайн задача или нет инета - пишем в локалку
                    const offline = await getOfflineTasks();
                    const idx = offline.findIndex((t: any) => t.id === formTask.id);
                    if (idx > -1) {
                        offline[idx] = { ...offline[idx], ...formTask, _offlineAction: offline[idx]._offlineAction || 'UPDATE' };
                    } else {
                        offline.push({ ...formTask, _offlineAction: 'UPDATE', isOffline: true });
                    }
                    await saveOfflineTasks(offline);
                }
            }
            else if (type === 'payment') {
                await apiClient.post('analytics/payments/', { ...formPayment, amount: parseFloat(formPayment.amount) });
            }
            
            setActiveModal(null);
            fetchData(false); // Мгновенно обновляем интерфейс
        } catch (error: any) {
            Alert.alert("Ошибка", "Проверьте данные");
        } finally { setSubmitLoading(false); }
    };

    const salaryInfo = currentUser?.managersalary || { monthly_plan: 0, current_month_revenue: 0, current_balance: 0, fixed_salary: 0, motivation_target: 0, motivation_reward: 0 };
    const planProgress = parseFloat(salaryInfo.monthly_plan) > 0 ? Math.min((parseFloat(salaryInfo.current_month_revenue) / parseFloat(salaryInfo.monthly_plan)) * 100, 100) : 0;
    const leftToMot = Math.max(parseFloat(salaryInfo.motivation_target) - parseFloat(salaryInfo.current_month_revenue), 0);

    const newLeads = leads.filter(l => l.status === 'new');

    if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color="#0D416D" /></View></ScreenWrapper>;

    return (
        <ScreenWrapper>
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient colors={['#F1F5F9', '#E2E8F0']} style={StyleSheet.absoluteFillObject} />
                <Animated.View style={[styles.orb, { top: '5%', right: orb1X, backgroundColor: '#0D416D', opacity: 0.08 }]} />
                <Animated.View style={[styles.orb, { bottom: '10%', left: orb1X, top: orb2Y, backgroundColor: '#B71D17', opacity: 0.05, width: 450, height: 450 }]} />
            </View>

            <ScrollView 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor="#0D416D" />}
            >
                <BlurView intensity={40} tint="light" style={styles.glassHeader}>
                    <View style={styles.userRow}>
                        <View style={styles.avatarCircle}><Text style={styles.avatarText}>{currentUser?.first_name?.[0] || 'M'}</Text></View>
                        <View>
                            <Text style={styles.welcomeText}>Managers SL ERP</Text>
                            <Text style={styles.userNameText}>{currentUser?.first_name} {currentUser?.last_name}</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/profile')}>
                        <Ionicons name="options-outline" size={22} color="#0D416D" />
                    </TouchableOpacity>
                </BlurView>

                <Text style={styles.sectionTitle}>Показатели продаж</Text>
                <BlurView intensity={50} tint="light" style={styles.glassCard}>
                    <View style={styles.kpiRow}>
                        <View style={styles.kpiBox}>
                            <Text style={styles.kpiLabel}>Выручка</Text>
                            <Text style={styles.kpiValue}>${parseFloat(salaryInfo.current_month_revenue).toLocaleString()}</Text>
                        </View>
                        <View style={styles.kpiBox}>
                            <Text style={styles.kpiLabel}>План месяца</Text>
                            <Text style={styles.kpiValue}>${parseFloat(salaryInfo.monthly_plan).toLocaleString()}</Text>
                        </View>
                    </View>
                    <View style={styles.progressContainer}>
                        <LinearGradient colors={['#0D416D', '#2563EB']} start={{x:0, y:0}} end={{x:1, y:0}} style={[styles.progressBar, { width: `${planProgress}%` }]} />
                    </View>
                    <View style={styles.kpiFooter}>
                        <Text style={styles.kpiFooterText}>До бонуса: <Text style={{fontWeight:'900', color:'#0D416D'}}>${leftToMot}</Text></Text>
                        <Text style={styles.kpiFooterText}>{Math.round(planProgress)}%</Text>
                    </View>
                </BlurView>

                <BlurView intensity={50} tint="light" style={styles.glassCard}>
                    <View style={styles.shiftHeader}>
                        <View style={styles.shiftInfo}>
                            <Ionicons name="radio-button-on" size={20} color={shiftActive ? "#10b981" : "#94a3b8"} />
                            <Text style={styles.shiftTitle}>{shiftActive ? 'Смена открыта' : 'Смена закрыта'}</Text>
                        </View>
                        <TouchableOpacity style={[styles.shiftBtn, { backgroundColor: shiftActive ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)' }]} onPress={handleShiftToggle}>
                            <Text style={[styles.shiftBtnText, { color: shiftActive ? '#ef4444' : '#10b981' }]}>{shiftActive ? 'Завершить' : 'Начать'}</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.actionsGrid}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/add-client')}>
                            <View style={[styles.actionIcon, {backgroundColor:'rgba(255,255,255,0.7)'}]}><Ionicons name="person-add-outline" size={20} color="#0D416D" /></View>
                            <Text style={styles.actionText}>Клиент</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/add-deal')}>
                            <View style={[styles.actionIcon, {backgroundColor:'rgba(255,255,255,0.7)'}]}><Ionicons name="briefcase-outline" size={20} color="#ea580c" /></View>
                            <Text style={styles.actionText}>Сделка</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => openModal('payment')}>
                            <View style={[styles.actionIcon, {backgroundColor:'rgba(255,255,255,0.7)'}]}><Ionicons name="card-outline" size={20} color="#16a34a" /></View>
                            <Text style={styles.actionText}>Платеж</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => openModal('report')}>
                            <View style={[styles.actionIcon, {backgroundColor: hasReportToday ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.7)'}]}><Ionicons name="document-text-outline" size={20} color={hasReportToday ? "#10b981" : "#7c3aed"} /></View>
                            <Text style={styles.actionText}>Отчет</Text>
                        </TouchableOpacity>
                    </View>
                </BlurView>

                <Text style={styles.sectionTitle}>Новые заявки</Text>
                {newLeads.length === 0 ? <Text style={styles.emptyText}>Заявок пока нет</Text> : newLeads.map(l => (
                    <BlurView key={l.id} intensity={50} tint="light" style={styles.listCard}>
                        <View style={{flex:1}}>
                            <Text style={styles.listTitle}>{l.full_name}</Text>
                            <Text style={styles.listSubtitle}>{l.phone} | {l.direction || 'ВУЗ'}</Text>
                        </View>
                        <TouchableOpacity style={styles.takeBtn} onPress={() => handleTakeLead(l.id)}><Text style={styles.takeBtnText}>В работу</Text></TouchableOpacity>
                    </BlurView>
                ))}

                <View style={styles.sectionRow}>
                    <Text style={styles.sectionTitle}>Задачи</Text>
                    <View style={{flexDirection:'row', gap:10}}>
                        <TouchableOpacity onPress={() => syncOfflineTasks(false)} style={styles.syncBtn}>
                            {syncing ? <ActivityIndicator size="small" color="#0D416D" /> : <Ionicons name="sync-outline" size={18} color="#0D416D" />}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openModal('add_task')} style={styles.addBtn}><Ionicons name="add" size={24} color="#FFF" /></TouchableOpacity>
                    </View>
                </View>

                {['todo', 'process', 'done'].map(status => (
                    <View key={status}>
                        <Text style={styles.kanbanLabel}>{status === 'todo' ? '🎯 Сделать' : status === 'process' ? '⚙️ В работе' : '✅ Готово'}</Text>
                        {tasks.filter(t => t.status === status).map(t => (
                            <TouchableOpacity key={t.id} onLongPress={() => toggleSelectTask(t.id)} onPress={() => selectedTasks.length > 0 ? toggleSelectTask(t.id) : openModal('edit_task', t)}>
                                <BlurView intensity={selectedTasks.includes(t.id) ? 100 : 50} tint={selectedTasks.includes(t.id) ? "dark" : "light"} style={styles.taskCard}>
                                    <View style={[styles.statusDot, {backgroundColor: t.priority === 'high' ? '#ef4444' : '#0D416D'}]} />
                                    <Text style={[styles.taskText, t.status === 'done' && {textDecorationLine:'line-through', opacity:0.5}]}>{t.title}</Text>
                                    {t.isOffline && <Ionicons name="cloud-offline-outline" size={16} color="#ea580c" />}
                                </BlurView>
                            </TouchableOpacity>
                        ))}
                    </View>
                ))}
            </ScrollView>

            {selectedTasks.length > 0 && (
                <BlurView intensity={80} tint="dark" style={styles.batchBar}>
                    <Text style={{color:'#FFF', fontWeight:'900'}}>{selectedTasks.length} выбрано</Text>
                    <View style={{flexDirection:'row', gap:10}}>
                        <TouchableOpacity style={[styles.batchBtn, {backgroundColor:'rgba(16,185,129,0.8)'}]} onPress={() => handleBatchAction('done')}><Text style={styles.batchBtnText}>Готово</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.batchBtn, {backgroundColor:'rgba(239,68,68,0.8)'}]} onPress={() => handleBatchAction('delete')}><Text style={styles.batchBtnText}>Удалить</Text></TouchableOpacity>
                    </View>
                </BlurView>
            )}

            <Modal visible={activeModal !== null} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <BlurView intensity={60} tint="light" style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {activeModal === 'add_task' || activeModal === 'edit_task' ? 'Задача' : activeModal === 'report' ? 'Отчет за день' : 'Платеж'}
                            </Text>
                            <TouchableOpacity onPress={() => setActiveModal(null)}><Ionicons name="close-circle-outline" size={32} color="#0D416D" /></TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {(activeModal === 'add_task' || activeModal === 'edit_task') && (
                                <View>
                                    <Text style={styles.label}>Заголовок</Text>
                                    <TextInput style={styles.input} value={formTask.title} onChangeText={v => setFormTask({...formTask, title:v})} />
                                    <Text style={styles.label}>Описание</Text>
                                    <TextInput style={[styles.input, {height:100}]} multiline value={formTask.description} onChangeText={v => setFormTask({...formTask, description:v})} />
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
                                    <Text style={styles.label}>Содержание работ</Text>
                                    <TextInput style={[styles.input, {height:120}]} multiline value={formReport.content} onChangeText={v => setFormReport({...formReport, content:v})} />
                                    <View style={styles.row}>
                                        <View style={{flex:1, marginRight:10}}>
                                            <Text style={styles.label}>Лидов</Text>
                                            <TextInput style={styles.input} keyboardType="numeric" value={formReport.leads} onChangeText={v => setFormReport({...formReport, leads:v})} />
                                        </View>
                                        <View style={{flex:1}}>
                                            <Text style={styles.label}>Сделок</Text>
                                            <TextInput style={styles.input} keyboardType="numeric" value={formReport.deals} onChangeText={v => setFormReport({...formReport, deals:v})} />
                                        </View>
                                    </View>
                                </View>
                            )}

                            {activeModal === 'payment' && (
                                <View>
                                    <Text style={styles.label}>Сделка</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:15}}>
                                        {dealsList.map(d => (
                                            <TouchableOpacity key={d.id} style={[styles.modalChip, formPayment.deal === d.id && styles.modalChipActive]} onPress={() => setFormPayment({...formPayment, deal:d.id})}>
                                                <Text style={[styles.modalChipText, formPayment.deal === d.id && {color:'#FFF'}]}>#{d.id} ({d.price_client}$)</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                    <Text style={styles.label}>Сумма платежа ($)</Text>
                                    <TextInput style={styles.input} keyboardType="numeric" value={formPayment.amount} onChangeText={v => setFormPayment({...formPayment, amount:v})} />
                                </View>
                            )}

                            <TouchableOpacity style={styles.submitBtn} onPress={() => submitForm(activeModal!)} disabled={submitLoading}>
                                {submitLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Сохранить</Text>}
                            </TouchableOpacity>
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
    
    // Glassmorphism Styles
    glassHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderRadius: 28, backgroundColor: 'rgba(255, 255, 255, 0.4)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.7)', marginBottom: 25, overflow: 'hidden' },
    glassCard: { padding: 24, borderRadius: 32, backgroundColor: 'rgba(255, 255, 255, 0.4)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.7)', marginBottom: 30, overflow: 'hidden' },
    listCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 24, backgroundColor: 'rgba(255, 255, 255, 0.45)', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)', overflow: 'hidden' },
    taskCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20, marginBottom: 10, backgroundColor: 'rgba(255, 255, 255, 0.45)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)', overflow: 'hidden' },
    
    userRow: { flexDirection: 'row', alignItems: 'center' },
    avatarCircle: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#0D416D', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    avatarText: { color: '#FFF', fontSize: 20, fontWeight: '900' },
    welcomeText: { fontSize: 11, color: '#64748B', fontWeight: '800', textTransform:'uppercase' },
    userNameText: { fontSize: 17, color: '#0F172A', fontWeight: '900' },
    iconBtn: { padding: 10, borderRadius: 14, backgroundColor: 'rgba(255, 255, 255, 0.6)' },
    sectionTitle: { fontSize: 13, fontWeight: '900', color: '#334155', marginBottom: 15, marginLeft: 5, textTransform:'uppercase', letterSpacing:1.5 },
    kpiRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    kpiBox: { flex: 1 },
    kpiLabel: { fontSize: 10, color: '#64748B', fontWeight: '900', marginBottom: 6, textTransform:'uppercase' },
    kpiValue: { fontSize: 24, fontWeight: '900', color: '#0D416D' },
    progressContainer: { height: 12, backgroundColor: 'rgba(13, 65, 109, 0.08)', borderRadius: 6, overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: 6 },
    kpiFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
    kpiFooterText: { fontSize: 13, color: '#475569', fontWeight: '800' },
    shiftHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    shiftInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    shiftTitle: { fontSize: 14, fontWeight: '900', color: '#1E293B' },
    shiftBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14 },
    shiftBtnText: { fontSize: 14, fontWeight: '900' },
    actionsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
    actionBtn: { alignItems: 'center', gap: 8 },
    actionIcon: { width: 54, height: 54, borderRadius: 18, justifyContent:'center', alignItems:'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)' },
    actionText: { fontSize: 12, fontWeight: '900', color: '#475569' },
    listTitle: { fontSize: 16, fontWeight: '900', color: '#1E293B' },
    listSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '700' },
    takeBtn: { backgroundColor: '#0D416D', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12 },
    takeBtnText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
    sectionRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:15, marginTop: 10 },
    addBtn: { backgroundColor:'#0D416D', width:44, height:44, borderRadius:16, justifyContent:'center', alignItems:'center', shadowColor: '#0D416D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    syncBtn: { backgroundColor:'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', width:44, height:44, borderRadius:16, justifyContent:'center', alignItems:'center' },
    kanbanLabel: { fontSize:11, fontWeight:'900', color:'#64748B', marginLeft:5, marginBottom:10, marginTop:15, textTransform:'uppercase', letterSpacing:1 },
    statusDot: { width:7, height:24, borderRadius:3.5, marginRight:15 },
    taskText: { flex:1, fontSize:15, color:'#1E293B', fontWeight:'800' },
    batchBar: { position:'absolute', bottom:40, left:20, right:20, padding:20, borderRadius:28, flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor: 'rgba(15,23,42,0.85)', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    batchBtn: { paddingHorizontal:18, paddingVertical:10, borderRadius:14 },
    batchBtnText: { color:'#FFF', fontWeight:'900', fontSize:13 },
    modalOverlay: { flex:1, justifyContent:'flex-end', backgroundColor:'rgba(15,23,42,0.4)' },
    modalContent: { borderTopLeftRadius:45, borderTopRightRadius:45, padding:32, maxHeight:'92%', backgroundColor: 'rgba(241, 245, 249, 0.95)', overflow: 'hidden' },
    modalHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:30 },
    modalTitle: { fontSize:22, fontWeight:'900', color:'#0D416D' },
    label: { fontSize:11, fontWeight:'900', color:'#475569', marginBottom:8, marginLeft:6, textTransform:'uppercase', letterSpacing: 0.5 },
    input: { backgroundColor:'rgba(255, 255, 255, 0.7)', borderRadius:16, padding:16, fontSize:15, borderWidth:1, borderColor:'rgba(255, 255, 255, 0.9)', marginBottom:20, color:'#1E293B', fontWeight:'700' },
    row: { flexDirection:'row' },
    chipRow: { flexDirection:'row', gap:12, marginBottom:22 },
    modalChip: { backgroundColor:'rgba(255, 255, 255, 0.7)', paddingHorizontal:16, paddingVertical:12, borderRadius:14, borderWidth:1, borderColor:'rgba(255, 255, 255, 0.9)', marginRight: 10 },
    modalChipActive: { backgroundColor:'#0D416D', borderColor:'#0D416D' },
    modalChipText: { fontSize:13, fontWeight:'800', color:'#475569' },
    submitBtn: { backgroundColor:'#0D416D', padding:20, borderRadius:20, alignItems:'center', marginTop:10, shadowColor: '#0D416D', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5 },
    submitBtnText: { color:'#FFF', fontSize:16, fontWeight:'900', letterSpacing: 0.5 },
    emptyText: { color: '#94A3B8', textAlign: 'center', marginBottom: 20, fontStyle:'italic' }
});