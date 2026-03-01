// app/(app)/profile.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
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

    // Стейты для редактируемых полей
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        middleName: '',
        dob: '',
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

            // Запрос свежих данных
            const res = await apiClient.get('/users/users/me/');
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
                dob: form.dob || null,
                work_status: form.workStatus
            };

            const res = await apiClient.patch('/users/users/me/', payload);
            setUser(res.data);
            await saveToken('cache_my_profile', JSON.stringify(res.data));
            Alert.alert("Успешно", "Профиль обновлен");
        } catch (error: any) {
            Alert.alert("Ошибка", "Не удалось сохранить изменения. Проверьте интернет.");
            console.error("Profile update error", error.response?.data);
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert("Выход", "Вы уверены, что хотите выйти из аккаунта?", [
            { text: "Отмена", style: "cancel" },
            { 
                text: "Выйти", 
                style: "destructive",
                onPress: async () => {
                    await deleteToken('access_token');
                    await deleteToken('refresh_token');
                    await deleteToken('cache_my_profile'); // Очищаем кэш профиля при выходе
                    router.replace('/login');
                }
            }
        ]);
    };

    if (loading && !user) {
        return (
            <ScreenWrapper>
                <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}>
                
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Личный кабинет</Text>
                </View>

                {/* --- КАРТОЧКА ПОЛЬЗОВАТЕЛЯ --- */}
                <BlurView intensity={40} tint="dark" style={styles.profileCard}>
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
                                    <Ionicons name={user?.is_effective === false ? "warning" : "checkmark-circle"} size={12} color={user?.is_effective === false ? "#fca5a5" : "#6ee7b7"} />
                                    <Text style={[styles.badgeText, { color: user?.is_effective === false ? "#fca5a5" : "#6ee7b7" }]}>
                                        {user?.is_effective === false ? "Низкая активность" : "Эффективен"}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Доп. инфа Read-Only */}
                    <View style={styles.readOnlyBlock}>
                        <View style={styles.infoRow}>
                            <Ionicons name="briefcase-outline" size={16} color="rgba(255,255,255,0.5)" />
                            <Text style={styles.infoText}>{user?.job_description || 'Должность не указана'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.5)" />
                            <Text style={styles.infoText}>{user?.office_name || 'Офис не привязан'}</Text>
                        </View>
                    </View>
                </BlurView>

                <Text style={styles.sectionTitle}>Настройки профиля</Text>
                
                {/* --- ФОРМА РЕДАКТИРОВАНИЯ --- */}
                <BlurView intensity={30} tint="dark" style={styles.formCard}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Имя</Text>
                        <TextInput 
                            style={styles.input} 
                            value={form.firstName} 
                            onChangeText={(t) => setForm({...form, firstName: t})} 
                            placeholder="Ваше имя" 
                            placeholderTextColor="rgba(255,255,255,0.3)" 
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Фамилия</Text>
                        <TextInput 
                            style={styles.input} 
                            value={form.lastName} 
                            onChangeText={(t) => setForm({...form, lastName: t})} 
                            placeholder="Ваша фамилия" 
                            placeholderTextColor="rgba(255,255,255,0.3)" 
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Отчество</Text>
                        <TextInput 
                            style={styles.input} 
                            value={form.middleName} 
                            onChangeText={(t) => setForm({...form, middleName: t})} 
                            placeholder="Необязательно" 
                            placeholderTextColor="rgba(255,255,255,0.3)" 
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Дата рождения</Text>
                        <View style={styles.inputWithIcon}>
                            <Ionicons name="calendar-outline" size={18} color="rgba(255,255,255,0.5)" style={styles.inputIcon} />
                            <TextInput 
                                style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]} 
                                value={form.dob} 
                                onChangeText={(t) => setForm({...form, dob: t})} 
                                placeholder="YYYY-MM-DD" 
                                placeholderTextColor="rgba(255,255,255,0.3)" 
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Рабочий статус</Text>
                        <View style={styles.statusContainer}>
                            <TouchableOpacity 
                                style={[styles.statusBtn, form.workStatus === 'working' && styles.statusBtnActive]} 
                                onPress={() => setForm({...form, workStatus: 'working'})}
                            >
                                <Text style={[styles.statusText, form.workStatus === 'working' && styles.statusTextActive]}>В офисе</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.statusBtn, form.workStatus === 'vacation' && styles.statusBtnActive]} 
                                onPress={() => setForm({...form, workStatus: 'vacation'})}
                            >
                                <Text style={[styles.statusText, form.workStatus === 'vacation' && styles.statusTextActive]}>Отпуск</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.statusBtn, form.workStatus === 'sick' && styles.statusBtnActive]} 
                                onPress={() => setForm({...form, workStatus: 'sick'})}
                            >
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
                <BlurView intensity={30} tint="dark" style={styles.systemCard}>
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
    
    header: { marginBottom: 20, paddingHorizontal: 5 },
    headerTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
    
    // Карточка профиля (верхняя)
    profileCard: { padding: 20, borderRadius: 24, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.2)' },
    avatarSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    avatarImage: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: '#3b82f6' },
    avatarPlaceholder: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(59, 130, 246, 0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#3b82f6' },
    avatarInitials: { color: '#60a5fa', fontSize: 28, fontWeight: 'bold' },
    userInfo: { marginLeft: 15, flex: 1 },
    userName: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
    userEmail: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 8 },
    
    badgeRow: { flexDirection: 'row' },
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    badgeSuccess: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' },
    badgeDanger: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' },
    badgeText: { fontSize: 11, fontWeight: 'bold', marginLeft: 4, textTransform: 'uppercase' },

    readOnlyBlock: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 15, gap: 10 },
    infoRow: { flexDirection: 'row', alignItems: 'center' },
    infoText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginLeft: 10, fontWeight: '500' },

    sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 5 },
    
    // Форма редактирования
    formCard: { padding: 20, borderRadius: 24, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.02)' },
    inputGroup: { marginBottom: 16 },
    label: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 8 },
    input: { backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', outlineStyle: 'none' },
    
    inputWithIcon: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
    inputIcon: { paddingLeft: 15 },

    statusContainer: { flexDirection: 'row', gap: 10 },
    statusBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    statusBtnActive: { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3b82f6' },
    statusText: { color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: 13 },
    statusTextActive: { color: '#fff' },

    saveBtn: { flexDirection: 'row', backgroundColor: '#3b82f6', paddingVertical: 15, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15, marginLeft: 8 },

    // Системный блок
    systemCard: { padding: 15, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', backgroundColor: 'rgba(239, 68, 68, 0.05)' },
    logoutBtn: { flexDirection: 'row', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
    logoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 15, marginLeft: 8 }
});