// app/(app)/profile.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';
import { deleteToken, getToken, saveToken } from '../../src/utils/storage';

export default function ProfileScreen() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        middleName: '',
        dob: '',
        socialContacts: '',
        jobDescription: '',
        workStatus: 'working',
    });

    const loadProfile = async () => {
        try {
            const cached = await getToken('cache_my_profile');
            if (cached) {
                const parsed = JSON.parse(cached);
                setUser(parsed);
                initForm(parsed);
            }
            const res = await apiClient.get('users/users/me/');
            setUser(res.data);
            initForm(res.data);
            await saveToken('cache_my_profile', JSON.stringify(res.data));
        } catch {
            console.log('Офлайн режим: показываем кэш профиля');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const initForm = (data: any) => {
        setForm({
            firstName:      data.first_name       ?? '',
            lastName:       data.last_name        ?? '',
            middleName:     data.middle_name      ?? '',
            dob:            data.dob              ?? '',
            socialContacts: data.social_contacts  ?? '',
            jobDescription: data.job_description  ?? '',
            workStatus:     data.work_status      ?? 'working',
        });
    };

    useEffect(() => { loadProfile(); }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                first_name:       form.firstName,
                last_name:        form.lastName,
                middle_name:      form.middleName,
                dob:              form.dob || null,
                social_contacts:  form.socialContacts,
                job_description:  form.jobDescription,
                work_status:      form.workStatus,
            };
            const res = await apiClient.patch('users/users/me/', payload);
            setUser(res.data);
            await saveToken('cache_my_profile', JSON.stringify(res.data));
            Alert.alert('Сохранено ✓', 'Профиль обновлён');
        } catch (error: any) {
            Alert.alert('Ошибка', 'Не удалось сохранить. Проверьте формат даты (YYYY-MM-DD).');
            console.error(error.response?.data);
        } finally {
            setSaving(false);
        }
    };

    const performLogout = async () => {
        await deleteToken('access_token');
        await deleteToken('refresh_token');
        await deleteToken('cache_my_profile');
        router.replace('/login');
    };

    const handleLogout = () => {
        if (Platform.OS === 'web') {
            if (window.confirm('Выйти из аккаунта?')) performLogout();
        } else {
            Alert.alert('Выход', 'Выйти из аккаунта?', [
                { text: 'Отмена', style: 'cancel' },
                { text: 'Выйти', style: 'destructive', onPress: performLogout },
            ]);
        }
    };

    if (loading && !user) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#0D416D" />
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient
                    colors={['#F8FAFC', '#F1F5F9', '#E2E8F0']}
                    style={StyleSheet.absoluteFillObject}
                />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.container}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); loadProfile(); }}
                        tintColor="#0D416D"
                    />
                }
            >
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Личный кабинет</Text>
                </View>

                {/* Карточка пользователя */}
                <BlurView intensity={50} tint="light" style={styles.profileCard}>
                    <View style={styles.avatarSection}>
                        {user?.avatar ? (
                            <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarInitials}>
                                    {user?.first_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || '?'}
                                </Text>
                            </View>
                        )}
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>
                                {user?.first_name} {user?.last_name}
                            </Text>
                            <Text style={styles.userEmail}>{user?.email}</Text>
                            <View style={styles.badgeRow}>
                                <View
                                    style={[
                                        styles.badge,
                                        user?.is_effective === false
                                            ? styles.badgeDanger
                                            : styles.badgeSuccess,
                                    ]}
                                >
                                    <Ionicons
                                        name={user?.is_effective === false ? 'warning' : 'checkmark-circle'}
                                        size={14}
                                        color={user?.is_effective === false ? '#ef4444' : '#10b981'}
                                    />
                                    <Text
                                        style={[
                                            styles.badgeText,
                                            {
                                                color:
                                                    user?.is_effective === false
                                                        ? '#ef4444'
                                                        : '#10b981',
                                            },
                                        ]}
                                    >
                                        {user?.is_effective === false
                                            ? 'Низкая активность'
                                            : 'Эффективен'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={styles.readOnlyBlock}>
                        <View style={styles.infoRow}>
                            <Ionicons name="location" size={16} color="#64748B" />
                            <Text style={styles.infoText}>
                                {user?.office?.city
                                    ? `${user.office.city}, ${user.office.address}`
                                    : 'Офис не привязан'}
                            </Text>
                        </View>
                    </View>
                </BlurView>

                {/* ─── БЫСТРЫЕ ДЕЙСТВИЯ ─────────────────────────── */}
                <Text style={styles.sectionTitle}>Обучение</Text>

                {/* Кнопка База знаний */}
                <TouchableOpacity
                    style={styles.quickActionBtn}
                    onPress={() => router.push('/knowledge-base' as any)}
                    activeOpacity={0.8}
                >
                    <BlurView intensity={55} tint="light" style={styles.quickActionInner}>
                        <View style={[styles.qaIcon, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
                            <Ionicons name="library" size={26} color="#8b5cf6" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.qaTitle}>База знаний</Text>
                            <Text style={styles.qaSubtitle}>
                                Скрипты, FAQ, видеоуроки и тесты
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                    </BlurView>
                </TouchableOpacity>

                {/* ─── ФОРМА ────────────────────────────────────── */}
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Настройки профиля</Text>

                <BlurView intensity={60} tint="light" style={styles.formCard}>
                    <InputField
                        label="Имя"
                        value={form.firstName}
                        onChange={v => setForm({ ...form, firstName: v })}
                        placeholder="Ваше имя"
                    />
                    <InputField
                        label="Фамилия"
                        value={form.lastName}
                        onChange={v => setForm({ ...form, lastName: v })}
                        placeholder="Ваша фамилия"
                    />
                    <InputField
                        label="Отчество"
                        value={form.middleName}
                        onChange={v => setForm({ ...form, middleName: v })}
                        placeholder="Необязательно"
                    />
                    <InputField
                        label="Дата рождения"
                        value={form.dob}
                        onChange={v => setForm({ ...form, dob: v })}
                        placeholder="YYYY-MM-DD"
                        icon="calendar-outline"
                    />
                    <InputField
                        label="Соцсети и контакты"
                        value={form.socialContacts}
                        onChange={v => setForm({ ...form, socialContacts: v })}
                        placeholder="Telegram: @nick..."
                        icon="at-outline"
                    />
                    <InputField
                        label="Должность / О себе"
                        value={form.jobDescription}
                        onChange={v => setForm({ ...form, jobDescription: v })}
                        placeholder="Описание вашей роли..."
                        multiline
                    />

                    {/* Статус */}
                    <Text style={styles.label}>Текущий статус</Text>
                    <View style={styles.statusContainer}>
                        {(['working', 'vacation', 'sick'] as const).map(s => (
                            <TouchableOpacity
                                key={s}
                                style={[
                                    styles.statusBtn,
                                    form.workStatus === s && styles.statusBtnActive,
                                ]}
                                onPress={() => setForm({ ...form, workStatus: s })}
                            >
                                <Text
                                    style={[
                                        styles.statusText,
                                        form.workStatus === s && styles.statusTextActive,
                                    ]}
                                >
                                    {s === 'working'
                                        ? '🟢 В офисе'
                                        : s === 'vacation'
                                        ? '🟡 Отпуск'
                                        : '🔴 Болею'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={styles.saveBtn}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="save-outline" size={20} color="#fff" />
                                <Text style={styles.saveBtnText}>Сохранить изменения</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </BlurView>

                {/* Выход */}
                <Text style={styles.sectionTitle}>Система</Text>
                <BlurView intensity={50} tint="light" style={styles.systemCard}>
                    <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                        <Text style={styles.logoutText}>Выйти из аккаунта</Text>
                    </TouchableOpacity>
                </BlurView>

                <View style={{ height: 20 }} />
            </ScrollView>
        </ScreenWrapper>
    );
}

// ─── Переиспользуемый инпут ──────────────────────────────────────────────────

function InputField({
    label,
    value,
    onChange,
    placeholder,
    icon,
    multiline,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    icon?: string;
    multiline?: boolean;
}) {
    return (
        <View style={styles.inputGroup}>
            <Text style={styles.label}>{label}</Text>
            {icon ? (
                <View style={styles.inputWithIcon}>
                    <Ionicons name={icon as any} size={18} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0, backgroundColor: 'transparent' }]}
                        value={value}
                        onChangeText={onChange}
                        placeholder={placeholder}
                        placeholderTextColor="#94A3B8"
                    />
                </View>
            ) : (
                <TextInput
                    style={[
                        styles.input,
                        multiline && { height: 80, textAlignVertical: 'top', paddingTop: 14 },
                    ]}
                    multiline={multiline}
                    value={value}
                    onChangeText={onChange}
                    placeholder={placeholder}
                    placeholderTextColor="#94A3B8"
                />
            )}
        </View>
    );
}

// ─── Стили ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { padding: 20 },

    header: { marginBottom: 20, paddingHorizontal: 5, marginTop: 10 },
    headerTitle: { color: '#0F172A', fontSize: 26, fontWeight: '900' },

    profileCard: {
        padding: 24,
        borderRadius: 32,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.9)',
        backgroundColor: 'rgba(255,255,255,0.6)',
        overflow: 'hidden',
    },
    avatarSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    avatarImage: {
        width: 76, height: 76, borderRadius: 38,
        borderWidth: 2, borderColor: '#0D416D',
    },
    avatarPlaceholder: {
        width: 76, height: 76, borderRadius: 38,
        backgroundColor: 'rgba(13,65,109,0.1)',
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: '#0D416D',
    },
    avatarInitials: { color: '#0D416D', fontSize: 32, fontWeight: '900' },
    userInfo: { marginLeft: 20, flex: 1 },
    userName: { color: '#0F172A', fontSize: 20, fontWeight: '900', marginBottom: 4 },
    userEmail: { color: '#64748B', fontSize: 13, marginBottom: 10, fontWeight: '600' },
    badgeRow: { flexDirection: 'row' },
    badge: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 12, borderWidth: 1,
    },
    badgeSuccess: {
        backgroundColor: 'rgba(16,185,129,0.15)',
        borderColor: 'rgba(16,185,129,0.3)',
    },
    badgeDanger: {
        backgroundColor: 'rgba(239,68,68,0.15)',
        borderColor: 'rgba(239,68,68,0.3)',
    },
    badgeText: { fontSize: 11, fontWeight: '900', marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 },

    readOnlyBlock: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(15,23,42,0.1)',
        paddingTop: 15,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center' },
    infoText: { color: '#334155', fontSize: 14, marginLeft: 10, fontWeight: '700' },

    sectionTitle: {
        color: '#334155', fontSize: 13, fontWeight: '900',
        textTransform: 'uppercase', letterSpacing: 1.5,
        marginBottom: 12, marginLeft: 5,
    },

    // Quick action (База знаний)
    quickActionBtn: { marginBottom: 10, borderRadius: 24, overflow: 'hidden' },
    quickActionInner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.8)',
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderRadius: 24,
        overflow: 'hidden',
        gap: 14,
    },
    qaIcon: {
        width: 52, height: 52, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center',
    },
    qaTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900', marginBottom: 3 },
    qaSubtitle: { color: '#64748B', fontSize: 12, fontWeight: '600' },

    formCard: {
        padding: 24, borderRadius: 32, marginBottom: 24,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)',
        backgroundColor: 'rgba(255,255,255,0.6)', overflow: 'hidden',
    },
    inputGroup: { marginBottom: 20 },
    label: {
        color: '#475569', fontSize: 11, textTransform: 'uppercase',
        fontWeight: '900', marginBottom: 8, marginLeft: 6, letterSpacing: 0.5,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.8)', color: '#1E293B',
        borderRadius: 16, paddingHorizontal: 16, height: 55,
        fontSize: 15, borderWidth: 1, borderColor: '#E2E8F0', fontWeight: '700',
    },
    inputWithIcon: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.8)',
        borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0',
        overflow: 'hidden', height: 55,
    },
    inputIcon: { paddingLeft: 15 },
    statusContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    statusBtn: {
        flex: 1, paddingVertical: 14, alignItems: 'center',
        borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.6)',
        borderWidth: 1, borderColor: '#E2E8F0',
    },
    statusBtnActive: {
        backgroundColor: '#fff', borderColor: '#0D416D',
        shadowColor: '#0D416D', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1, shadowRadius: 6,
    },
    statusText: { color: '#64748B', fontWeight: '800', fontSize: 13 },
    statusTextActive: { color: '#0D416D', fontWeight: '900' },
    saveBtn: {
        flexDirection: 'row', backgroundColor: '#0D416D',
        paddingVertical: 18, borderRadius: 20,
        justifyContent: 'center', alignItems: 'center',
        marginTop: 8, shadowColor: '#0D416D',
        shadowOpacity: 0.3, shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 }, elevation: 5,
    },
    saveBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, marginLeft: 10, letterSpacing: 0.5 },

    systemCard: {
        padding: 15, borderRadius: 24,
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
        backgroundColor: 'rgba(239,68,68,0.05)', overflow: 'hidden',
    },
    logoutBtn: {
        flexDirection: 'row', padding: 18, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.6)',
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    },
    logoutText: { color: '#ef4444', fontWeight: '900', fontSize: 16, marginLeft: 8 },
});