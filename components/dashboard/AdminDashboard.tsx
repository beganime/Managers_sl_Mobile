// components/dashboard/AdminDashboard.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl, ScrollView,
    StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { Layout } from '../../constants/theme';
import { CurrentUser } from '../../hooks/useCurrentUser';
import apiClient from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import ScreenWrapper from '../ScreenWrapper';

interface Props {
    user: CurrentUser;
    onRefresh: () => void;
}

export default function AdminDashboard({ user, onRefresh }: Props) {
    const { theme } = useTheme();
    const router = useRouter();
    const s = makeStyles(theme);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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

            // Логика подсчета KPI
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
            {/* Для админа фон строго сплошной, без орбов (воздушная аналитика) */}
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.bg }]} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.container}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
                }
            >
                {/* Шапка: Строгая и минималистичная */}
                <View style={s.header}>
                    <View>
                        <Text style={[s.greeting, { color: theme.textSub }]}>Управление</Text>
                        <Text style={[s.name, { color: theme.text }]}>
                            {user.first_name} {user.last_name}
                        </Text>
                    </View>
                    <View style={[s.adminBadge, { backgroundColor: theme.text }]}>
                        <Ionicons name="key" size={14} color={theme.bgCard} />
                        <Text style={[s.adminBadgeText, { color: theme.bgCard }]}>Директор</Text>
                    </View>
                </View>

                {/* KPI карточки (Solid White Cards) */}
                <Text style={[s.sectionTitle, { color: theme.textSub }]}>Финансовые показатели</Text>
                <View style={s.kpiGrid}>
                    {[
                        { label: 'Оборот (USD)',  value: `$${Math.round(data?.kpi.totalRevenue || 0).toLocaleString()}`,    icon: 'wallet',         color: theme.accent   },
                        { label: 'Прибыль (Net)', value: `$${Math.round(data?.kpi.totalNetIncome || 0).toLocaleString()}`,  icon: 'pie-chart',      color: theme.primary  },
                        { label: 'В работе',      value: String(data?.kpi.activeDeals || 0),                               icon: 'briefcase',      color: theme.warning  },
                        { label: 'Вся база',      value: String(data?.kpi.totalClients || 0),                               icon: 'people',         color: theme.purple   },
                    ].map((k, i) => (
                        <View key={i} style={s.solidCard}>
                            <View style={[s.kpiIcon, { backgroundColor: k.color + '15' }]}>
                                <Ionicons name={k.icon as any} size={22} color={k.color} />
                            </View>
                            <Text style={[s.kpiValue, { color: theme.text }]}>{k.value}</Text>
                            <Text style={[s.kpiLabel, { color: theme.textSub }]}>{k.label}</Text>
                        </View>
                    ))}
                </View>

                {/* Быстрые действия (Solid White) */}
                <Text style={[s.sectionTitle, { color: theme.textSub }]}>Модули системы</Text>
                <View style={s.actionsRow}>
                    {[
                        { label: 'Команда',     icon: 'people-outline',      route: '/admin-staff',    color: theme.primary  },
                        { label: 'CRM',         icon: 'person-add-outline',  route: '/crm',            color: theme.accent   },
                        { label: 'Касса',       icon: 'card-outline',        route: '/admin-payments', color: theme.warning  },
                        { label: 'Аналитика',   icon: 'bar-chart-outline',   route: '/admin-reports',  color: theme.purple   },
                    ].map((a, i) => (
                        <TouchableOpacity key={i} style={s.actionBtn} onPress={() => router.push(a.route as any)}>
                            <View style={[s.actionIcon, { backgroundColor: a.color + '10' }]}>
                                <Ionicons name={a.icon as any} size={26} color={a.color} />
                            </View>
                            <Text style={[s.actionLabel, { color: theme.text }]}>{a.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Ожидающие платежи (Внимание - Требует действий) */}
                {(data?.pendingPayments?.length ?? 0) > 0 && (
                    <>
                        <View style={s.sectionRow}>
                            <Text style={[s.sectionTitle, { color: theme.danger, marginBottom: 0 }]}>
                                Требуют подтверждения
                            </Text>
                            <View style={[s.countBadge, { backgroundColor: theme.danger }]}>
                                <Text style={[s.countBadgeText, { color: '#FFF' }]}>
                                    {data.pendingPayments.length}
                                </Text>
                            </View>
                        </View>
                        {data.pendingPayments.slice(0, 3).map((p: any) => (
                            <View key={p.id} style={s.solidListCard}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.pendingTitle, { color: theme.text }]}>
                                        Платёж #{p.id} (Сделка #{p.deal})
                                    </Text>
                                    <Text style={[s.pendingSub, { color: theme.textSub }]}>
                                        {p.method === 'cash' ? '💵 Наличными' : p.method === 'card' ? '💳 Картой' : '🏦 Банком'}
                                    </Text>
                                </View>
                                <Text style={[s.pendingAmount, { color: theme.danger }]}>
                                    ${parseFloat(p.amount_usd || 0).toLocaleString()}
                                </Text>
                            </View>
                        ))}
                    </>
                )}

                {/* Контроль сотрудников (Отчёты) */}
                <View style={s.sectionRow}>
                    <Text style={[s.sectionTitle, { color: theme.textSub, marginBottom: 0 }]}>
                        Отчёты за сегодня
                    </Text>
                    <Text style={[s.countBadgeText, { color: theme.primary }]}>
                        Сдано {data?.todayReports?.length ?? 0} из {data?.managers?.length ?? 0}
                    </Text>
                </View>

                {(data?.managers ?? []).map((m: any) => {
                    const hasReport = (data?.todayReports ?? []).some((r: any) => r.employee === m.id);
                    return (
                        <View key={m.id} style={s.solidListCard}>
                            <View style={[s.managerAvatar, { backgroundColor: theme.bgSection }]}>
                                <Text style={[s.managerAvatarText, { color: theme.textSub }]}>
                                    {m.first_name?.charAt(0) ?? '?'}
                                </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[s.managerName, { color: theme.text }]}>
                                    {m.first_name} {m.last_name}
                                </Text>
                                <Text style={[s.managerOffice, { color: theme.textMuted }]}>
                                    {m.office?.city ?? 'Офис не указан'}
                                </Text>
                            </View>
                            <View style={[
                                s.reportStatus,
                                { backgroundColor: hasReport ? theme.accent + '15' : theme.danger + '10' },
                            ]}>
                                <Text style={[s.reportStatusText, { color: hasReport ? theme.accent : theme.danger }]}>
                                    {hasReport ? '✅ Сдан' : '❌ Ждем'}
                                </Text>
                            </View>
                        </View>
                    );
                })}

                <View style={{ height: 40 }} />
            </ScrollView>
        </ScreenWrapper>
    );
}

function makeStyles(t: any) {
    return StyleSheet.create({
        center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
        container: { padding: 20 },

        header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30, marginTop: 10 },
        greeting: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
        name:     { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
        adminBadge:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, gap: 6 },
        adminBadgeText: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },

        sectionTitle: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16, marginTop: 10 },
        sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 10 },
        countBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
        countBadgeText: { fontSize: 13, fontWeight: '800' },

        // Архитектура плоских белых карточек (Solid Design)
        solidCard: {
            width: '47.5%', padding: 20, borderRadius: Layout.radius.large,
            backgroundColor: t.bgCard, borderWidth: 1, borderColor: t.border,
            ...Layout.shadows.light
        },
        kpiGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 30 },
        kpiIcon:  { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
        kpiValue: { fontSize: 24, fontWeight: '900', marginBottom: 4, letterSpacing: -0.5 },
        kpiLabel: { fontSize: 12, fontWeight: '700' },

        actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 30 },
        actionBtn:  {
            width: '47.5%', padding: 20, borderRadius: Layout.radius.large,
            backgroundColor: t.bgCard, borderWidth: 1, borderColor: t.border,
            alignItems: 'center', ...Layout.shadows.light
        },
        actionIcon:  { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
        actionLabel: { fontSize: 14, fontWeight: '800' },

        solidListCard: {
            flexDirection: 'row', alignItems: 'center', padding: 18, 
            borderRadius: Layout.radius.medium, marginBottom: 12,
            backgroundColor: t.bgCard, borderWidth: 1, borderColor: t.border,
            ...Layout.shadows.light
        },
        pendingTitle:  { fontSize: 15, fontWeight: '900', marginBottom: 4 },
        pendingSub:    { fontSize: 13, fontWeight: '600' },
        pendingAmount: { fontSize: 20, fontWeight: '900' },

        managerAvatar:     { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
        managerAvatarText: { fontSize: 18, fontWeight: '900' },
        managerName:       { fontSize: 16, fontWeight: '800', marginBottom: 4 },
        managerOffice:     { fontSize: 13, fontWeight: '600' },
        reportStatus:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
        reportStatusText:  { fontSize: 12, fontWeight: '900' },
    });
}