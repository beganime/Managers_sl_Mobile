// app/(app)/admin-staff.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, Modal, RefreshControl,
    ScrollView, StyleSheet, Text, TextInput,
    TouchableOpacity, View,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

export default function AdminStaffScreen() {
    const { theme } = useTheme();
    const router    = useRouter();
    const s         = makeStyles(theme);

    const [users,      setUsers]      = useState<any[]>([]);
    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [editUser,   setEditUser]   = useState<any | null>(null);
    const [saving,     setSaving]     = useState(false);

    const [form, setForm] = useState({
        monthly_plan:       '',
        fixed_salary:       '',
        commission_percent: '',
        motivation_target:  '',
        motivation_reward:  '',
    });

    const load = async () => {
        try {
            const res = await apiClient.get('users/users/');
            setUsers(res.data.results ?? res.data);
        } catch { console.log('Офлайн: сотрудники'); }
        finally { setLoading(false); setRefreshing(false); }
    };

    useEffect(() => { load(); }, []);

    const openEdit = (u: any) => {
        setEditUser(u);
        const sal = u.managersalary ?? {};
        setForm({
            monthly_plan:       String(sal.monthly_plan       ?? '5000'),
            fixed_salary:       String(sal.fixed_salary       ?? '0'),
            commission_percent: String(sal.commission_percent ?? '5'),
            motivation_target:  String(sal.motivation_target  ?? '10000'),
            motivation_reward:  String(sal.motivation_reward  ?? '100'),
        });
    };

    const handleSave = async () => {
        if (!editUser) return;
        setSaving(true);
        try {
            await apiClient.patch(`users/users/${editUser.id}/salary/`, {
                monthly_plan:       parseFloat(form.monthly_plan),
                fixed_salary:       parseFloat(form.fixed_salary),
                commission_percent: parseFloat(form.commission_percent),
                motivation_target:  parseFloat(form.motivation_target),
                motivation_reward:  parseFloat(form.motivation_reward),
            });
            Alert.alert('Сохранено ✓', `Финансы ${editUser.first_name} обновлены`);
            setEditUser(null);
            load();
        } catch (e: any) {
            Alert.alert('Ошибка', e.response?.data?.detail ?? 'Не удалось сохранить');
        } finally { setSaving(false); }
    };

    const handleResetBalance = (u: any) => {
        Alert.alert(
            'Выплата зарплаты',
            `Обнулить бонусный баланс ${u.first_name}? ($${parseFloat(u.managersalary?.current_balance ?? 0).toFixed(2)})`,
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Выплатить',
                    onPress: async () => {
                        try {
                            await apiClient.post(`users/users/${u.id}/pay_salary/`);
                            Alert.alert('Готово', 'Баланс обнулён');
                            load();
                        } catch { Alert.alert('Ошибка', 'Не удалось выполнить'); }
                    },
                },
            ]
        );
    };

    if (loading) return (
        <ScreenWrapper>
            <View style={s.center}><ActivityIndicator size="large" color={theme.primaryDeep} /></View>
        </ScreenWrapper>
    );

    return (
        <ScreenWrapper>
            <View style={s.header}>
                <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[s.headerTitle, { color: theme.text }]}>Сотрудники</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.container}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />
                }
            >
                {users.map(u => {
                    const sal      = u.managersalary ?? {};
                    const balance  = parseFloat(sal.current_balance  ?? 0);
                    const revenue  = parseFloat(sal.current_month_revenue ?? 0);
                    const plan     = parseFloat(sal.monthly_plan     ?? 1);
                    const progress = plan > 0 ? Math.min((revenue / plan) * 100, 100) : 0;

                    return (
                        <BlurView key={u.id} intensity={50} tint={theme.mode === 'dark' ? 'dark' : 'light'}
                            style={[s.userCard, { borderColor: theme.borderGlass }]}
                        >
                            {/* Шапка карточки */}
                            <View style={s.userHeader}>
                                <View style={[s.avatar, { backgroundColor: theme.primaryDeep + '20' }]}>
                                    <Text style={[s.avatarText, { color: theme.primaryDeep }]}>
                                        {u.first_name?.charAt(0) ?? '?'}
                                    </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.userName, { color: theme.text }]}>
                                        {u.first_name} {u.last_name}
                                        {u.is_superuser && <Text style={{ color: theme.danger }}> ★</Text>}
                                    </Text>
                                    <Text style={[s.userEmail, { color: theme.textSub }]}>{u.email}</Text>
                                    <Text style={[s.userOffice, { color: theme.textMuted }]}>
                                        <Ionicons name="location-outline" size={11} /> {u.office?.city ?? '—'}
                                    </Text>
                                </View>
                                <View style={[
                                    s.statusDot,
                                    { backgroundColor: u.work_status === 'working' ? theme.accent : u.work_status === 'vacation' ? theme.warning : theme.danger },
                                ]} />
                            </View>

                            {/* KPI */}
                            <View style={[s.kpiRow, { borderTopColor: theme.border }]}>
                                <View style={s.kpiBox}>
                                    <Text style={[s.kpiLabel, { color: theme.textMuted }]}>Выручка</Text>
                                    <Text style={[s.kpiVal, { color: theme.text }]}>
                                        ${revenue.toLocaleString()}
                                    </Text>
                                </View>
                                <View style={s.kpiBox}>
                                    <Text style={[s.kpiLabel, { color: theme.textMuted }]}>Бонус</Text>
                                    <Text style={[s.kpiVal, { color: theme.accent }]}>
                                        ${balance.toFixed(2)}
                                    </Text>
                                </View>
                                <View style={s.kpiBox}>
                                    <Text style={[s.kpiLabel, { color: theme.textMuted }]}>Оклад</Text>
                                    <Text style={[s.kpiVal, { color: theme.text }]}>
                                        ${parseFloat(sal.fixed_salary ?? 0).toLocaleString()}
                                    </Text>
                                </View>
                            </View>

                            {/* Прогресс-бар плана */}
                            <View style={s.progressWrap}>
                                <View style={[s.progressTrack, { backgroundColor: theme.border }]}>
                                    <View style={[s.progressFill, {
                                        width: `${progress}%`,
                                        backgroundColor: progress >= 100 ? theme.accent : theme.primary,
                                    }]} />
                                </View>
                                <Text style={[s.progressText, { color: theme.textSub }]}>
                                    {Math.round(progress)}% от плана ${plan.toLocaleString()}
                                </Text>
                            </View>

                            {/* Кнопки */}
                            <View style={s.btnRow}>
                                <TouchableOpacity style={[s.editBtn, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '40' }]}
                                    onPress={() => openEdit(u)}
                                >
                                    <Ionicons name="settings-outline" size={15} color={theme.primary} />
                                    <Text style={[s.editBtnText, { color: theme.primary }]}>Финансы</Text>
                                </TouchableOpacity>
                                {balance > 0 && (
                                    <TouchableOpacity style={[s.payBtn, { backgroundColor: theme.accent + '15', borderColor: theme.accent + '40' }]}
                                        onPress={() => handleResetBalance(u)}
                                    >
                                        <Ionicons name="cash-outline" size={15} color={theme.accent} />
                                        <Text style={[s.editBtnText, { color: theme.accent }]}>Выплатить</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </BlurView>
                    );
                })}
                <View style={{ height: 20 }} />
            </ScrollView>

            {/* Модалка редактирования финансов */}
            <Modal visible={!!editUser} animationType="slide" transparent onRequestClose={() => setEditUser(null)}>
                <View style={s.modalOverlay}>
                    <BlurView intensity={90} tint={theme.mode === 'dark' ? 'dark' : 'light'}
                        style={[s.modalContent, { backgroundColor: theme.bgGlass }]}
                    >
                        <View style={s.modalHeader}>
                            <Text style={[s.modalTitle, { color: theme.text }]}>
                                Финансы: {editUser?.first_name}
                            </Text>
                            <TouchableOpacity onPress={() => setEditUser(null)}>
                                <Ionicons name="close-circle" size={28} color={theme.textSub} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {[
                                { key: 'monthly_plan',       label: 'План на месяц ($)' },
                                { key: 'fixed_salary',       label: 'Фиксированный оклад ($)' },
                                { key: 'commission_percent', label: 'Процент комиссии (%)' },
                                { key: 'motivation_target',  label: 'Цель мотивации ($)' },
                                { key: 'motivation_reward',  label: 'Сумма бонуса ($)' },
                            ].map(f => (
                                <View key={f.key} style={s.inputGroup}>
                                    <Text style={[s.inputLabel, { color: theme.textSub }]}>{f.label}</Text>
                                    <TextInput
                                        style={[s.input, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
                                        value={(form as any)[f.key]}
                                        onChangeText={v => setForm(prev => ({ ...prev, [f.key]: v }))}
                                        keyboardType="numeric"
                                        placeholderTextColor={theme.textMuted}
                                    />
                                </View>
                            ))}

                            <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.primaryDeep }]}
                                onPress={handleSave} disabled={saving}
                            >
                                {saving
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={s.saveBtnText}>Сохранить</Text>
                                }
                            </TouchableOpacity>
                        </ScrollView>
                    </BlurView>
                </View>
            </Modal>
        </ScreenWrapper>
    );
}

function makeStyles(t: any) {
    return StyleSheet.create({
        center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
        container: { padding: 20 },
        header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
        backBtn:   { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
        headerTitle: { fontSize: 20, fontWeight: '900' },

        userCard:   { borderRadius: 24, marginBottom: 14, borderWidth: 1, overflow: 'hidden', padding: 18 },
        userHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
        avatar:     { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
        avatarText: { fontSize: 20, fontWeight: '900' },
        userName:   { fontSize: 15, fontWeight: '900', marginBottom: 2 },
        userEmail:  { fontSize: 12, fontWeight: '500', marginBottom: 2 },
        userOffice: { fontSize: 11, fontWeight: '500' },
        statusDot:  { width: 10, height: 10, borderRadius: 5 },

        kpiRow: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 12, marginBottom: 12 },
        kpiBox: { flex: 1, alignItems: 'center' },
        kpiLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 3 },
        kpiVal:   { fontSize: 16, fontWeight: '900' },

        progressWrap: { marginBottom: 14 },
        progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
        progressFill:  { height: '100%', borderRadius: 3 },
        progressText:  { fontSize: 11, fontWeight: '600' },

        btnRow:   { flexDirection: 'row', gap: 10 },
        editBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 5 },
        payBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 5 },
        editBtnText: { fontSize: 13, fontWeight: '800' },

        modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
        modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 26, maxHeight: '88%', overflow: 'hidden' },
        modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
        modalTitle:   { fontSize: 20, fontWeight: '900' },
        inputGroup:   { marginBottom: 16 },
        inputLabel:   { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 },
        input:        { borderRadius: 14, paddingHorizontal: 16, height: 50, fontSize: 15, fontWeight: '700', borderWidth: 1 },
        saveBtn:      { paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
        saveBtnText:  { color: '#fff', fontWeight: '900', fontSize: 15 },
    });
}