// app/(app)/client/[id].tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../../../components/ScreenWrapper';
import apiClient from '../../../src/api/apiClient';
import { getToken } from '../../../src/utils/storage';

export default function ClientDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [client, setClient] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchClient = async () => {
            try {
                // Если ID начинается с temp_, ищем в локальной БД телефона
                if (id && id.toString().startsWith('temp_')) {
                    const offlineClients = JSON.parse(await getToken('offline_clients') || '[]');
                    const found = offlineClients.find((c: any) => c.id === id);
                    if (found) setClient(found);
                    setLoading(false);
                    return;
                }
                const response = await apiClient.get(`/clients/${id}/`);
                setClient(response.data);
            } catch (error) {
                console.error("Ошибка загрузки клиента", error);
            } finally {
                setLoading(false);
            }
        };
        fetchClient();
    }, [id]);

    if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View></ScreenWrapper>;
    if (!client) return <ScreenWrapper><Text style={styles.errorText}>Клиент не найден</Text></ScreenWrapper>;

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                {/* ЗАЩИТА: Явный редирект в CRM */}
                <TouchableOpacity onPress={() => router.replace('/crm')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Карточка клиента</Text>
                <View style={{width: 40}} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {client.isOffline && (
                    <View style={{backgroundColor: 'rgba(245, 158, 11, 0.2)', padding: 10, borderRadius: 10, marginBottom: 15}}>
                        <Text style={{color: '#fbbf24', textAlign: 'center', fontWeight: 'bold'}}>☁️ Офлайн клиент (Ожидает синхронизации)</Text>
                    </View>
                )}

                <BlurView intensity={40} tint="dark" style={styles.mainCard}>
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>{client.full_name?.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.clientName}>{client.is_priority ? '⭐ ' : ''}{client.full_name}</Text>
                    <View style={styles.badge}><Text style={styles.badgeText}>{client.status || 'Новый'}</Text></View>
                </BlurView>

                <Text style={styles.sectionTitle}>Контакты</Text>
                <BlurView intensity={30} tint="dark" style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Ionicons name="call" size={18} color="#3b82f6" style={styles.infoIcon} />
                        <View><Text style={styles.infoLabel}>Телефон</Text><Text style={styles.infoValue}>{client.phone}</Text></View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Ionicons name="location" size={18} color="#3b82f6" style={styles.infoIcon} />
                        <View><Text style={styles.infoLabel}>Город / Гражданство</Text><Text style={styles.infoValue}>{client.city || '—'} / {client.citizenship || '—'}</Text></View>
                    </View>
                </BlurView>

                <TouchableOpacity style={styles.actionBtn} onPress={() => router.push({ pathname: '/deal/create', params: { clientId: client.id, clientName: client.full_name } })}>
                    <Ionicons name="briefcase" size={20} color="#fff" />
                    <Text style={styles.actionBtnText}>Создать сделку</Text>
                </TouchableOpacity>

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
    mainCard: { alignItems: 'center', padding: 30, borderRadius: 24, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(59, 130, 246, 0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 2, borderColor: '#3b82f6' },
    avatarText: { color: '#60a5fa', fontSize: 32, fontWeight: 'bold' },
    clientName: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    badge: { backgroundColor: 'rgba(59, 130, 246, 0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
    badgeText: { color: '#60a5fa', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
    sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginLeft: 5 },
    infoCard: { borderRadius: 20, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    infoRow: { flexDirection: 'row', alignItems: 'center', padding: 15 },
    infoIcon: { marginRight: 15, backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 12 },
    infoLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 2 },
    infoValue: { color: '#fff', fontSize: 16, fontWeight: '500' },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginLeft: 60 },
    actionBtn: { flexDirection: 'row', backgroundColor: '#3b82f6', padding: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10, gap: 10, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    actionBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});