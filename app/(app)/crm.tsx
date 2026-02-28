// app/(app)/crm.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';

export default function CRMScreen() {
    const [activeTab, setActiveTab] = useState<'clients' | 'deals' | 'payments'>('clients');
    
    const [clients, setClients] = useState<any[]>([]);
    const [deals, setDeals] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            const [clientsRes, dealsRes, paymentsRes] = await Promise.all([
                apiClient.get('/clients/'),
                apiClient.get('/analytics/deals/'),
                apiClient.get('/analytics/payments/')
            ]);
            
            setClients(clientsRes.data.results || clientsRes.data);
            setDeals(dealsRes.data.results || dealsRes.data);
            setPayments(paymentsRes.data.results || paymentsRes.data);
        } catch (error) {
            console.error('Ошибка загрузки CRM', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View></ScreenWrapper>;

    return (
        <ScreenWrapper>
            {/* Навигация по вкладкам */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity style={[styles.tab, activeTab === 'clients' && styles.activeTab]} onPress={() => setActiveTab('clients')}>
                    <Text style={[styles.tabText, activeTab === 'clients' && styles.activeTabText]}>Клиенты</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'deals' && styles.activeTab]} onPress={() => setActiveTab('deals')}>
                    <Text style={[styles.tabText, activeTab === 'deals' && styles.activeTabText]}>Сделки</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'payments' && styles.activeTab]} onPress={() => setActiveTab('payments')}>
                    <Text style={[styles.tabText, activeTab === 'payments' && styles.activeTabText]}>Оплаты</Text>
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}>
                
                {/* СПИСОК КЛИЕНТОВ */}
                {activeTab === 'clients' && (
                    <>
                        {clients.length === 0 && <Text style={styles.emptyText}>Нет клиентов</Text>}
                        {clients.map(c => (
                            <BlurView key={c.id} intensity={30} tint="dark" style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardTitle}>{c.full_name}</Text>
                                    {c.is_priority && <Ionicons name="star" size={16} color="#fbbf24" />}
                                </View>
                                <Text style={styles.cardSubtitle}>📞 {c.phone}  |  📍 {c.city || 'Не указан'}</Text>
                                <View style={styles.badge}><Text style={styles.badgeText}>Статус: {c.status}</Text></View>
                            </BlurView>
                        ))}
                    </>
                )}

                {/* СПИСОК СДЕЛОК */}
                {activeTab === 'deals' && (
                    <>
                        {deals.length === 0 && <Text style={styles.emptyText}>Нет сделок</Text>}
                        {deals.map(d => (
                            <BlurView key={d.id} intensity={30} tint="dark" style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardTitle}>Сделка #{d.id}</Text>
                                    <Text style={styles.priceText}>${d.price_client}</Text>
                                </View>
                                <Text style={styles.cardSubtitle}>Тип: {d.deal_type === 'university' ? 'Университет' : 'Услуга'}</Text>
                                <View style={[styles.badge, {backgroundColor: d.payment_status === 'paid_full' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}]}>
                                    <Text style={[styles.badgeText, {color: d.payment_status === 'paid_full' ? '#34d399' : '#fbbf24'}]}>
                                        Оплачено: ${d.paid_amount_usd} / ${d.total_to_pay_usd}
                                    </Text>
                                </View>
                            </BlurView>
                        ))}
                    </>
                )}

                {/* СПИСОК ПЛАТЕЖЕЙ */}
                {activeTab === 'payments' && (
                    <>
                        {payments.length === 0 && <Text style={styles.emptyText}>Нет оплат</Text>}
                        {payments.map(p => (
                            <BlurView key={p.id} intensity={30} tint="dark" style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardTitle}>Платёж по сделке #{p.deal}</Text>
                                    <Text style={styles.priceText}>+ ${p.amount_usd}</Text>
                                </View>
                                <Text style={styles.cardSubtitle}>Метод: {p.method} | Дата: {new Date(p.payment_date).toLocaleDateString()}</Text>
                                {p.is_confirmed ? (
                                    <Text style={{color: '#10b981', fontSize: 12, fontWeight: 'bold', marginTop: 8}}>✅ Подтвержден бухгалтерией</Text>
                                ) : (
                                    <Text style={{color: '#f59e0b', fontSize: 12, fontWeight: 'bold', marginTop: 8}}>⏳ Ожидает подтверждения</Text>
                                )}
                            </BlurView>
                        ))}
                    </>
                )}

            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    tabsContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 4, marginBottom: 20 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
    activeTab: { backgroundColor: '#3b82f6', shadowColor: '#3b82f6', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: {width: 0, height: 4} },
    tabText: { color: 'rgba(255,255,255,0.6)', fontWeight: 'bold', fontSize: 14 },
    activeTabText: { color: '#fff' },
    
    card: { padding: 18, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(0,0,0,0.2)' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    cardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    priceText: { color: '#10b981', fontSize: 16, fontWeight: '900' },
    cardSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 12 },
    badge: { alignSelf: 'flex-start', backgroundColor: 'rgba(59,130,246,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { color: '#60a5fa', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
    emptyText: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 40, fontSize: 16 }
});