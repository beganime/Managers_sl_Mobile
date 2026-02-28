// app/(app)/crm.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import { fetchWithCache } from '../../src/utils/offlineSync';

export default function CRMScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'clients' | 'deals'>('clients');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [clients, setClients] = useState<any[]>([]);
    const [deals, setDeals] = useState<any[]>([]);

    const loadData = async () => {
        try {
            // Загружаем клиентов
            const clientsResult = await fetchWithCache('/clients/', 'cache_clients');
            setClients(clientsResult.data);
            
            // Загружаем сделки
            const dealsResult = await fetchWithCache('/analytics/deals/', 'cache_deals');
            setDeals(dealsResult.data);

            setIsOffline(clientsResult.isOffline || dealsResult.isOffline);
        } catch (error) {
            console.error("Ошибка загрузки CRM данных", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    // Локальная фильтрация по поиску
    const filteredClients = clients.filter(c => 
        c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.phone?.includes(searchQuery)
    );

    const filteredDeals = deals.filter(d => 
        d.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.id?.toString().includes(searchQuery)
    );

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            {/* Офлайн индикатор */}
            {isOffline && (
                <View style={styles.offlineBanner}>
                    <Ionicons name="cloud-offline" size={16} color="#fca5a5" />
                    <Text style={styles.offlineText}>Нет сети. Показаны сохраненные данные.</Text>
                </View>
            )}

            {/* Вкладки */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'clients' && styles.activeTab]} 
                    onPress={() => setActiveTab('clients')}
                >
                    <Text style={[styles.tabText, activeTab === 'clients' && styles.activeTabText]}>Клиенты</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'deals' && styles.activeTab]} 
                    onPress={() => setActiveTab('deals')}
                >
                    <Text style={[styles.tabText, activeTab === 'deals' && styles.activeTabText]}>Сделки</Text>
                </TouchableOpacity>
            </View>

            {/* Поиск */}
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="rgba(255,255,255,0.5)" />
                <TextInput 
                    style={styles.searchInput}
                    placeholder={`Поиск ${activeTab === 'clients' ? 'клиента' : 'сделки'}...`}
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView 
                showsVerticalScrollIndicator={false} 
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
            >
                {activeTab === 'clients' ? (
                    // СПИСОК КЛИЕНТОВ
                    filteredClients.length === 0 ? (
                        <Text style={styles.emptyText}>Клиенты не найдены</Text>
                    ) : (
                        filteredClients.map((client) => (
                            <TouchableOpacity key={client.id} onPress={() => router.push(`/client/${client.id}` as any)}>
                                <BlurView intensity={30} tint="dark" style={styles.card}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.cardTitle}>
                                            {client.is_priority ? '⭐ ' : ''}{client.full_name}
                                        </Text>
                                        <View style={styles.badge}>
                                            <Text style={styles.badgeText}>{client.status || 'Новый'}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.cardRow}>
                                        <Ionicons name="call-outline" size={14} color="rgba(255,255,255,0.5)" />
                                        <Text style={styles.cardText}>{client.phone}</Text>
                                    </View>
                                    <View style={styles.cardRow}>
                                        <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.5)" />
                                        <Text style={styles.cardText}>{client.city || client.citizenship}</Text>
                                    </View>
                                </BlurView>
                            </TouchableOpacity>
                        ))
                    )
                ) : (
                    // СПИСОК СДЕЛОК
                    filteredDeals.length === 0 ? (
                        <Text style={styles.emptyText}>Сделки не найдены</Text>
                    ) : (
                        filteredDeals.map((deal) => (
                            <TouchableOpacity key={deal.id} onPress={() => router.push(`/deal/${deal.id}` as any)}>
                                <BlurView intensity={30} tint="dark" style={styles.card}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.cardTitle}>Сделка #{deal.id}</Text>
                                        <View style={[styles.badge, deal.payment_status === 'paid_full' ? styles.badgeSuccess : styles.badgeWarning]}>
                                            <Text style={styles.badgeText}>
                                                {deal.payment_status === 'paid_full' ? 'Оплачено' : 'В процессе'}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.cardSubtitle}>{deal.client_name}</Text>
                                    <View style={styles.financeRow}>
                                        <Text style={styles.financeText}>Оплачено:</Text>
                                        <Text style={styles.financeAmount}>${deal.paid_amount_usd} / ${deal.total_to_pay_usd}</Text>
                                    </View>
                                </BlurView>
                            </TouchableOpacity>
                        ))
                    )
                )}
                <View style={{height: 50}} />
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    offlineBanner: { flexDirection: 'row', backgroundColor: 'rgba(239, 68, 68, 0.2)', padding: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 15, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)' },
    offlineText: { color: '#fca5a5', marginLeft: 8, fontSize: 12, fontWeight: 'bold' },
    tabsContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, padding: 4, marginBottom: 15 },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
    activeTab: { backgroundColor: '#3b82f6' },
    tabText: { color: 'rgba(255,255,255,0.6)', fontWeight: 'bold', fontSize: 14 },
    activeTabText: { color: '#ffffff' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, paddingHorizontal: 15, height: 50, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    searchInput: { flex: 1, color: '#fff', marginLeft: 10, fontSize: 15, outlineStyle: 'none' },
    emptyText: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 40, fontSize: 16 },
    card: { padding: 16, borderRadius: 20, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.05)' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
    cardSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 12, fontWeight: '500' },
    cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
    cardText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
    badge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeSuccess: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
    badgeWarning: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
    financeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
    financeText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
    financeAmount: { color: '#34d399', fontSize: 14, fontWeight: 'bold' }
});