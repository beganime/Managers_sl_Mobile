// app/(app)/deal/[id].tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../../../components/ScreenWrapper';
import apiClient from '../../../src/api/apiClient';
import { getToken } from '../../../src/utils/storage';

export default function DealDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [deal, setDeal] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDeal = async () => {
            try {
                if (id && id.toString().startsWith('temp_')) {
                    const offlineDeals = JSON.parse(await getToken('offline_deals') || '[]');
                    const found = offlineDeals.find((d: any) => d.id === id);
                    if (found) {
                        // Мокаем данные для офлайн отображения
                        setDeal({...found, total_to_pay_usd: found.price_client, paid_amount_usd: 0});
                    }
                    setLoading(false);
                    return;
                }
                const response = await apiClient.get(`/analytics/deals/${id}/`);
                setDeal(response.data);
            } catch (error) {
                console.error("Ошибка загрузки сделки", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDeal();
    }, [id]);

    if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View></ScreenWrapper>;
    if (!deal) return <ScreenWrapper><Text style={styles.errorText}>Сделка не найдена</Text></ScreenWrapper>;

    const isPaid = parseFloat(deal.paid_amount_usd) >= parseFloat(deal.total_to_pay_usd);

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/crm')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Сделка</Text>
                <View style={{width: 40}} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                
                {deal.isOffline && (
                    <View style={{backgroundColor: 'rgba(245, 158, 11, 0.2)', padding: 10, borderRadius: 10, marginBottom: 15}}>
                        <Text style={{color: '#fbbf24', textAlign: 'center', fontWeight: 'bold'}}>☁️ Офлайн сделка (Ожидает синхронизации)</Text>
                    </View>
                )}

                <BlurView intensity={50} tint="dark" style={styles.financeCard}>
                    <View style={styles.financeHeader}>
                        <View>
                            <Text style={styles.financeLabel}>Сумма к оплате</Text>
                            <Text style={styles.totalAmount}>${deal.total_to_pay_usd}</Text>
                        </View>
                        <View style={[styles.statusBadge, isPaid ? styles.bgSuccess : styles.bgWarning]}>
                            <Text style={styles.statusText}>{isPaid ? 'Оплачено' : 'В процессе'}</Text>
                        </View>
                    </View>
                    
                    <View style={styles.progressContainer}>
                        <View style={styles.progressLabels}>
                            <Text style={styles.progressText}>Оплачено: ${deal.paid_amount_usd || 0}</Text>
                        </View>
                    </View>

                    {!isPaid && (
                        <TouchableOpacity style={styles.payBtn} onPress={() => router.push({ pathname: '/payment/create', params: { dealId: deal.id } })}>
                            <Ionicons name="card" size={20} color="#fff" />
                            <Text style={styles.payBtnText}>Оформить платёж</Text>
                        </TouchableOpacity>
                    )}
                </BlurView>

                <Text style={styles.sectionTitle}>Детали</Text>
                <BlurView intensity={30} tint="dark" style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Ionicons name="person" size={18} color="#60a5fa" style={styles.infoIcon} />
                        <View>
                            <Text style={styles.infoLabel}>Имя клиента</Text>
                            <Text style={styles.infoValue}>{deal.client_name || `ID: ${deal.client}`}</Text>
                        </View>
                    </View>
                </BlurView>

                <Text style={styles.sectionTitle}>История платежей</Text>
                {deal.payments && deal.payments.length > 0 ? (
                    deal.payments.map((payment: any) => (
                        <BlurView key={payment.id} intensity={30} tint="dark" style={styles.paymentCard}>
                            <View style={styles.paymentRow}>
                                <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                                    <View style={[styles.iconCircle, payment.is_confirmed ? styles.bgSuccess : styles.bgWarning]}>
                                        <Ionicons name={payment.is_confirmed ? "checkmark" : "time"} size={16} color="#fff" />
                                    </View>
                                    <View>
                                        <Text style={styles.paymentDate}>{new Date(payment.payment_date).toLocaleDateString()}</Text>
                                        <Text style={styles.paymentStatus}>{payment.is_confirmed ? 'Подтвержден' : 'Ожидает проверки'}</Text>
                                    </View>
                                </View>
                                <Text style={styles.paymentAmount}>+${payment.amount_usd}</Text>
                            </View>
                        </BlurView>
                    ))
                ) : (
                    <Text style={styles.emptyText}>Платежей пока нет</Text>
                )}
                
                <View style={{height: 100}} />
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    errorText: { color: '#fca5a5', fontSize: 16, textAlign: 'center', marginTop: 40 },
    financeCard: { padding: 25, borderRadius: 24, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    financeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
    financeLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 4 },
    totalAmount: { color: '#fff', fontSize: 32, fontWeight: '900' },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    bgSuccess: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
    bgWarning: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
    statusText: { color: '#fff', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    progressContainer: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', paddingBottom: 15 },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    progressText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500' },
    payBtn: { flexDirection: 'row', backgroundColor: '#10b981', padding: 15, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 10 },
    payBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginLeft: 5 },
    infoCard: { borderRadius: 20, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    infoRow: { flexDirection: 'row', alignItems: 'center', padding: 15 },
    infoIcon: { marginRight: 15, backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 12 },
    infoLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 2 },
    infoValue: { color: '#fff', fontSize: 16, fontWeight: '500' },
    paymentCard: { padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    iconCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    paymentDate: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    paymentStatus: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
    paymentAmount: { color: '#34d399', fontSize: 16, fontWeight: 'bold' },
    emptyText: { color: 'rgba(255,255,255,0.4)', marginLeft: 5, marginTop: 10 }
});