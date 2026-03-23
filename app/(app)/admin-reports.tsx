// app/(app)/admin-reports.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, RefreshControl, ScrollView,
    StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

export default function AdminReportsScreen() {
    const { theme }     = useTheme();
    const router        = useRouter();
    const s             = makeStyles(theme);
    const [reports,     setReports]     = useState<any[]>([]);
    const [loading,     setLoading]     = useState(true);
    const [refreshing,  setRefreshing]  = useState(false);
    const [expanded,    setExpanded]    = useState<number | null>(null);
    const [filterDate,  setFilterDate]  = useState<'today' | 'week' | 'all'>('today');

    const load = async () => {
        try {
            const res = await apiClient.get('reports/daily/');
            setReports(res.data.results ?? res.data);
        } catch { console.log('offline'); }
        finally { setLoading(false); setRefreshing(false); }
    };

    useEffect(() => { load(); }, []);

    const todayStr   = new Date().toISOString().slice(0, 10);
    const weekAgoStr = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const filtered = reports.filter(r => {
        if (filterDate === 'today') return r.date === todayStr;
        if (filterDate === 'week')  return r.date >= weekAgoStr;
        return true;
    }).sort((a, b) => b.date.localeCompare(a.date));

    const stripHtml = (h: string) => h?.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() ?? '';

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
                <Text style={[s.title, { color: theme.text }]}>Отчёты</Text>
                <View style={{ width: 44 }} />
            </View>

            {/* Фильтр по дате */}
            <View style={s.filterRow}>
                {(['today', 'week', 'all'] as const).map(f => (
                    <TouchableOpacity key={f}
                        style={[s.filterChip, { backgroundColor: filterDate === f ? theme.primaryDeep : theme.bgChip, borderColor: filterDate === f ? theme.primaryDeep : theme.border }]}
                        onPress={() => setFilterDate(f)}
                    >
                        <Text style={[s.filterChipText, { color: filterDate === f ? '#fff' : theme.textSub }]}>
                            {f === 'today' ? 'Сегодня' : f === 'week' ? '7 дней' : 'Все'}
                        </Text>
                    </TouchableOpacity>
                ))}
                <View style={[s.countPill, { backgroundColor: theme.accent + '20' }]}>
                    <Text style={[s.countPillText, { color: theme.accent }]}>{filtered.length}</Text>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.container}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />
                }
            >
                {filtered.length === 0 ? (
                    <View style={s.empty}>
                        <Ionicons name="document-outline" size={48} color={theme.textMuted} />
                        <Text style={[s.emptyText, { color: theme.textMuted }]}>Отчётов нет</Text>
                    </View>
                ) : filtered.map(r => {
                    const isExpanded = expanded === r.id;
                    const cleanContent = stripHtml(r.content);
                    return (
                        <BlurView key={r.id} intensity={50} tint={theme.mode === 'dark' ? 'dark' : 'light'}
                            style={[s.reportCard, { borderColor: theme.borderGlass }]}
                        >
                            <TouchableOpacity onPress={() => setExpanded(isExpanded ? null : r.id)} activeOpacity={0.85}>
                                <View style={s.reportHeader}>
                                    <View style={[s.reportAvatar, { backgroundColor: theme.primary + '20' }]}>
                                        <Text style={[s.reportAvatarText, { color: theme.primary }]}>
                                            {r.employee_name?.charAt(0) ?? '?'}
                                        </Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[s.reportEmployee, { color: theme.text }]}>
                                            {r.employee_name ?? `Сотрудник #${r.employee}`}
                                        </Text>
                                        <Text style={[s.reportDate, { color: theme.textSub }]}>{r.date}</Text>
                                    </View>
                                    <View style={s.reportStats}>
                                        <View style={[s.statPill, { backgroundColor: theme.accent + '18' }]}>
                                            <Text style={[s.statPillText, { color: theme.accent }]}>
                                                +{r.leads_processed} лидов
                                            </Text>
                                        </View>
                                        <View style={[s.statPill, { backgroundColor: theme.primary + '18' }]}>
                                            <Text style={[s.statPillText, { color: theme.primary }]}>
                                                {r.deals_closed} сделок
                                            </Text>
                                        </View>
                                    </View>
                                    <Ionicons
                                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                        size={16} color={theme.textMuted} style={{ marginLeft: 8 }}
                                    />
                                </View>

                                {!isExpanded && cleanContent && (
                                    <Text style={[s.reportPreview, { color: theme.textSub }]} numberOfLines={2}>
                                        {cleanContent}
                                    </Text>
                                )}
                            </TouchableOpacity>

                            {isExpanded && (
                                <View style={[s.reportBody, { borderTopColor: theme.border }]}>
                                    <Text style={[s.reportContent, { color: theme.text }]}>
                                        {cleanContent || '— Нет текста —'}
                                    </Text>
                                </View>
                            )}
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
        header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
        backBtn:   { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
        title:     { fontSize: 20, fontWeight: '900' },

        filterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14, gap: 8 },
        filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
        filterChipText: { fontSize: 13, fontWeight: '800' },
        countPill:     { marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
        countPillText: { fontSize: 13, fontWeight: '900' },

        reportCard:   { borderRadius: 22, marginBottom: 12, borderWidth: 1, overflow: 'hidden', padding: 16 },
        reportHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
        reportAvatar: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
        reportAvatarText: { fontSize: 16, fontWeight: '900' },
        reportEmployee: { fontSize: 14, fontWeight: '900', marginBottom: 2 },
        reportDate:     { fontSize: 12, fontWeight: '500' },
        reportStats:    { flexDirection: 'column', gap: 4 },
        statPill:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
        statPillText:   { fontSize: 10, fontWeight: '900' },
        reportPreview:  { fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 4 },
        reportBody:     { borderTopWidth: 1, paddingTop: 12, marginTop: 8 },
        reportContent:  { fontSize: 14, lineHeight: 22, fontWeight: '500' },

        empty:     { alignItems: 'center', paddingTop: 60 },
        emptyText: { marginTop: 12, fontSize: 15, fontWeight: '600', fontStyle: 'italic' },
    });
}