// app/(app)/index.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';
import { getToken, saveToken } from '../../src/utils/storage';

export default function DashboardScreen() {
    const router = useRouter();

    // --- ДАННЫЕ ДАШБОРДА ---
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [tasks, setTasks] = useState<any[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [clientsList, setClientsList] = useState<any[]>([]);
    const [dealsList, setDealsList] = useState<any[]>([]);
    const [universitiesList, setUniversitiesList] = useState<any[]>([]);
    
    const [shiftActive, setShiftActive] = useState(false);
    const [hasReportToday, setHasReportToday] = useState(false);
    
    // --- СОСТОЯНИЯ ЗАГРУЗКИ ---
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [activeModal, setActiveModal] = useState<'report' | 'client' | 'deal' | 'payment' | 'add_task' | 'edit_task' | null>(null);

    // --- ПОИСК В КАТАЛОГЕ ---
    const [selectedCountry, setSelectedCountry] = useState<string>('');
    const [uniSearch, setUniSearch] = useState('');
    const [progSearch, setProgSearch] = useState('');

    // --- КАНБАН: ВЫДЕЛЕНИЕ ЗАДАЧ ---
    const [selectedTasks, setSelectedTasks] = useState<(number|string)[]>([]);

    // --- СТЕЙТЫ ФОРМ ---
    const [formReport, setFormReport] = useState({ content: '', leads: '', deals: '' });
    const [formTask, setFormTask] = useState({ id: '', title: '', description: '', priority: 'medium', status: 'todo' });
    
    const [formClient, setFormClient] = useState({ 
        full_name: '', phone: '', email: '', dob: '', city: '', citizenship: 'Туркменистан',
        passport_local_num: '', passport_inter_num: '', passport_issued_by: '', 
        passport_issued_date: '', address_registration: ''
    });

    const [formDeal, setFormDeal] = useState({ 
        client: '', deal_type: 'university', university: '', program: '', 
        currency: 1, price_client: '', expected_revenue_usd: '' 
    });

    const [formPayment, setFormPayment] = useState({ 
        deal: '', amount: '', currency: 1, method: 'cash' 
    });

    // ==========================================
    // OFFLINE-FIRST ЛОГИКА ДЛЯ ЗАДАЧ
    // ==========================================
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
            if (!silent) { Alert.alert("Синхронизация", "Все задачи уже синхронизированы."); setSyncing(false); }
            return;
        }

        const remainingOffline = [];
        let syncedCount = 0;

        for (const task of offlineTasks) {
            try {
                // Если задача была отмечена на удаление локально, мы ее просто не отправляем
                if (task.markedForDeletion) continue; 

                await apiClient.post('/tasks/', {
                    title: task.title,
                    description: task.description,
                    priority: task.priority,
                    status: task.status
                });
                syncedCount++;
            } catch (e) {
                // Если нет инета - оставляем в локальной очереди
                remainingOffline.push(task);
            }
        }

        await saveOfflineTasks(remainingOffline);
        if (!silent) {
            setSyncing(false);
            if (syncedCount > 0) Alert.alert("Успешно", `Синхронизировано задач: ${syncedCount}`);
            else Alert.alert("Ошибка", "Нет связи с сервером.");
        }
        fetchData(false); // Обновляем экран
    };

    // --- ЗАГРУЗКА ДАННЫХ ---
    const fetchData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const [tasksRes, leadsRes, shiftRes, reportRes, userRes, clientsRes, dealsRes] = await Promise.allSettled([
                apiClient.get('/tasks/'),
                apiClient.get('/leads/mobile/'),
                apiClient.get('/timetracking/shifts/current/'),
                apiClient.get('/reports/daily/today/'),
                apiClient.get('/users/users/me/'),
                apiClient.get('/clients/'),
                apiClient.get('/analytics/deals/')
            ]);
            
            if (userRes.status === 'fulfilled') setCurrentUser(userRes.value.data);
            if (leadsRes.status === 'fulfilled') setLeads(leadsRes.value.data.results || leadsRes.value.data);
            if (clientsRes.status === 'fulfilled') setClientsList(clientsRes.value.data.results || clientsRes.value.data);
            if (dealsRes.status === 'fulfilled') setDealsList(dealsRes.value.data.results || dealsRes.value.data);
            
            if (shiftRes.status === 'fulfilled' && shiftRes.value.data.is_active) setShiftActive(true);
            else setShiftActive(false);

            if (reportRes.status === 'fulfilled' && reportRes.value.data.id) setHasReportToday(true);
            else setHasReportToday(false);

            // МЕРДЖ ЗАДАЧ С СЕРВЕРА И ЛОКАЛЬНЫХ
            let serverTasks = tasksRes.status === 'fulfilled' ? (tasksRes.value.data.results || tasksRes.value.data) : [];
            const offlineTasks = await getOfflineTasks();
            const activeOfflineTasks = offlineTasks.filter((t: any) => !t.markedForDeletion);
            
            setTasks([...activeOfflineTasks, ...serverTasks]);

        } catch (error) {
            console.error('Ошибка загрузки', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadUniversities = async () => {
        try {
            const unisRes = await apiClient.get('/catalog/universities/');
            setUniversitiesList(unisRes.data.results || unisRes.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchData(); loadUniversities(); }, []);

    const openModal = (type: typeof activeModal, taskData?: any) => {
        if (type === 'deal') { setUniSearch(''); setProgSearch(''); }
        if (type === 'add_task') { setFormTask({ id: '', title: '', description: '', priority: 'medium', status: 'todo' }); }
        if (type === 'edit_task' && taskData) { setFormTask({ ...taskData }); }
        if (type === 'deal' || type === 'payment') {
            // Подгружаем списки при открытии нужных модалок, если они пусты
            if (type === 'deal' && clientsList.length === 0) apiClient.get('/clients/').then(r => setClientsList(r.data.results || r.data));
            if (type === 'payment' && dealsList.length === 0) apiClient.get('/analytics/deals/').then(r => setDealsList(r.data.results || r.data));
        }
        setActiveModal(type);
    };

    // --- КАНБАН ЭКШЕНЫ ---
    const toggleSelectTask = (id: number | string) => {
        if (selectedTasks.includes(id)) setSelectedTasks(selectedTasks.filter(tId => tId !== id));
        else setSelectedTasks([...selectedTasks, id]);
    };

    const handleBatchAction = async (action: 'done' | 'delete') => {
        Alert.alert(
            "Подтверждение",
            `Вы уверены, что хотите ${action === 'done' ? 'завершить' : 'удалить'} ${selectedTasks.length} задач(и)?`,
            [
                { text: "Отмена", style: "cancel" },
                { 
                    text: action === 'done' ? "Завершить" : "Удалить", 
                    style: action === 'delete' ? "destructive" : "default",
                    onPress: async () => {
                        setLoading(true);
                        
                        // Обрабатываем оффлайн-задачи
                        let offlineTasks = await getOfflineTasks();
                        
                        for (const id of selectedTasks) {
                            if (typeof id === 'string' && id.startsWith('temp_')) {
                                const idx = offlineTasks.findIndex((t: any) => t.id === id);
                                if (idx > -1) {
                                    if (action === 'delete') offlineTasks[idx].markedForDeletion = true;
                                    if (action === 'done') offlineTasks[idx].status = 'done';
                                }
                            } else {
                                // Серверные задачи
                                try {
                                    if (action === 'done') await apiClient.patch(`/tasks/${id}/`, { status: 'done' });
                                    if (action === 'delete') await apiClient.delete(`/tasks/${id}/`);
                                } catch (e) { console.error(`Ошибка с задачей ${id}`, e); }
                            }
                        }
                        
                        // Если удалили оффлайн, чистим массив
                        offlineTasks = offlineTasks.filter((t: any) => !t.markedForDeletion);
                        await saveOfflineTasks(offlineTasks);

                        setSelectedTasks([]);
                        fetchData(false);
                    }
                }
            ]
        );
    };

    // --- ЛОГИКА СМЕНЫ ---
    const handleShiftToggle = async () => {
        if (!shiftActive) {
            try {
                await apiClient.post('/timetracking/shifts/', {});
                setShiftActive(true);
                Alert.alert("✅ Смена начата", "Хорошего дня!");
            } catch (e: any) {
                if (e.response?.status === 400) setShiftActive(true);
                else Alert.alert("Ошибка", "Не удалось начать смену.");
            }
        } else {
            if (!hasReportToday) {
                Alert.alert("🛑 Внимание", "Сначала отправьте отчет за день!", [
                    { text: "Написать отчет", onPress: () => setActiveModal('report') },
                    { text: "Отмена", style: "cancel" }
                ]);
                return;
            }
            try {
                await apiClient.patch('/timetracking/shifts/current/');
                setShiftActive(false);
                Alert.alert("🛑 Смена завершена", "Можете отдыхать.");
            } catch (e) {
                Alert.alert("Ошибка", "Не удалось завершить смену.");
            }
        }
    };

    const handleTakeLead = async (id: number) => {
        try {
            await apiClient.patch(`/leads/mobile/${id}/`, { status: 'contacted' });
            Alert.alert("✅ Успешно", "Заявка взята в работу!");
            fetchData();
        } catch (e) { Alert.alert("Ошибка", "Не удалось взять заявку."); }
    };

    // --- ПОИСК ВУЗОВ И АВТОПОДСТАНОВКА ЦЕН ---
    const uniqueCountries = Array.from(new Set(universitiesList.map(u => u.country))).filter(Boolean);
    const filteredUnis = universitiesList
        .filter(u => u.country === selectedCountry)
        .filter(u => u.name.toLowerCase().includes(uniSearch.toLowerCase()));

    const selectedUniObj = universitiesList.find(u => u.id === formDeal.university);
    const availablePrograms = selectedUniObj ? selectedUniObj.programs.filter((p: any) => p.name.toLowerCase().includes(progSearch.toLowerCase())) : [];

    const handleCountrySelect = (country: string) => {
        setSelectedCountry(country);
        setUniSearch(''); setProgSearch('');
        setFormDeal({ ...formDeal, university: '', program: '', price_client: '', expected_revenue_usd: '' });
    };

    const handleUniversitySelect = (uniId: string) => {
        setProgSearch('');
        setFormDeal({ ...formDeal, university: uniId, program: '', price_client: '', expected_revenue_usd: '' });
    };

    const handleProgramSelect = (prog: any) => {
        setFormDeal({ 
            ...formDeal, program: prog.id, 
            price_client: prog.tuition_fee ? prog.tuition_fee.toString() : '', 
            expected_revenue_usd: prog.service_fee ? prog.service_fee.toString() : '' 
        });
    };

    // --- ОТПРАВКА ФОРМ ---
    const submitForm = async (type: string) => {
        setSubmitLoading(true);
        try {
            if (type === 'report') {
                if (!formReport.content.trim()) throw new Error("Заполните описание отчета");
                await apiClient.post('/reports/daily/', {
                    content: formReport.content, leads_processed: parseInt(formReport.leads || '0', 10), deals_closed: parseInt(formReport.deals || '0', 10)
                });
                setHasReportToday(true); setFormReport({ content: '', leads: '', deals: '' });
                Alert.alert("✅ Успешно", "Отчет отправлен");
                setActiveModal(null);
            } 
            else if (type === 'add_task') {
                if (!formTask.title) throw new Error("Укажите заголовок задачи");
                
                // СОЗДАЕМ ОФФЛАЙН ЗАДАЧУ
                const newTask = {
                    id: `temp_${Date.now()}`,
                    title: formTask.title,
                    description: formTask.description,
                    priority: formTask.priority,
                    status: formTask.status || 'todo',
                    isOffline: true,
                    assigned_to: currentUser?.id
                };

                const offlineTasks = await getOfflineTasks();
                offlineTasks.push(newTask);
                await saveOfflineTasks(offlineTasks);
                
                setTasks(prev => [newTask, ...prev]); // Оптимистичный UI
                setFormTask({ id: '', title: '', description: '', priority: 'medium', status: 'todo' });
                setActiveModal(null);
                
                syncOfflineTasks(true); // Пробуем отправить в фоне незаметно
                return;
            }
            else if (type === 'edit_task') {
                if (!formTask.title) throw new Error("Укажите заголовок задачи");
                
                if (typeof formTask.id === 'string' && formTask.id.startsWith('temp_')) {
                    // Редактируем локальную
                    const offlineTasks = await getOfflineTasks();
                    const idx = offlineTasks.findIndex((t: any) => t.id === formTask.id);
                    if (idx > -1) {
                        offlineTasks[idx] = { ...offlineTasks[idx], ...formTask };
                        await saveOfflineTasks(offlineTasks);
                    }
                } else {
                    // Редактируем серверную
                    await apiClient.patch(`/tasks/${formTask.id}/`, formTask);
                }
                
                setActiveModal(null);
                fetchData(false);
            }
            else if (type === 'client') {
                if (!formClient.full_name || !formClient.phone) throw new Error("ФИО и Телефон обязательны");
                const payload = { ...formClient };
                if (!payload.dob) delete payload.dob;
                if (!payload.passport_issued_date) delete payload.passport_issued_date;
                await apiClient.post('/clients/', payload);
                Alert.alert("✅ Успешно", "Клиент добавлен!");
                setActiveModal(null);
                router.push('/crm'); 
            }
            else if (type === 'deal') {
                if (!formDeal.client || !formDeal.price_client) throw new Error("Выберите клиента и укажите цену");
                const payload = { ...formDeal };
                if (payload.deal_type === 'service') { delete payload.university; delete payload.program; } 
                else { if (!payload.university) delete payload.university; if (!payload.program) delete payload.program; }
                if (!payload.expected_revenue_usd) payload.expected_revenue_usd = '0';
                await apiClient.post('/analytics/deals/', payload);
                Alert.alert("✅ Успешно", "Сделка создана!");
                setActiveModal(null);
                router.push('/crm'); 
            }
            else if (type === 'payment') {
                if (!formPayment.deal || !formPayment.amount) throw new Error("Выберите сделку и укажите сумму");
                await apiClient.post('/analytics/payments/', formPayment);
                Alert.alert("✅ Успешно", "Платёж зафиксирован!");
                setActiveModal(null);
                router.push('/crm'); 
            }
        } catch (error: any) {
            Alert.alert("Ошибка", error.response?.data?.detail || error.message || "Сбой при отправке данных");
        } finally {
            setSubmitLoading(false);
        }
    };

    // ФИЛЬТРАЦИЯ ДАННЫХ ДЛЯ ОТОБРАЖЕНИЯ
    const newLeads = leads.filter(l => l.status === 'new');
    const myTasks = tasks.filter(t => t.isOffline || (currentUser && t.assigned_to === currentUser.id));
    const tasksTodo = myTasks.filter(t => t.status === 'todo');
    const tasksProcess = myTasks.filter(t => t.status === 'process' || t.status === 'review');
    const tasksDone = myTasks.filter(t => t.status === 'done');

    // ФИНАНСОВАЯ АНАЛИТИКА (Из сериализатора Users)
    const salaryInfo = currentUser?.managersalary || { monthly_plan: 0, current_month_revenue: 0, current_balance: 0, fixed_salary: 0, motivation_target: 0, motivation_reward: 0 };
    const planProgress = salaryInfo.monthly_plan > 0 ? Math.min((salaryInfo.current_month_revenue / salaryInfo.monthly_plan) * 100, 100) : 0;
    const leftToMot = Math.max(salaryInfo.motivation_target - salaryInfo.current_month_revenue, 0);

    if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View></ScreenWrapper>;

    return (
        <ScreenWrapper>
            <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor="#fff" />} contentContainerStyle={{ paddingBottom: 100 }}>
                
                {/* 1. ФИНАНСОВЫЕ KPI И АНАЛИТИКА */}
                <Text style={styles.sectionTitle}>📈 Мои показатели</Text>
                <BlurView intensity={40} tint="dark" style={styles.kpiCard}>
                    <View style={styles.kpiRow}>
                        <View style={styles.kpiBox}>
                            <Text style={styles.kpiLabel}>Выручка / План</Text>
                            <Text style={styles.kpiValue}>${parseFloat(salaryInfo.current_month_revenue).toLocaleString()} / ${parseFloat(salaryInfo.monthly_plan).toLocaleString()}</Text>
                        </View>
                        <View style={styles.kpiBox}>
                            <Text style={styles.kpiLabel}>К выплате</Text>
                            <Text style={[styles.kpiValue, {color: '#34d399'}]}>${(parseFloat(salaryInfo.current_balance) + parseFloat(salaryInfo.fixed_salary)).toLocaleString()}</Text>
                        </View>
                    </View>
                    
                    <View style={styles.progressContainer}>
                        <View style={[styles.progressBar, { width: `${planProgress}%`, backgroundColor: planProgress === 100 ? '#10b981' : '#3b82f6' }]} />
                    </View>

                    <View style={styles.kpiFooter}>
                        <Text style={styles.kpiFooterText}>👥 Клиентов: <Text style={{fontWeight:'bold', color:'#fff'}}>{clientsList.length}</Text></Text>
                        <Text style={styles.kpiFooterText}>💼 Сделок: <Text style={{fontWeight:'bold', color:'#fff'}}>{dealsList.length}</Text></Text>
                        <Text style={styles.kpiFooterText}>🎁 До бонуса (${salaryInfo.motivation_reward}): <Text style={{color: leftToMot === 0 ? '#34d399' : '#fbbf24'}}>${leftToMot}</Text></Text>
                    </View>
                </BlurView>

                {/* 2. БЛОК СМЕНЫ И БЫСТРЫЕ ДЕЙСТВИЯ */}
                <BlurView intensity={50} tint="dark" style={styles.glassCard}>
                    <View style={styles.shiftHeader}>
                        <View style={styles.shiftInfo}>
                            <Ionicons name="time" size={24} color={shiftActive ? "#34d399" : "#3b82f6"} />
                            <View style={{ marginLeft: 12 }}>
                                <Text style={styles.shiftTitle}>Мой рабочий день</Text>
                                <Text style={styles.shiftSubtitle}>{shiftActive ? '🟢 В офисе' : '🔴 Смена закрыта'}</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={[styles.shiftBtn, { backgroundColor: shiftActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)' }]} onPress={handleShiftToggle}>
                            <Text style={[styles.shiftBtnText, { color: shiftActive ? '#fca5a5' : '#6ee7b7' }]}>{shiftActive ? 'Завершить' : 'Начать'}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.actionsGrid}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => openModal('client')}>
                            <View style={[styles.actionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}><Ionicons name="person-add" size={20} color="#60a5fa" /></View>
                            <Text style={styles.actionText}>Клиент</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => openModal('deal')}>
                            <View style={[styles.actionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}><Ionicons name="briefcase" size={20} color="#fbbf24" /></View>
                            <Text style={styles.actionText}>Сделка</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => openModal('payment')}>
                            <View style={[styles.actionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}><Ionicons name="cash" size={20} color="#34d399" /></View>
                            <Text style={styles.actionText}>Платёж</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => openModal('report')}>
                            <View style={[styles.actionIcon, { backgroundColor: hasReportToday ? 'rgba(16, 185, 129, 0.2)' : 'rgba(168, 85, 247, 0.2)' }]}>
                                <Ionicons name={hasReportToday ? "checkmark-done" : "document-text"} size={20} color={hasReportToday ? "#34d399" : "#c084fc"} />
                            </View>
                            <Text style={styles.actionText}>{hasReportToday ? 'Сдан!' : 'Отчет'}</Text>
                        </TouchableOpacity>
                    </View>
                </BlurView>

                {/* 3. ЛИДЫ (ТОЛЬКО НОВЫЕ) */}
                <Text style={styles.sectionTitle}>🔥 Новые заявки с сайта</Text>
                {newLeads.length === 0 ? (
                    <Text style={styles.emptyText}>Актуальных заявок нет</Text>
                ) : (
                    newLeads.map((lead) => (
                        <BlurView key={lead.id} intensity={30} tint="dark" style={styles.listCard}>
                            <View style={styles.listContent}>
                                <Text style={styles.listTitle}>{lead.full_name}</Text>
                                <Text style={styles.listSubtitle}>📞 {lead.phone} | {lead.direction || 'Без направления'}</Text>
                            </View>
                            <TouchableOpacity style={styles.takeBtn} onPress={() => handleTakeLead(lead.id)}>
                                <Text style={styles.takeBtnText}>В работу</Text>
                            </TouchableOpacity>
                        </BlurView>
                    ))
                )}

                {/* 4. КАНБАН ДОСКА С ВЫДЕЛЕНИЕМ */}
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20}}>
                    <Text style={styles.sectionTitle}>📋 Мои задачи</Text>
                    <View style={{flexDirection: 'row', gap: 10}}>
                        <TouchableOpacity onPress={() => syncOfflineTasks(false)} style={styles.syncBtn}>
                            {syncing ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="sync" size={14} color="#fff" />}
                            <Text style={styles.syncBtnText}>Синхр.</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openModal('add_task')} style={styles.addTaskBtn}>
                            <Ionicons name="add" size={16} color="#fff" />
                            <Text style={{color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 4}}>Создать</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                
                {/* ФУНКЦИЯ РЕНДЕРА КАРТОЧКИ ЗАДАЧИ */}
                {(() => {
                    const renderTaskCard = (task: any, indicatorColor: string) => {
                        const isSelected = selectedTasks.includes(task.id);
                        return (
                            <TouchableOpacity 
                                key={task.id} 
                                activeOpacity={0.8}
                                onLongPress={() => toggleSelectTask(task.id)}
                                onPress={() => {
                                    if (selectedTasks.length > 0) toggleSelectTask(task.id);
                                    else openModal('edit_task', task);
                                }}
                            >
                                <BlurView intensity={20} tint="dark" style={[styles.taskCard, isSelected && styles.taskCardSelected, task.status === 'done' && {opacity: 0.5}, task.isOffline && {borderColor: '#f59e0b', borderStyle: 'dashed'}]}>
                                    {isSelected ? (
                                        <Ionicons name="checkmark-circle" size={20} color="#3b82f6" style={{marginRight: 10}} />
                                    ) : (
                                        <View style={[styles.statusIndicator, { backgroundColor: indicatorColor }]} />
                                    )}
                                    <View style={{flex: 1}}>
                                        <Text style={[styles.taskText, task.status === 'done' && {textDecorationLine: 'line-through'}]}>{task.title}</Text>
                                    </View>
                                    {task.isOffline && <Ionicons name="cloud-offline" size={16} color="#f59e0b" />}
                                </BlurView>
                            </TouchableOpacity>
                        );
                    };

                    return (
                        <>
                            <Text style={styles.kanbanHeader}>🟡 Нужно сделать</Text>
                            {tasksTodo.length === 0 && <Text style={styles.emptyKanbanText}>Нет задач</Text>}
                            {tasksTodo.map(t => renderTaskCard(t, '#f59e0b'))}

                            <Text style={styles.kanbanHeader}>🔵 В работе / На проверке</Text>
                            {tasksProcess.length === 0 && <Text style={styles.emptyKanbanText}>Нет задач</Text>}
                            {tasksProcess.map(t => renderTaskCard(t, '#3b82f6'))}

                            <Text style={styles.kanbanHeader}>🟢 Готово</Text>
                            {tasksDone.length === 0 && <Text style={styles.emptyKanbanText}>Нет задач</Text>}
                            {tasksDone.map(t => renderTaskCard(t, '#10b981'))}
                        </>
                    );
                })()}

            </ScrollView>

            {/* ВСПЛЫВАЮЩАЯ ПАНЕЛЬ ПАКЕТНЫХ ДЕЙСТВИЙ */}
            {selectedTasks.length > 0 && (
                <View style={styles.batchActionBar}>
                    <Text style={{color: '#fff', fontWeight: 'bold', marginRight: 10}}>{selectedTasks.length} выбрано</Text>
                    <View style={{flexDirection: 'row', gap: 10}}>
                        <TouchableOpacity style={[styles.batchBtn, {backgroundColor: '#10b981'}]} onPress={() => handleBatchAction('done')}>
                            <Text style={styles.batchBtnText}>Готово</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.batchBtn, {backgroundColor: '#ef4444'}]} onPress={() => handleBatchAction('delete')}>
                            <Text style={styles.batchBtnText}>Удалить</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* --- УНИВЕРСАЛЬНАЯ МОДАЛКА --- */}
            <Modal visible={activeModal !== null} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <BlurView intensity={90} tint="dark" style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {activeModal === 'report' ? 'Ежедневный отчет' : 
                                 activeModal === 'client' ? 'Анкета Клиента' : 
                                 activeModal === 'deal' ? 'Новая Сделка' : 
                                 activeModal === 'add_task' ? 'Новая Задача' : 
                                 activeModal === 'edit_task' ? 'Свойства Задачи' : 'Новый Платёж'}
                            </Text>
                            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeModalBtn}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                            
                            {/* --- ФОРМА ОТЧЕТА --- */}
                            {activeModal === 'report' && (
                                <>
                                    <Text style={styles.label}>Что проделано за день?</Text>
                                    <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} multiline value={formReport.content} onChangeText={(t) => setFormReport({...formReport, content: t})} />
                                    <View style={styles.rowInputs}>
                                        <View style={{flex: 1, marginRight: 10}}>
                                            <Text style={styles.label}>Заявок</Text>
                                            <TextInput style={styles.input} keyboardType="numeric" value={formReport.leads} onChangeText={(t) => setFormReport({...formReport, leads: t})} />
                                        </View>
                                        <View style={{flex: 1}}>
                                            <Text style={styles.label}>Сделок</Text>
                                            <TextInput style={styles.input} keyboardType="numeric" value={formReport.deals} onChangeText={(t) => setFormReport({...formReport, deals: t})} />
                                        </View>
                                    </View>
                                </>
                            )}

                            {/* --- ФОРМА ЗАДАЧИ --- */}
                            {(activeModal === 'add_task' || activeModal === 'edit_task') && (
                                <>
                                    {formTask.id.toString().startsWith('temp_') && (
                                        <Text style={{color: '#f59e0b', marginBottom: 15, fontStyle: 'italic'}}>☁️ Это локальная задача. Не забудьте нажать "Синхр." при появлении интернета.</Text>
                                    )}
                                    <Text style={styles.label}>Заголовок задачи *</Text>
                                    <TextInput style={styles.input} placeholder="Например: Позвонить клиенту" placeholderTextColor="#666" value={formTask.title} onChangeText={(t) => setFormTask({...formTask, title: t})} />
                                    <Text style={styles.label}>Описание</Text>
                                    <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline placeholder="Уточнить список документов..." placeholderTextColor="#666" value={formTask.description} onChangeText={(t) => setFormTask({...formTask, description: t})} />
                                    
                                    <Text style={styles.label}>Приоритет</Text>
                                    <View style={styles.rowInputs}>
                                        {['low', 'medium', 'high'].map((p) => (
                                            <TouchableOpacity key={p} style={[styles.chip, formTask.priority === p && styles.chipActive]} onPress={() => setFormTask({...formTask, priority: p})}>
                                                <Text style={[styles.chipText, formTask.priority === p && {color: '#fff'}]}>{p === 'low' ? 'Низкий' : p === 'medium' ? 'Средний' : 'Высокий'}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    {activeModal === 'edit_task' && (
                                        <>
                                            <Text style={styles.label}>Статус (Канбан)</Text>
                                            <View style={styles.rowInputs}>
                                                <TouchableOpacity style={[styles.chip, formTask.status === 'todo' && styles.chipActive]} onPress={() => setFormTask({...formTask, status: 'todo'})}><Text style={[styles.chipText, formTask.status==='todo' && {color:'#fff'}]}>Сделать</Text></TouchableOpacity>
                                                <TouchableOpacity style={[styles.chip, formTask.status === 'process' && styles.chipActive]} onPress={() => setFormTask({...formTask, status: 'process'})}><Text style={[styles.chipText, formTask.status==='process' && {color:'#fff'}]}>В работе</Text></TouchableOpacity>
                                                <TouchableOpacity style={[styles.chip, formTask.status === 'done' && styles.chipActive]} onPress={() => setFormTask({...formTask, status: 'done'})}><Text style={[styles.chipText, formTask.status==='done' && {color:'#fff'}]}>Готово</Text></TouchableOpacity>
                                            </View>
                                        </>
                                    )}
                                </>
                            )}

                            {/* --- ФОРМА КЛИЕНТА --- */}
                            {activeModal === 'client' && (
                                <>
                                    <Text style={styles.sectionSubTitle}>Личные данные</Text>
                                    <Text style={styles.label}>ФИО Клиента *</Text>
                                    <TextInput style={styles.input} placeholder="Иванов Иван Иванович" placeholderTextColor="#666" value={formClient.full_name} onChangeText={(t) => setFormClient({...formClient, full_name: t})} />
                                    
                                    <View style={styles.rowInputs}>
                                        <View style={{flex: 1, marginRight: 10}}>
                                            <Text style={styles.label}>Телефон *</Text>
                                            <TextInput style={styles.input} placeholder="+993..." placeholderTextColor="#666" keyboardType="phone-pad" value={formClient.phone} onChangeText={(t) => setFormClient({...formClient, phone: t})} />
                                        </View>
                                        <View style={{flex: 1}}>
                                            <Text style={styles.label}>Дата рождения</Text>
                                            <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#666" value={formClient.dob} onChangeText={(t) => setFormClient({...formClient, dob: t})} />
                                        </View>
                                    </View>

                                    <View style={styles.rowInputs}>
                                        <View style={{flex: 1, marginRight: 10}}>
                                            <Text style={styles.label}>Город</Text>
                                            <TextInput style={styles.input} placeholder="Ашхабад" placeholderTextColor="#666" value={formClient.city} onChangeText={(t) => setFormClient({...formClient, city: t})} />
                                        </View>
                                        <View style={{flex: 1}}>
                                            <Text style={styles.label}>Гражданство</Text>
                                            <TextInput style={styles.input} placeholder="Туркменистан" placeholderTextColor="#666" value={formClient.citizenship} onChangeText={(t) => setFormClient({...formClient, citizenship: t})} />
                                        </View>
                                    </View>
                                    <Text style={styles.label}>Email</Text>
                                    <TextInput style={styles.input} placeholder="example@mail.com" placeholderTextColor="#666" keyboardType="email-address" value={formClient.email} onChangeText={(t) => setFormClient({...formClient, email: t})} />

                                    <Text style={[styles.sectionSubTitle, {marginTop: 15}]}>Паспортные данные</Text>
                                    <View style={styles.rowInputs}>
                                        <View style={{flex: 1, marginRight: 10}}>
                                            <Text style={styles.label}>Внутренний №</Text>
                                            <TextInput style={styles.input} placeholder="I-AН 123456" placeholderTextColor="#666" value={formClient.passport_local_num} onChangeText={(t) => setFormClient({...formClient, passport_local_num: t})} />
                                        </View>
                                        <View style={{flex: 1}}>
                                            <Text style={styles.label}>Загран №</Text>
                                            <TextInput style={styles.input} placeholder="A0123456" placeholderTextColor="#666" value={formClient.passport_inter_num} onChangeText={(t) => setFormClient({...formClient, passport_inter_num: t})} />
                                        </View>
                                    </View>
                                    <Text style={styles.label}>Кем выдан</Text>
                                    <TextInput style={styles.input} placeholder="МВД Туркменистана" placeholderTextColor="#666" value={formClient.passport_issued_by} onChangeText={(t) => setFormClient({...formClient, passport_issued_by: t})} />

                                    <View style={styles.rowInputs}>
                                        <View style={{flex: 1, marginRight: 10}}>
                                            <Text style={styles.label}>Дата выдачи</Text>
                                            <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#666" value={formClient.passport_issued_date} onChangeText={(t) => setFormClient({...formClient, passport_issued_date: t})} />
                                        </View>
                                        <View style={{flex: 1}}></View>
                                    </View>
                                    <Text style={styles.label}>Адрес регистрации</Text>
                                    <TextInput style={[styles.input, {height: 80, textAlignVertical: 'top'}]} multiline placeholder="Ул. Мира, д. 1, кв. 2" placeholderTextColor="#666" value={formClient.address_registration} onChangeText={(t) => setFormClient({...formClient, address_registration: t})} />
                                </>
                            )}

                            {/* --- ФОРМА СДЕЛКИ --- */}
                            {activeModal === 'deal' && (
                                <>
                                    <Text style={styles.label}>Выберите Клиента *</Text>
                                    {clientsList.length === 0 ? (
                                        <Text style={{color: '#9ca3af', marginBottom: 15, fontStyle: 'italic'}}>Нет клиентов. Сначала добавьте клиента.</Text>
                                    ) : (
                                        <ScrollView horizontal style={styles.chipScroll} showsHorizontalScrollIndicator={false}>
                                            {clientsList.map(c => (
                                                <TouchableOpacity key={c.id} style={[styles.chip, formDeal.client === c.id && styles.chipActive]} onPress={() => setFormDeal({...formDeal, client: c.id})}>
                                                    <Text style={[styles.chipText, formDeal.client === c.id && {color: '#fff'}]}>{c.full_name}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    )}

                                    <Text style={styles.label}>Тип сделки</Text>
                                    <View style={styles.rowInputs}>
                                        <TouchableOpacity style={[styles.chip, formDeal.deal_type === 'university' && styles.chipActive]} onPress={() => setFormDeal({...formDeal, deal_type: 'university'})}>
                                            <Text style={[styles.chipText, formDeal.deal_type === 'university' && {color: '#fff'}]}>ВУЗ</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.chip, formDeal.deal_type === 'service' && styles.chipActive]} onPress={() => setFormDeal({...formDeal, deal_type: 'service', university: '', program: ''})}>
                                            <Text style={[styles.chipText, formDeal.deal_type === 'service' && {color: '#fff'}]}>Доп. Услуга</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {formDeal.deal_type === 'university' && (
                                        <>
                                            <Text style={styles.label}>Страна</Text>
                                            <ScrollView horizontal style={styles.chipScroll} showsHorizontalScrollIndicator={false}>
                                                {uniqueCountries.map((country: string) => (
                                                    <TouchableOpacity key={country} style={[styles.chip, selectedCountry === country && styles.chipActive]} onPress={() => handleCountrySelect(country)}>
                                                        <Text style={[styles.chipText, selectedCountry === country && {color: '#fff'}]}>{country}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>

                                            {selectedCountry !== '' && (
                                                <>
                                                    <Text style={styles.label}>Университет</Text>
                                                    <TextInput style={styles.searchInput} placeholder="🔍 Поиск ВУЗа..." placeholderTextColor="#666" value={uniSearch} onChangeText={setUniSearch} />
                                                    <ScrollView horizontal style={styles.chipScroll} showsHorizontalScrollIndicator={false}>
                                                        {filteredUnis.map(u => (
                                                            <TouchableOpacity key={u.id} style={[styles.chip, formDeal.university === u.id && styles.chipActive]} onPress={() => handleUniversitySelect(u.id)}>
                                                                <Text style={[styles.chipText, formDeal.university === u.id && {color: '#fff'}]}>{u.name}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </ScrollView>
                                                </>
                                            )}

                                            {formDeal.university !== '' && (
                                                <>
                                                    <Text style={styles.label}>Программа</Text>
                                                    <TextInput style={styles.searchInput} placeholder="🔍 Поиск программы..." placeholderTextColor="#666" value={progSearch} onChangeText={setProgSearch} />
                                                    <ScrollView horizontal style={styles.chipScroll} showsHorizontalScrollIndicator={false}>
                                                        {availablePrograms.length === 0 ? <Text style={{color:'#666'}}>Нет программ</Text> : null}
                                                        {availablePrograms.map((p: any) => (
                                                            <TouchableOpacity key={p.id} style={[styles.chip, formDeal.program === p.id && styles.chipActive]} onPress={() => handleProgramSelect(p)}>
                                                                <Text style={[styles.chipText, formDeal.program === p.id && {color: '#fff'}]}>{p.name}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </ScrollView>
                                                </>
                                            )}
                                        </>
                                    )}

                                    <View style={styles.rowInputs}>
                                        <View style={{flex: 1, marginRight: 10}}>
                                            <Text style={styles.label}>Цена Клиенту (USD) *</Text>
                                            <TextInput style={styles.input} keyboardType="numeric" placeholder="1000" placeholderTextColor="#666" value={formDeal.price_client} onChangeText={(t) => setFormDeal({...formDeal, price_client: t})} />
                                        </View>
                                        <View style={{flex: 1}}>
                                            <Text style={styles.label}>Наша Выручка (USD)</Text>
                                            <TextInput style={styles.input} keyboardType="numeric" placeholder="300" placeholderTextColor="#666" value={formDeal.expected_revenue_usd} onChangeText={(t) => setFormDeal({...formDeal, expected_revenue_usd: t})} />
                                        </View>
                                    </View>
                                </>
                            )}

                            {/* --- ФОРМА ПЛАТЕЖА --- */}
                            {activeModal === 'payment' && (
                                <>
                                    <Text style={styles.label}>Основание (Выберите сделку) *</Text>
                                    {dealsList.length === 0 ? (
                                        <Text style={{color: '#9ca3af', marginBottom: 15, fontStyle: 'italic'}}>У вас пока нет сделок.</Text>
                                    ) : (
                                        <ScrollView horizontal style={styles.chipScroll} showsHorizontalScrollIndicator={false}>
                                            {dealsList.map(d => (
                                                <TouchableOpacity key={d.id} style={[styles.chip, formPayment.deal === d.id && styles.chipActive]} onPress={() => setFormPayment({...formPayment, deal: d.id})}>
                                                    <Text style={[styles.chipText, formPayment.deal === d.id && {color: '#fff'}]}>Сделка #{d.id} ({d.price_client}$)</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    )}

                                    <Text style={styles.label}>Сумма платежа (USD) *</Text>
                                    <TextInput style={styles.input} keyboardType="numeric" placeholder="500" placeholderTextColor="#666" value={formPayment.amount} onChangeText={(t) => setFormPayment({...formPayment, amount: t})} />

                                    <Text style={styles.label}>Способ оплаты</Text>
                                    <View style={styles.rowInputs}>
                                        {['cash', 'card', 'bank'].map((m) => (
                                            <TouchableOpacity key={m} style={[styles.chip, formPayment.method === m && styles.chipActive]} onPress={() => setFormPayment({...formPayment, method: m})}>
                                                <Text style={[styles.chipText, formPayment.method === m && {color: '#fff'}]}>{m === 'cash' ? 'Наличные' : m === 'card' ? 'Карта' : 'Перевод'}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}

                            <TouchableOpacity style={styles.submitBtn} onPress={() => submitForm(activeModal!)} disabled={submitLoading}>
                                {submitLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Сохранить</Text>}
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
    glassCard: { padding: 20, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.2)', marginBottom: 25 },
    
    // Стили Финансов
    kpiCard: { padding: 20, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)', backgroundColor: 'rgba(30, 58, 138, 0.2)', marginBottom: 25 },
    kpiRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    kpiBox: { flex: 1 },
    kpiLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 4 },
    kpiValue: { color: '#fff', fontSize: 20, fontWeight: '900' },
    progressContainer: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 15 },
    progressBar: { height: '100%', borderRadius: 3 },
    kpiFooter: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
    kpiFooterText: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },

    shiftHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', paddingBottom: 15, marginBottom: 15 },
    shiftInfo: { flexDirection: 'row', alignItems: 'center' },
    shiftTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
    shiftSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
    shiftBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    shiftBtnText: { fontWeight: '700', fontSize: 14 },
    actionsGrid: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
    actionBtn: { alignItems: 'center', width: '23%' },
    actionIcon: { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    actionText: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
    
    sectionTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 12, marginLeft: 4 },
    sectionSubTitle: { color: '#60a5fa', fontSize: 14, fontWeight: '700', marginBottom: 15, marginTop: 5, textTransform: 'uppercase', letterSpacing: 1 },
    listCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.05)' },
    listContent: { flex: 1 },
    listTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 4 },
    listSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
    takeBtn: { backgroundColor: 'rgba(59,130,246,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(59,130,246,0.4)' },
    takeBtnText: { color: '#60a5fa', fontSize: 12, fontWeight: 'bold' },
    emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', paddingVertical: 10 },
    
    // Стили Канбан
    addTaskBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.3)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    syncBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.3)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    syncBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
    kanbanHeader: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 15, marginBottom: 8, marginLeft: 5 },
    taskCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.2)' },
    taskCardSelected: { borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.15)' },
    statusIndicator: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
    taskText: { color: '#fff', fontSize: 14, fontWeight: '500', flex: 1 },
    emptyKanbanText: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginLeft: 5, fontStyle: 'italic' },

    // Плавающая панель пакетных действий
    batchActionBar: { position: 'absolute', bottom: 100, left: 20, right: 20, backgroundColor: 'rgba(31, 41, 55, 0.95)', borderRadius: 20, padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.5, shadowRadius: 10 },
    batchBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
    batchBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

    // Стили Модалки и Инпутов
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 25, maxHeight: '90%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
    closeModalBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 15, padding: 6 },
    label: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 8, fontWeight: '600', textTransform: 'uppercase' },
    input: { backgroundColor: 'rgba(0,0,0,0.2)', color: '#fff', borderRadius: 16, padding: 15, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 15 },
    searchInput: { backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', borderRadius: 12, padding: 10, fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 10 },
    rowInputs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    chipScroll: { marginBottom: 15, maxHeight: 50 },
    chip: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    chipActive: { backgroundColor: '#3b82f6', borderColor: '#60a5fa' },
    chipText: { color: 'rgba(255,255,255,0.6)', fontWeight: 'bold' },
    submitBtn: { backgroundColor: '#3b82f6', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});