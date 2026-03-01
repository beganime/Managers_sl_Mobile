// app/(app)/crm.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';
import { fetchWithCache } from '../../src/utils/offlineSync';
import { getToken, saveToken } from '../../src/utils/storage';

export default function CRMScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'clients' | 'deals' | 'payments'>('clients');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [clients, setClients] = useState<any[]>([]);
    const [deals, setDeals] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);

    const loadData = async () => {
        try {
            // Убрали начальные слеши для правильной работы Axios baseURL
            const clientsResult = await fetchWithCache('clients/', 'cache_clients');
            const offlineClients = JSON.parse(await getToken('offline_clients') || '[]');
            setClients([...offlineClients, ...(clientsResult.data?.results || clientsResult.data || [])]);
            
            const dealsResult = await fetchWithCache('analytics/deals/', 'cache_deals');
            const offlineDeals = JSON.parse(await getToken('offline_deals') || '[]');
            setDeals([...offlineDeals, ...(dealsResult.data?.results || dealsResult.data || [])]);

            const paymentsResult = await fetchWithCache('analytics/payments/', 'cache_payments');
            const offlinePayments = JSON.parse(await getToken('offline_payments') || '[]');
            setPayments([...offlinePayments, ...(paymentsResult.data?.results || paymentsResult.data || [])]);

        } catch (error) {
            console.error("Ошибка загрузки CRM", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    // --- МОЩНАЯ ЛОГИКА СИНХРОНИЗАЦИИ ---
    const syncOfflineData = async () => {
        setSyncing(true);
        let syncedCount = 0;
        
        try {
            const clientMap: Record<string, number> = {};
            const dealMap: Record<string, number> = {};

            // 1. СИНХРОНИЗАЦИЯ КЛИЕНТОВ
            let offClients = JSON.parse(await getToken('offline_clients') || '[]');
            let remClients = [];
            for (const c of offClients) {
                try { 
                    const res = await apiClient.post('clients/', c); 
                    clientMap[c.id] = res.data.id; 
                    syncedCount++; 
                } 
                catch (e) { remClients.push(c); }
            }
            await saveToken('offline_clients', JSON.stringify(remClients));

            // 2. СИНХРОНИЗАЦИЯ СДЕЛОК
            let offDeals = JSON.parse(await getToken('offline_deals') || '[]');
            let remDeals = [];
            for (let d of offDeals) {
                try {
                    if (d.client && typeof d.client === 'string' && d.client.startsWith('temp_')) {
                        if (clientMap[d.client]) {
                            d.client = clientMap[d.client];
                        } else {
                            remDeals.push(d);
                            continue;
                        }
                    }
                    d.price_client = parseFloat(d.price_client);
                    const res = await apiClient.post('analytics/deals/', d); 
                    dealMap[d.id] = res.data.id; 
                    syncedCount++; 
                } 
                catch (e: any) { 
                    remDeals.push(d); 
                }
            }
            await saveToken('offline_deals', JSON.stringify(remDeals));

            // 3. СИНХРОНИЗАЦИЯ ПЛАТЕЖЕЙ
            let offPayments = JSON.parse(await getToken('offline_payments') || '[]');
            let remPayments = [];
            for (let p of offPayments) {
                try {
                    if (p.deal && typeof p.deal === 'string' && p.deal.startsWith('temp_')) {
                        if (dealMap[p.deal]) {
                            p.deal = dealMap[p.deal];
                        } else {
                            remPayments.push(p);
                            continue;
                        }
                    }

                    p.amount = parseFloat(p.amount);
                    if (p.net_income_usd === undefined) {
                        p.net_income_usd = 0;
                    }

                    await apiClient.post('analytics/payments/', p); 
                    syncedCount++; 
                } 
                catch (e: any) { 
                    console.log('Payment sync error:', e.response?.data || e.message);
                    remPayments.push(p); 
                }
            }
            await saveToken('offline_payments', JSON.stringify(remPayments));

            if (syncedCount > 0) {
                Alert.alert("Синхронизация", `Успешно отправлено записей: ${syncedCount}`);
                loadData();
            } else {
                Alert.alert("Отлично", "Все данные уже на сервере.");
            }
        } catch (error) {
            Alert.alert("Ошибка", "Нет интернета или сервер недоступен.");
        } finally {
            setSyncing(false);
        }
    };

    const filteredClients = clients.filter(c => c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone?.includes(searchQuery));
    const filteredDeals = deals.filter(d => d.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) || d.id?.toString().includes(searchQuery));
    const filteredPayments = payments.filter(p => p.id?.toString().includes(searchQuery) || p.deal?.toString().includes(searchQuery));

    if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color="#0D416D" /></View></ScreenWrapper>;

    return (
        <ScreenWrapper>
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient colors={['#F1F5F9', '#E2E8F0']} style={StyleSheet.absoluteFillObject} />
            </View>

            <View style={styles.pageHeader}>
                <Text style={styles.pageTitle}>CRM База</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/add-client')}>
                    <Ionicons name="add" size={20} color="#FFF" />
                    <Text style={styles.addBtnText}>Клиент</Text>
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); loadData();}} tintColor="#0D416D" />}>
                
                <TouchableOpacity style={styles.syncBanner} onPress={syncOfflineData} disabled={syncing}>
                    {syncing ? <ActivityIndicator size="small" color="#10b981" /> : <Ionicons name="cloud-upload" size={20} color="#10b981" />}
                    <Text style={styles.syncText}>Синхронизировать базу</Text>
                </TouchableOpacity>

                <BlurView intensity={50} tint="light" style={styles.tabsContainer}>
                    <TouchableOpacity style={[styles.tab, activeTab === 'clients' && styles.activeTab]} onPress={() => setActiveTab('clients')}>
                        <Text style={[styles.tabText, activeTab === 'clients' && styles.activeTabText]}>Клиенты</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tab, activeTab === 'deals' && styles.activeTab]} onPress={() => setActiveTab('deals')}>
                        <Text style={[styles.tabText, activeTab === 'deals' && styles.activeTabText]}>Сделки</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tab, activeTab === 'payments' && styles.activeTab]} onPress={() => setActiveTab('payments')}>
                        <Text style={[styles.tabText, activeTab === 'payments' && styles.activeTabText]}>Платежи</Text>
                    </TouchableOpacity>
                </BlurView>

                <BlurView intensity={60} tint="light" style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#64748B" />
                    <TextInput style={styles.searchInput} placeholder="Поиск..." placeholderTextColor="#94A3B8" value={searchQuery} onChangeText={setSearchQuery} />
                    {searchQuery.length > 0 && <TouchableOpacity onPress={() => setSearchQuery('')}><Ionicons name="close-circle" size={20} color="#64748B" /></TouchableOpacity>}
                </BlurView>

                {activeTab === 'clients' && (
                    filteredClients.length === 0 ? <Text style={styles.emptyText}>Клиенты не найдены</Text> :
                    filteredClients.map((client) => (
                        <TouchableOpacity key={client.id} onPress={() => router.push(`/client/${client.id}` as any)}>
                            <BlurView intensity={40} tint="light" style={[styles.card, client.isOffline && styles.offlineCard]}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardTitle}>{client.is_priority ? '⭐ ' : ''}{client.full_name}</Text>
                                    {client.isOffline ? <Ionicons name="cloud-offline" size={16} color="#fbbf24" /> : <View style={styles.badge}><Text style={styles.badgeText}>{client.status || 'Новый'}</Text></View>}
                                </View>
                                <Text style={styles.cardText}><Ionicons name="call-outline" size={12}/> {client.phone}</Text>
                                {client.city && <Text style={styles.cardText}><Ionicons name="location-outline" size={12}/> {client.city}</Text>}
                            </BlurView>
                        </TouchableOpacity>
                    ))
                )}

                {activeTab === 'deals' && (
                    filteredDeals.length === 0 ? <Text style={styles.emptyText}>Сделки не найдены</Text> :
                    filteredDeals.map((deal) => (
                        <TouchableOpacity key={deal.id} onPress={() => router.push(`/deal/${deal.id}` as any)}>
                            <BlurView intensity={40} tint="light" style={[styles.card, deal.isOffline && styles.offlineCard]}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardTitle}>Сделка {deal.isOffline ? '(Офлайн)' : `#${deal.id}`}</Text>
                                    {deal.isOffline ? <Ionicons name="time" size={16} color="#fbbf24" /> : <View style={[styles.badge, deal.payment_status === 'paid_full' ? styles.badgeSuccess : styles.badgeWarning]}><Text style={styles.badgeText}>{deal.payment_status === 'paid_full' ? 'Оплачено' : 'В процессе'}</Text></View>}
                                </View>
                                <Text style={styles.cardSubtitle}>{deal.client_name || `Клиент ID: ${deal.client}`}</Text>
                                <Text style={styles.financeAmount}>Сумма: ${deal.total_to_pay_usd || deal.price_client}</Text>
                            </BlurView>
                        </TouchableOpacity>
                    ))
                )}

                {activeTab === 'payments' && (
                    filteredPayments.length === 0 ? <Text style={styles.emptyText}>Платежи не найдены</Text> :
                    filteredPayments.map((payment) => (
                        <BlurView key={payment.id} intensity={40} tint="light" style={[styles.card, payment.isOffline && styles.offlineCard]}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>Платёж {payment.isOffline ? '(Очередь)' : `#${payment.id}`}</Text>
                                <View style={[styles.badge, payment.is_confirmed ? styles.badgeSuccess : styles.badgeWarning]}>
                                    <Text style={styles.badgeText}>{payment.is_confirmed ? 'Подтвержден' : 'Ожидает'}</Text>
                                </View>
                            </View>
                            <Text style={styles.cardText}>Сделка ID: {payment.deal}</Text>
                            <Text style={[styles.financeAmount, {marginTop: 5}]}>+${payment.amount || payment.amount_usd}</Text>
                        </BlurView>
                    ))
                )}
                <View style={{height: 100}} />
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 5 },
    pageTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
    addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D416D', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, shadowColor: '#0D416D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
    addBtnText: { color: '#FFF', fontWeight: '800', marginLeft: 6, fontSize: 14 },
    syncBanner: { flexDirection: 'row', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 15, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
    syncText: { color: '#10b981', marginLeft: 8, fontSize: 14, fontWeight: '800' },
    tabsContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 16, padding: 4, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
    activeTab: { backgroundColor: '#0D416D', shadowColor: '#0D416D', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
    tabText: { color: '#64748B', fontWeight: '800', fontSize: 14 },
    activeTabText: { color: '#ffffff' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16, paddingHorizontal: 15, height: 50, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
    searchInput: { flex: 1, color: '#1E293B', marginLeft: 10, fontSize: 15, fontWeight: '600', outlineStyle: 'none' },
    emptyText: { color: '#94A3B8', textAlign: 'center', marginTop: 40, fontSize: 15, fontWeight: '600', fontStyle: 'italic' },
    card: { padding: 18, borderRadius: 24, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.7)', backgroundColor: 'rgba(255, 255, 255, 0.4)' },
    offlineCard: { borderColor: '#fbbf24', borderStyle: 'dashed', backgroundColor: 'rgba(245, 158, 11, 0.05)' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
    cardSubtitle: { color: '#475569', fontSize: 14, marginBottom: 8, fontWeight: '600' },
    cardText: { color: '#64748B', fontSize: 13, fontWeight: '500', marginBottom: 4 },
    badge: { backgroundColor: 'rgba(13, 65, 109, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeSuccess: { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
    badgeWarning: { backgroundColor: 'rgba(245, 158, 11, 0.15)' },
    badgeText: { color: '#0D416D', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
    financeAmount: { color: '#10b981', fontSize: 17, fontWeight: '900' }
});