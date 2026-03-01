// app/(app)/profile.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';
import { deleteToken, getToken, saveToken } from '../../src/utils/storage';

export default function ProfileScreen() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);

    // Стейты для всех редактируемых полей из БД
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        middleName: '',
        dob: '',
        socialContacts: '',
        jobDescription: '',
        workStatus: 'working'
    });

    const loadProfile = async () => {
        try {
            // Быстрая загрузка из кэша
            const cached = await getToken('cache_my_profile');
            if (cached) {
                const parsed = JSON.parse(cached);
                setUser(parsed);
                initForm(parsed);
            }

            // Запрос свежих данных (убрали начальный слеш для Axios)
            const res = await apiClient.get('users/users/me/');
            setUser(res.data);
            initForm(res.data);
            await saveToken('cache_my_profile', JSON.stringify(res.data));
        } catch (error) {
            console.log("Офлайн режим или ошибка загрузки профиля");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const initForm = (data: any) => {
        setForm({
            firstName: data.first_name || '',
            lastName: data.last_name || '',
            middleName: data.middle_name || '',
            dob: data.dob || '',
            socialContacts: data.social_contacts || '',
            jobDescription: data.job_description || '',
            workStatus: data.work_status || 'working'
        });
    };

    useEffect(() => {
        loadProfile();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadProfile();
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                first_name: form.firstName,
                last_name: form.lastName,
                middle_name: form.middleName,
                dob: form.dob || null, // Защита от 400 ошибки пустой даты
                social_contacts: form.socialContacts,
                job_description: form.jobDescription,
                work_status: form.workStatus
            };

            const res = await apiClient.patch('users/users/me/', payload);
            setUser(res.data);
            await saveToken('cache_my_profile', JSON.stringify(res.data));
            Alert.alert("Успешно", "Профиль обновлен");
        } catch (error: any) {
            Alert.alert("Ошибка", "Не удалось сохранить изменения. Проверьте данные и интернет.");
            console.error("Profile update error", error.response?.data);
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        Alert.alert("Выход", "Вы уверены, что хотите выйти из аккаунта?", [
            { text: "Отмена", style: "cancel" },
            { 
                text: "Выйти", 
                style: "destructive",
                onPress: async () => {
                    try {
                        // Жестко вычищаем все токены
                        await deleteToken('access_token');
                        await deleteToken('refresh_token');
                        await deleteToken('cache_my_profile');
                        
                        // Перекидываем на логин или корень, чтобы система сбросила сессию
                        router.replace('/login');
                    } catch (error) {
                        console.error("Ошибка при выходе", error);
                    }
                }
            }
        ]);
    };

    if (loading && !user) {
        return (
            <ScreenWrapper>
                <View style={styles.center}><ActivityIndicator size="large" color="#0D416D" /></View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient colors={['#F1F5F9', '#E2E8F0']} style={StyleSheet.absoluteFillObject} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D416D" />}>
                
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Личный кабинет</Text>
                </View>

                {/* --- КАРТОЧКА ПОЛЬЗОВАТЕЛЯ --- */}
                <BlurView intensity={50} tint="light" style={styles.profileCard}>
                    <View style={styles.avatarSection}>
                        {user?.avatar ? (
                            <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarInitials}>
                                    {user?.first_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase()}
                                </Text>
                            </View>
                        )}
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>{user?.first_name} {user?.last_name}</Text>
                            <Text style={styles.userEmail}>{user?.email}</Text>
                            
                            <View style={styles.badgeRow}>
                                <View style={[styles.badge, user?.is_effective === false ? styles.badgeDanger : styles.badgeSuccess]}>
                                    <Ionicons name={user?.is_effective === false ? "warning" : "checkmark-circle"} size={12} color={user?.is_effective === false ? "#ef4444" : "#10b981"} />
                                    <Text style={[styles.badgeText, { color: user?.is_effective === false ? "#ef4444" : "#10b981" }]}>
                                        {user?.is_effective === false ? "Низкая активность" : "Эффективен"}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Доп. инфа Read-Only */}
                    <View style={styles.readOnlyBlock}>
                        <View style={styles.infoRow}>
                            <Ionicons name="location" size={16} color="#0D416D" />
                            <Text style={styles.infoText}>{user?.office?.city ? `${user.office.city}, ${user.office.address}` : 'Офис не привязан'}</Text>
                        </View>
                    </View>
                </BlurView>

                <Text style={styles.sectionTitle}>Настройки профиля</Text>
                
                {/* --- ФОРМА РЕДАКТИРОВАНИЯ --- */}
                <BlurView intensity={50} tint="light" style={styles.formCard}>
                    
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Имя</Text>
                        <TextInput style={styles.input} value={form.firstName} onChangeText={(t) => setForm({...form, firstName: t})} placeholder="Ваше имя" placeholderTextColor="#94A3B8" />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Фамилия</Text>
                        <TextInput style={styles.input} value={form.lastName} onChangeText={(t) => setForm({...form, lastName: t})} placeholder="Ваша фамилия" placeholderTextColor="#94A3B8" />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Отчество</Text>
                        <TextInput style={styles.input} value={form.middleName} onChangeText={(t) => setForm({...form, middleName: t})} placeholder="Необязательно" placeholderTextColor="#94A3B8" />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Дата рождения</Text>
                        <View style={styles.inputWithIcon}>
                            <Ionicons name="calendar-outline" size={18} color="#64748B" style={styles.inputIcon} />
                            <TextInput style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0, backgroundColor: 'transparent' }]} value={form.dob} onChangeText={(t) => setForm({...form, dob: t})} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />
                        </View>
                    </View>

                    {/* НОВЫЕ ПОЛЯ ИЗ МОДЕЛИ DJANGO */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Соцсети и Контакты</Text>
                        <TextInput style={styles.input} value={form.socialContacts} onChangeText={(t) => setForm({...form, socialContacts: t})} placeholder="Telegram: @nick, Phone..." placeholderTextColor="#94A3B8" />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>О себе / Должность</Text>
                        <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline value={form.jobDescription} onChangeText={(t) => setForm({...form, jobDescription: t})} placeholder="Описание вашей роли в компании..." placeholderTextColor="#94A3B8" />
                    </View>

                    {/* СТАТУС РАБОТЫ */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Рабочий статус</Text>
                        <View style={styles.statusContainer}>
                            <TouchableOpacity style={[styles.statusBtn, form.workStatus === 'working' && styles.statusBtnActive]} onPress={() => setForm({...form, workStatus: 'working'})}>
                                <Text style={[styles.statusText, form.workStatus === 'working' && styles.statusTextActive]}>В офисе</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.statusBtn, form.workStatus === 'vacation' && styles.statusBtnActive]} onPress={() => setForm({...form, workStatus: 'vacation'})}>
                                <Text style={[styles.statusText, form.workStatus === 'vacation' && styles.statusTextActive]}>Отпуск</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.statusBtn, form.workStatus === 'sick' && styles.statusBtnActive]} onPress={() => setForm({...form, workStatus: 'sick'})}>
                                <Text style={[styles.statusText, form.workStatus === 'sick' && styles.statusTextActive]}>Болею</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : (
                            <>
                                <Ionicons name="save-outline" size={18} color="#fff" />
                                <Text style={styles.saveBtnText}>Сохранить изменения</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </BlurView>

                {/* --- СИСТЕМНЫЕ ДЕЙСТВИЯ --- */}
                <Text style={styles.sectionTitle}>Система</Text>
                <BlurView intensity={50} tint="light" style={styles.systemCard}>
                    <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                        <Text style={styles.logoutText}>Выйти из аккаунта</Text>
                    </TouchableOpacity>
                </BlurView>

                <View style={{height: 100}} />
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { padding: 20 },
    
    header: { marginBottom: 20, paddingHorizontal: 5, marginTop: 10 },
    headerTitle: { color: '#0F172A', fontSize: 26, fontWeight: '900' },
    
    // Карточка профиля (верхняя)
    profileCard: { padding: 24, borderRadius: 32, marginBottom: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(255,255,255,0.5)', overflow: 'hidden' },
    avatarSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    avatarImage: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: '#0D416D' },
    avatarPlaceholder: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(13, 65, 109, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0D416D' },
    avatarInitials: { color: '#0D416D', fontSize: 32, fontWeight: '900' },
    userInfo: { marginLeft: 20, flex: 1 },
    userName: { color: '#0F172A', fontSize: 20, fontWeight: '900', marginBottom: 4 },
    userEmail: { color: '#64748B', fontSize: 13, marginBottom: 10, fontWeight: '600' },
    
    badgeRow: { flexDirection: 'row' },
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
    badgeSuccess: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' },
    badgeDanger: { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' },
    badgeText: { fontSize: 11, fontWeight: '900', marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

    readOnlyBlock: { borderTopWidth: 1, borderTopColor: 'rgba(15,23,42,0.05)', paddingTop: 15, gap: 10 },
    infoRow: { flexDirection: 'row', alignItems: 'center' },
    infoText: { color: '#334155', fontSize: 14, marginLeft: 10, fontWeight: '700' },

    sectionTitle: { color: '#334155', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 5 },
    
    // Форма редактирования
    formCard: { padding: 24, borderRadius: 32, marginBottom: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.4)', overflow: 'hidden' },
    inputGroup: { marginBottom: 20 },
    label: { color: '#475569', fontSize: 11, textTransform: 'uppercase', fontWeight: '900', marginBottom: 8, marginLeft: 6, letterSpacing: 0.5 },
    input: { backgroundColor: 'rgba(255, 255, 255, 0.8)', color: '#1E293B', borderRadius: 16, paddingHorizontal: 16, height: 55, fontSize: 15, borderWidth: 1, borderColor: '#E2E8F0', outlineStyle: 'none', fontWeight: '700' },
    
    inputWithIcon: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', height: 55 },
    inputIcon: { paddingLeft: 15 },

    statusContainer: { flexDirection: 'row', gap: 10 },
    statusBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: '#E2E8F0' },
    statusBtnActive: { backgroundColor: '#0D416D', borderColor: '#0D416D', shadowColor: '#0D416D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 },
    statusText: { color: '#64748B', fontWeight: '800', fontSize: 13 },
    statusTextActive: { color: '#fff' },

    saveBtn: { flexDirection: 'row', backgroundColor: '#0D416D', paddingVertical: 18, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#0D416D', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
    saveBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, marginLeft: 8, letterSpacing: 0.5 },

    // Системный блок
    systemCard: { padding: 15, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)', overflow: 'hidden' },
    logoutBtn: { flexDirection: 'row', padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
    logoutText: { color: '#ef4444', fontWeight: '900', fontSize: 16, marginLeft: 8 }
});