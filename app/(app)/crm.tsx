// app/(app)/crm.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
            const clientsResult = await fetchWithCache('/clients/', 'cache_clients');
            const offlineClients = JSON.parse(await getToken('offline_clients') || '[]');
            setClients([...offlineClients, ...(clientsResult.data || [])]);
            
            const dealsResult = await fetchWithCache('/analytics/deals/', 'cache_deals');
            const offlineDeals = JSON.parse(await getToken('offline_deals') || '[]');
            setDeals([...offlineDeals, ...(dealsResult.data || [])]);

            const paymentsResult = await fetchWithCache('/analytics/payments/', 'cache_payments');
            const offlinePayments = JSON.parse(await getToken('offline_payments') || '[]');
            setPayments([...offlinePayments, ...(paymentsResult.data || [])]);

        } catch (error) {
            console.error("Ошибка загрузки CRM", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { loadData(); }, []);

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
                    const res = await apiClient.post('/clients/', c); 
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
                    // Убираем старые "ошибочные" поля на всякий случай перед отправкой
                    d.price_client = parseFloat(d.price_client);
                    const res = await apiClient.post('/analytics/deals/', d); 
                    dealMap[d.id] = res.data.id; 
                    syncedCount++; 
                } 
                catch (e: any) { 
                    remDeals.push(d); 
                }
            }
            await saveToken('offline_deals', JSON.stringify(remDeals));

            // 3. СИНХРОНИЗАЦИЯ ПЛАТЕЖЕЙ (С ИСПРАВЛЕНИЕМ ОШИБКИ)
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

                    // СПАСАТЕЛЬНЫЙ КРУГ ДЛЯ 400 и 500 ОШИБОК:
                    p.amount = parseFloat(p.amount);
                    if (p.net_income_usd === undefined) {
                        p.net_income_usd = 0;
                    }

                    await apiClient.post('/analytics/payments/', p); 
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

    if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View></ScreenWrapper>;

    return (
        <ScreenWrapper>
            <TouchableOpacity style={styles.syncBanner} onPress={syncOfflineData} disabled={syncing}>
                {syncing ? <ActivityIndicator size="small" color="#10b981" /> : <Ionicons name="cloud-upload" size={20} color="#10b981" />}
                <Text style={styles.syncText}>Синхронизировать базу</Text>
            </TouchableOpacity>

            <View style={styles.tabsContainer}>
                <TouchableOpacity style={[styles.tab, activeTab === 'clients' && styles.activeTab]} onPress={() => setActiveTab('clients')}>
                    <Text style={[styles.tabText, activeTab === 'clients' && styles.activeTabText]}>Клиенты</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'deals' && styles.activeTab]} onPress={() => setActiveTab('deals')}>
                    <Text style={[styles.tabText, activeTab === 'deals' && styles.activeTabText]}>Сделки</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'payments' && styles.activeTab]} onPress={() => setActiveTab('payments')}>
                    <Text style={[styles.tabText, activeTab === 'payments' && styles.activeTabText]}>Платежи</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="rgba(255,255,255,0.5)" />
                <TextInput style={styles.searchInput} placeholder="Поиск..." placeholderTextColor="rgba(255,255,255,0.4)" value={searchQuery} onChangeText={setSearchQuery} />
                {searchQuery.length > 0 && <TouchableOpacity onPress={() => setSearchQuery('')}><Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.5)" /></TouchableOpacity>}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); loadData();}} tintColor="#fff" />}>
                
                {activeTab === 'clients' && (
                    filteredClients.length === 0 ? <Text style={styles.emptyText}>Клиенты не найдены</Text> :
                    filteredClients.map((client) => (
                        <TouchableOpacity key={client.id} onPress={() => router.push(`/client/${client.id}` as any)}>
                            <BlurView intensity={30} tint="dark" style={[styles.card, client.isOffline && styles.offlineCard]}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardTitle}>{client.full_name}</Text>
                                    {client.isOffline ? <Ionicons name="cloud-offline" size={16} color="#fbbf24" /> : <View style={styles.badge}><Text style={styles.badgeText}>{client.status || 'Новый'}</Text></View>}
                                </View>
                                <Text style={styles.cardText}>📞 {client.phone}</Text>
                            </BlurView>
                        </TouchableOpacity>
                    ))
                )}

                {activeTab === 'deals' && (
                    filteredDeals.length === 0 ? <Text style={styles.emptyText}>Сделки не найдены</Text> :
                    filteredDeals.map((deal) => (
                        <TouchableOpacity key={deal.id} onPress={() => router.push(`/deal/${deal.id}` as any)}>
                            <BlurView intensity={30} tint="dark" style={[styles.card, deal.isOffline && styles.offlineCard]}>
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
                        <BlurView key={payment.id} intensity={30} tint="dark" style={[styles.card, payment.isOffline && styles.offlineCard]}>
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
    syncBanner: { flexDirection: 'row', backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 15, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.4)' },
    syncText: { color: '#10b981', marginLeft: 8, fontSize: 14, fontWeight: 'bold' },
    tabsContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, padding: 4, marginBottom: 15 },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
    activeTab: { backgroundColor: '#3b82f6' },
    tabText: { color: 'rgba(255,255,255,0.6)', fontWeight: 'bold', fontSize: 14 },
    activeTabText: { color: '#ffffff' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, paddingHorizontal: 15, height: 50, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    searchInput: { flex: 1, color: '#fff', marginLeft: 10, fontSize: 15, outlineStyle: 'none' },
    emptyText: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 40, fontSize: 16 },
    card: { padding: 16, borderRadius: 20, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.05)' },
    offlineCard: { borderColor: '#fbbf24', borderStyle: 'dashed', backgroundColor: 'rgba(245, 158, 11, 0.05)' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
    cardSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 8, fontWeight: '500' },
    cardText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
    badge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeSuccess: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
    badgeWarning: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
    financeAmount: { color: '#34d399', fontSize: 16, fontWeight: 'bold' }
});