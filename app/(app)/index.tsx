// app/(app)/index.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';

export default function DashboardScreen() {
    const [tasks, setTasks] = useState<any[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Стейты смены и отчетов
    const [shiftActive, setShiftActive] = useState(false);
    const [hasReportToday, setHasReportToday] = useState(false);

    // Стейты модалки отчета
    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [reportContent, setReportContent] = useState('');
    const [reportLeads, setReportLeads] = useState('0');
    const [reportDeals, setReportDeals] = useState('0');
    const [submittingReport, setSubmittingReport] = useState(false);

    const fetchData = async () => {
        try {
            // Запрашиваем все нужные данные параллельно
            const [tasksRes, leadsRes, shiftRes, reportRes] = await Promise.allSettled([
                apiClient.get('/tasks/'),
                apiClient.get('/leads/mobile/'),
                apiClient.get('/timetracking/shifts/current/'),
                apiClient.get('/reports/daily/today/')
            ]);
            
            if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value.data.results || tasksRes.value.data);
            if (leadsRes.status === 'fulfilled') setLeads(leadsRes.value.data.results || leadsRes.value.data);
            
            // Если есть ответ по смене без ошибки 404, значит смена активна
            if (shiftRes.status === 'fulfilled' && shiftRes.value.data.is_active) {
                setShiftActive(true);
            } else {
                setShiftActive(false);
            }

            // Проверяем, сдан ли отчет
            if (reportRes.status === 'fulfilled' && reportRes.value.data.id) {
                setHasReportToday(true);
            } else {
                setHasReportToday(false);
            }

        } catch (error) {
            console.error('Ошибка загрузки дашборда', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // --- ЛОГИКА СМЕНЫ С ЗАЩИТОЙ ---
    const handleShiftToggle = async () => {
        if (!shiftActive) {
            // НАЧАЛО СМЕНЫ
            try {
                await apiClient.post('/timetracking/shifts/', {});
                setShiftActive(true);
                Alert.alert("✅ Смена начата", "Желаем продуктивного дня!");
            } catch (error: any) {
                if (error.response?.status === 400) {
                    setShiftActive(true); // Синхронизируем стейт, если смена уже была начата
                } else {
                    Alert.alert("❌ Ошибка", "Не удалось начать смену.");
                }
            }
        } else {
            // ЗАВЕРШЕНИЕ СМЕНЫ
            if (!hasReportToday) {
                Alert.alert(
                    "🛑 Отчет не заполнен!", 
                    "Перед завершением дня вы обязаны отправить ежедневный отчет руководителю.",
                    [
                        { text: "Написать отчет", onPress: () => setReportModalVisible(true) },
                        { text: "Отмена", style: "cancel" }
                    ]
                );
                return; // БЛОКИРУЕМ ЗАВЕРШЕНИЕ
            }

            try {
                await apiClient.patch('/timetracking/shifts/current/');
                setShiftActive(false);
                Alert.alert("🛑 Смена завершена", "Отличная работа! Можете отдыхать.");
            } catch (error: any) {
                Alert.alert("❌ Ошибка", "Не удалось завершить смену.");
            }
        }
    };

    // --- ЛОГИКА ОТЧЕТА ---
    const submitReport = async () => {
        if (!reportContent.trim()) {
            Alert.alert("Внимание", "Поле 'Что проделано за день' не может быть пустым.");
            return;
        }
        setSubmittingReport(true);
        try {
            await apiClient.post('/reports/daily/', {
                content: reportContent,
                leads_processed: parseInt(reportLeads) || 0,
                deals_closed: parseInt(reportDeals) || 0
            });
            Alert.alert("✅ Успешно", "Ваш отчет за день успешно отправлен руководителю.");
            setHasReportToday(true); // Отчет сдан!
            setReportModalVisible(false);
            setReportContent('');
        } catch (error: any) {
            Alert.alert("❌ Ошибка", "Не удалось отправить отчет. Проверьте соединение.");
        } finally {
            setSubmittingReport(false);
        }
    };

    const handleActionDev = (actionName: string) => {
        Alert.alert("🛠 В разработке", `Раздел "${actionName}" скоро появится!`);
    };

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}>
                
                {/* БЛОК: Смена и Быстрые действия */}
                <BlurView intensity={50} tint="dark" style={styles.glassCard}>
                    <View style={styles.shiftHeader}>
                        <View style={styles.shiftInfo}>
                            <Ionicons name="time" size={24} color={shiftActive ? "#34d399" : "#3b82f6"} />
                            <View style={{ marginLeft: 12 }}>
                                <Text style={styles.shiftTitle}>Мой рабочий день</Text>
                                <Text style={styles.shiftSubtitle}>
                                    {shiftActive ? '🟢 Вы находитесь в офисе' : '🔴 Смена закрыта'}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity 
                            style={[
                                styles.shiftBtn, 
                                { backgroundColor: shiftActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)' },
                                // Визуально делаем кнопку блеклой, если хотим завершить смену, но отчета нет
                                (shiftActive && !hasReportToday) && { borderColor: 'rgba(239, 68, 68, 0.8)', borderWidth: 2 } 
                            ]}
                            onPress={handleShiftToggle}
                        >
                            <Text style={[styles.shiftBtnText, { color: shiftActive ? '#fca5a5' : '#6ee7b7' }]}>
                                {shiftActive ? 'Завершить' : 'Начать'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.actionsGrid}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleActionDev('Добавить клиента')}>
                            <View style={[styles.actionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                                <Ionicons name="person-add" size={20} color="#60a5fa" />
                            </View>
                            <Text style={styles.actionText}>Клиент</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleActionDev('Добавить сделку')}>
                            <View style={[styles.actionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                                <Ionicons name="briefcase" size={20} color="#fbbf24" />
                            </View>
                            <Text style={styles.actionText}>Сделка</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleActionDev('Добавить платёж')}>
                            <View style={[styles.actionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                                <Ionicons name="cash" size={20} color="#34d399" />
                            </View>
                            <Text style={styles.actionText}>Платёж</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionBtn} onPress={() => setReportModalVisible(true)}>
                            <View style={[styles.actionIcon, { backgroundColor: hasReportToday ? 'rgba(16, 185, 129, 0.2)' : 'rgba(168, 85, 247, 0.2)' }]}>
                                <Ionicons name={hasReportToday ? "checkmark-done-circle" : "document-text"} size={20} color={hasReportToday ? "#34d399" : "#c084fc"} />
                            </View>
                            <Text style={styles.actionText}>{hasReportToday ? 'Сдан!' : 'Отчет'}</Text>
                        </TouchableOpacity>
                    </View>
                </BlurView>

                {/* БЛОК: Новые заявки */}
                <Text style={styles.sectionTitle}>🔥 Новые заявки</Text>
                {leads.length === 0 ? (
                    <Text style={styles.emptyText}>Свободных заявок нет</Text>
                ) : (
                    leads.slice(0, 3).map((lead) => (
                        <BlurView key={lead.id} intensity={30} tint="dark" style={styles.listCard}>
                            <View style={styles.listContent}>
                                <Text style={styles.listTitle}>{lead.full_name}</Text>
                                <Text style={styles.listSubtitle}>📞 {lead.phone} | {lead.direction || 'Без направления'}</Text>
                            </View>
                            <TouchableOpacity style={styles.takeBtn} onPress={() => handleActionDev('Забрать заявку')}>
                                <Text style={styles.takeBtnText}>В работу</Text>
                            </TouchableOpacity>
                        </BlurView>
                    ))
                )}

                {/* БЛОК: Мои задачи */}
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>✅ Мои задачи</Text>
                {tasks.length === 0 ? (
                    <Text style={styles.emptyText}>У вас пока нет задач</Text>
                ) : (
                    tasks.slice(0, 5).map((task) => (
                        <BlurView key={task.id} intensity={30} tint="dark" style={styles.listCard}>
                            <View style={[styles.statusIndicator, { backgroundColor: task.status === 'done' ? '#10b981' : '#3b82f6' }]} />
                            <View style={styles.listContent}>
                                <Text style={styles.listTitle}>{task.title}</Text>
                                <Text style={styles.listSubtitle}>
                                    {task.priority === 'high' ? '🔥 Срочно' : '⚡ ' + task.priority}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
                        </BlurView>
                    ))
                )}

            </ScrollView>

            {/* МОДАЛКА: Ежедневный отчет */}
            <Modal visible={reportModalVisible} animationType="fade" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <BlurView intensity={90} tint="dark" style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Итоги дня</Text>
                            <TouchableOpacity onPress={() => setReportModalVisible(false)} style={styles.closeModalBtn}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {hasReportToday && (
                                <Text style={{color: '#34d399', marginBottom: 15, fontWeight: 'bold'}}>
                                    Вы уже сдавали отчет сегодня, но можете отправить еще один.
                                </Text>
                            )}
                            
                            <Text style={styles.label}>Что проделано за день?</Text>
                            <TextInput 
                                style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
                                placeholder="Опишите задачи, звонки, встречи..."
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                multiline
                                value={reportContent}
                                onChangeText={setReportContent}
                            />

                            <View style={styles.rowInputs}>
                                <View style={{flex: 1, marginRight: 15}}>
                                    <Text style={styles.label}>Обработано заявок</Text>
                                    <TextInput 
                                        style={styles.input} keyboardType="numeric"
                                        value={reportLeads} onChangeText={setReportLeads}
                                    />
                                </View>
                                <View style={{flex: 1}}>
                                    <Text style={styles.label}>Закрыто сделок</Text>
                                    <TextInput 
                                        style={styles.input} keyboardType="numeric"
                                        value={reportDeals} onChangeText={setReportDeals}
                                    />
                                </View>
                            </View>

                            <TouchableOpacity 
                                style={styles.submitBtn} 
                                onPress={submitReport} 
                                disabled={submittingReport}
                            >
                                {submittingReport ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Отправить отчет</Text>}
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
    glassCard: {
        padding: 20, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(0,0,0,0.2)', marginBottom: 25,
    },
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
    listCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.05)' },
    statusIndicator: { width: 12, height: 12, borderRadius: 6, marginRight: 15 },
    listContent: { flex: 1 },
    listTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 4 },
    listSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
    takeBtn: { backgroundColor: 'rgba(59,130,246,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(59,130,246,0.4)' },
    takeBtnText: { color: '#60a5fa', fontSize: 12, fontWeight: 'bold' },
    emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', paddingVertical: 10 },

    // Стили Модалки
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 25, maxHeight: '85%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderBottomWidth: 0 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    modalTitle: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: 0.5 },
    closeModalBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 15, padding: 6 },
    label: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
    input: { backgroundColor: 'rgba(0,0,0,0.2)', color: '#fff', borderRadius: 16, padding: 15, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20 },
    rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
    submitBtn: { backgroundColor: '#3b82f6', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16, letterSpacing: 0.5 }
});