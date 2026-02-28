// app/(app)/deal/[id].tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../../../components/ScreenWrapper';
import apiClient from '../../../src/api/apiClient';

export default function DealDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [deal, setDeal] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDeal = async () => {
            try {
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

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
            </ScreenWrapper>
        );
    }

    if (!deal) {
        return (
            <ScreenWrapper>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.errorText}>Сделка не найдена</Text>
                </View>
            </ScreenWrapper>
        );
    }

    const isPaid = deal.paid_amount_usd >= deal.total_to_pay_usd;

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Сделка #{deal.id}</Text>
                <View style={{width: 40}} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Финансовый блок (Главный) */}
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
                            <Text style={styles.progressText}>Оплачено: ${deal.paid_amount_usd}</Text>
                            {!isPaid && <Text style={styles.progressText}>Остаток: ${deal.total_to_pay_usd - deal.paid_amount_usd}</Text>}
                        </View>
                        <View style={styles.progressBarBg}>
                            <View 
                                style={[
                                    styles.progressBarFill, 
                                    { width: `${Math.min((deal.paid_amount_usd / deal.total_to_pay_usd) * 100, 100)}%` },
                                    isPaid ? { backgroundColor: '#34d399' } : { backgroundColor: '#fbbf24' }
                                ]} 
                            />
                        </View>
                    </View>
                </BlurView>

                {/* Информация об услуге */}
                <Text style={styles.sectionTitle}>Детали услуги</Text>
                <BlurView intensity={30} tint="dark" style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Ionicons name="person" size={18} color="#60a5fa" style={styles.infoIcon} />
                        <View>
                            <Text style={styles.infoLabel}>Клиент</Text>
                            <Text style={styles.infoValue}>{deal.client_name || 'Неизвестно'}</Text>
                        </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Ionicons name="school" size={18} color="#60a5fa" style={styles.infoIcon} />
                        <View>
                            <Text style={styles.infoLabel}>Тип сделки / Услуга</Text>
                            <Text style={styles.infoValue}>{deal.deal_type === 'university' ? 'Поступление в ВУЗ' : 'Доп. услуга'}</Text>
                            {deal.university_name && <Text style={styles.infoSubValue}>{deal.university_name}</Text>}
                        </View>
                    </View>
                </BlurView>

            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    errorText: { color: '#fca5a5', fontSize: 16 },
    
    financeCard: { padding: 25, borderRadius: 24, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    financeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 25 },
    financeLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 4 },
    totalAmount: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: 1 },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    bgSuccess: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
    bgWarning: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
    statusText: { color: '#fff', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    
    progressContainer: { marginTop: 10 },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    progressText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '500' },
    progressBarBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 4 },

    sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginLeft: 5 },
    infoCard: { borderRadius: 20, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    infoRow: { flexDirection: 'row', alignItems: 'center', padding: 15 },
    infoIcon: { marginRight: 15, backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 12 },
    infoLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 2 },
    infoValue: { color: '#fff', fontSize: 16, fontWeight: '500' },
    infoSubValue: { color: '#60a5fa', fontSize: 13, marginTop: 4 },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginLeft: 60 }
});