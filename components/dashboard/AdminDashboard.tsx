// components/dashboard/AdminDashboard.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl, ScrollView,
    StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { CurrentUser } from '../../hooks/useCurrentUser';
import apiClient from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import ScreenWrapper from '../ScreenWrapper';

interface Props {
    user:      CurrentUser;
    onRefresh: () => void;
}

export default function AdminDashboard({ user, onRefresh }: Props) {
    const { theme }     = useTheme();
    const router        = useRouter();
    const s             = makeStyles(theme);
    const [data,        setData]        = useState<any>(null);
    const [loading,     setLoading]     = useState(true);
    const [refreshing,  setRefreshing]  = useState(false);

    const load = useCallback(async () => {
        try {
            const [usersRes, dealsRes, clientsRes, reportsRes, paymentsRes] =
                await Promise.allSettled([
                    apiClient.get('users/users/'),
                    apiClient.get('analytics/deals/'),
                    apiClient.get('clients/'),
                    apiClient.get('reports/daily/'),
                    apiClient.get('analytics/payments/'),
                ]);

            const users    = usersRes.status    === 'fulfilled' ? usersRes.value.data.results    ?? usersRes.value.data    : [];
            const deals    = dealsRes.status    === 'fulfilled' ? dealsRes.value.data.results    ?? dealsRes.value.data    : [];
            const clients  = clientsRes.status  === 'fulfilled' ? clientsRes.value.data.results  ?? clientsRes.value.data  : [];
            const reports  = reportsRes.status  === 'fulfilled' ? reportsRes.value.data.results  ?? reportsRes.value.data  : [];
            const payments = paymentsRes.status === 'fulfilled' ? paymentsRes.value.data.results ?? paymentsRes.value.data : [];

            // KPI
            const confirmedPayments  = payments.filter((p: any) => p.is_confirmed);
            const totalRevenue       = confirmedPayments.reduce((acc: number, p: any) => acc + parseFloat(p.amount_usd || 0), 0);
            const totalNetIncome     = confirmedPayments.reduce((acc: number, p: any) => acc + parseFloat(p.net_income_usd || 0), 0);
            const pendingPayments    = payments.filter((p: any) => !p.is_confirmed);
            const activeDeals        = deals.filter((d: any) => d.payment_status !== 'paid_full');
            const todayStr           = new Date().toISOString().slice(0, 10);
            const todayReports       = reports.filter((r: any) => r.date === todayStr);
            const managers           = users.filter((u: any) => !u.is_superuser);

            setData({
                users, deals, clients, reports, payments,
                kpi: { totalRevenue, totalNetIncome, activeDeals: activeDeals.length, totalClients: clients.length },
                pendingPayments,
                todayReports,
                managers,
            });
        } catch (e) {
            console.log('AdminDashboard load error', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, []);

    const handleRefresh = () => { setRefreshing(true); load(); onRefresh(); };

    if (loading) return (
        <ScreenWrapper>
            <View style={s.center}><ActivityIndicator size="large" color={theme.primaryDeep} /></View>
        </ScreenWrapper>
    );

    return (
        <ScreenWrapper>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.container}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
                }
            >
                {/* Шапка */}
                <View style={s.header}>
                    <View>
                        <Text style={[s.greeting, { color: theme.textSub }]}>Панель управления</Text>
                        <Text style={[s.name, { color: theme.text }]}>
                            {user.first_name} {user.last_name}
                        </Text>
                    </View>
                    <View style={[s.adminBadge, { backgroundColor: theme.danger + '20' }]}>
                        <Ionicons name="shield-checkmark" size={14} color={theme.danger} />
                        <Text style={[s.adminBadgeText, { color: theme.danger }]}>Админ</Text>
                    </View>
                </View>

                {/* KPI карточки */}
                <Text style={[s.sectionTitle, { color: theme.textSub }]}>Показатели</Text>
                <View style={s.kpiGrid}>
                    {[
                        { label: 'Выручка (USD)',  value: `$${Math.round(data?.kpi.totalRevenue || 0).toLocaleString()}`,    icon: 'trending-up',    color: theme.accent   },
                        { label: 'Чистая прибыль', value: `$${Math.round(data?.kpi.totalNetIncome || 0).toLocaleString()}`,  icon: 'cash',           color: theme.primary  },
                        { label: 'Активных сделок', value: String(data?.kpi.activeDeals || 0),                               icon: 'briefcase',      color: theme.warning  },
                        { label: 'Клиентов всего', value: String(data?.kpi.totalClients || 0),                               icon: 'people',         color: theme.purple   },
                    ].map((k, i) => (
                        <BlurView key={i} intensity={50} tint={theme.mode === 'dark' ? 'dark' : 'light'}
                            style={[s.kpiCard, { borderColor: theme.borderGlass }]}
                        >
                            <View style={[s.kpiIcon, { backgroundColor: k.color + '20' }]}>
                                <Ionicons name={k.icon as any} size={20} color={k.color} />
                            </View>
                            <Text style={[s.kpiValue, { color: theme.text }]}>{k.value}</Text>
                            <Text style={[s.kpiLabel, { color: theme.textSub }]}>{k.label}</Text>
                        </BlurView>
                    ))}
                </View>

                {/* Быстрые действия */}
                <Text style={[s.sectionTitle, { color: theme.textSub }]}>Управление</Text>
                <View style={s.actionsRow}>
                    {[
                        { label: 'Сотрудники',  icon: 'people',          route: '/admin-staff',    color: theme.primary  },
                        { label: 'Клиенты',     icon: 'person-add',      route: '/crm',            color: theme.accent   },
                        { label: 'Платежи',     icon: 'card',            route: '/admin-payments', color: theme.warning  },
                        { label: 'Отчёты',      icon: 'document-text',   route: '/admin-reports',  color: theme.purple   },
                    ].map((a, i) => (
                        <TouchableOpacity key={i} style={[s.actionBtn, { backgroundColor: theme.bgCard, borderColor: theme.border }]}
                            onPress={() => router.push(a.route as any)}
                        >
                            <View style={[s.actionIcon, { backgroundColor: a.color + '1A' }]}>
                                <Ionicons name={a.icon as any} size={24} color={a.color} />
                            </View>
                            <Text style={[s.actionLabel, { color: theme.text }]}>{a.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Ожидающие платежи */}
                {(data?.pendingPayments?.length ?? 0) > 0 && (
                    <>
                        <View style={s.sectionRow}>
                            <Text style={[s.sectionTitle, { color: theme.textSub, marginBottom: 0 }]}>
                                Ожидают подтверждения
                            </Text>
                            <View style={[s.countBadge, { backgroundColor: theme.danger + '20' }]}>
                                <Text style={[s.countBadgeText, { color: theme.danger }]}>
                                    {data.pendingPayments.length}
                                </Text>
                            </View>
                        </View>
                        {data.pendingPayments.slice(0, 5).map((p: any) => (
                            <BlurView key={p.id} intensity={45} tint={theme.mode === 'dark' ? 'dark' : 'light'}
                                style={[s.pendingCard, { borderColor: theme.warning + '50' }]}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.pendingTitle, { color: theme.text }]}>
                                        Платёж #{p.id} · Сделка #{p.deal}
                                    </Text>
                                    <Text style={[s.pendingSub, { color: theme.textSub }]}>
                                        {p.method === 'cash' ? '💵 Наличные' : p.method === 'card' ? '💳 Карта' : '🏦 Перевод'}
                                    </Text>
                                </View>
                                <Text style={[s.pendingAmount, { color: theme.warning }]}>
                                    ${parseFloat(p.amount_usd || 0).toLocaleString()}
                                </Text>
                            </BlurView>
                        ))}
                        <TouchableOpacity style={[s.seeAllBtn, { borderColor: theme.border }]}
                            onPress={() => router.push('/admin-payments' as any)}
                        >
                            <Text style={[s.seeAllText, { color: theme.primary }]}>Смотреть все платежи →</Text>
                        </TouchableOpacity>
                    </>
                )}

                {/* Отчёты за сегодня */}
                <View style={s.sectionRow}>
                    <Text style={[s.sectionTitle, { color: theme.textSub, marginBottom: 0 }]}>
                        Отчёты сегодня
                    </Text>
                    <Text style={[s.countBadgeText, { color: theme.accent }]}>
                        {data?.todayReports?.length ?? 0} / {data?.managers?.length ?? 0}
                    </Text>
                </View>

                {(data?.managers ?? []).map((m: any) => {
                    const hasReport = (data?.todayReports ?? []).some((r: any) => r.employee === m.id);
                    return (
                        <BlurView key={m.id} intensity={40} tint={theme.mode === 'dark' ? 'dark' : 'light'}
                            style={[s.managerRow, { borderColor: theme.borderGlass }]}
                        >
                            <View style={[s.managerAvatar, { backgroundColor: theme.primaryDeep + '20' }]}>
                                <Text style={[s.managerAvatarText, { color: theme.primaryDeep }]}>
                                    {m.first_name?.charAt(0) ?? '?'}
                                </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[s.managerName, { color: theme.text }]}>
                                    {m.first_name} {m.last_name}
                                </Text>
                                <Text style={[s.managerOffice, { color: theme.textSub }]}>
                                    {m.office?.city ?? 'Офис не указан'}
                                </Text>
                            </View>
                            <View style={[
                                s.reportStatus,
                                { backgroundColor: hasReport ? theme.accent + '20' : theme.danger + '15' },
                            ]}>
                                <Ionicons
                                    name={hasReport ? 'checkmark-circle' : 'time-outline'}
                                    size={14}
                                    color={hasReport ? theme.accent : theme.danger}
                                />
                                <Text style={[s.reportStatusText, { color: hasReport ? theme.accent : theme.danger }]}>
                                    {hasReport ? 'Сдал' : 'Нет'}
                                </Text>
                            </View>
                        </BlurView>
                    );
                })}

                <View style={{ height: 20 }} />
            </ScrollView>
        </ScreenWrapper>
    );
}

function makeStyles(t: any) {
    return StyleSheet.create({
        center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
        container: { padding: 20 },

        header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 8 },
        greeting: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
        name:     { fontSize: 22, fontWeight: '900' },
        adminBadge:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 5 },
        adminBadgeText: { fontSize: 12, fontWeight: '900' },

        sectionTitle: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
        sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
        countBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
        countBadgeText: { fontSize: 13, fontWeight: '900' },

        kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
        kpiCard: {
            width: '47%', padding: 16, borderRadius: 20,
            borderWidth: 1, overflow: 'hidden',
        },
        kpiIcon:  { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
        kpiValue: { fontSize: 22, fontWeight: '900', marginBottom: 2 },
        kpiLabel: { fontSize: 11, fontWeight: '600' },

        actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
        actionBtn:  {
            width: '47%', padding: 16, borderRadius: 20,
            borderWidth: 1, alignItems: 'center',
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
        },
        actionIcon:  { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
        actionLabel: { fontSize: 13, fontWeight: '800' },

        pendingCard: {
            flexDirection: 'row', alignItems: 'center',
            padding: 16, borderRadius: 18, marginBottom: 10,
            borderWidth: 1, overflow: 'hidden',
        },
        pendingTitle:  { fontSize: 14, fontWeight: '800', marginBottom: 3 },
        pendingSub:    { fontSize: 12, fontWeight: '500' },
        pendingAmount: { fontSize: 18, fontWeight: '900' },
        seeAllBtn:     { paddingVertical: 12, alignItems: 'center', borderRadius: 14, borderWidth: 1, marginBottom: 24 },
        seeAllText:    { fontWeight: '800', fontSize: 14 },

        managerRow:        { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, marginBottom: 10, borderWidth: 1, overflow: 'hidden', gap: 12 },
        managerAvatar:     { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
        managerAvatarText: { fontSize: 18, fontWeight: '900' },
        managerName:       { fontSize: 14, fontWeight: '800', marginBottom: 2 },
        managerOffice:     { fontSize: 12, fontWeight: '500' },
        reportStatus:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 4 },
        reportStatusText:  { fontSize: 11, fontWeight: '900' },
    });
}