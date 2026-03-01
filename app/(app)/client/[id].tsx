// app/(app)/client/[id].tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
                // Убрали начальный слэш для правильной работы Axios
                const response = await apiClient.get(`clients/${id}/`);
                setClient(response.data);
            } catch (error) {
                console.error("Ошибка загрузки клиента", error);
            } finally {
                setLoading(false);
            }
        };
        fetchClient();
    }, [id]);

    if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color="#0D416D" /></View></ScreenWrapper>;
    if (!client) return <ScreenWrapper><Text style={styles.errorText}>Клиент не найден</Text></ScreenWrapper>;

    return (
        <ScreenWrapper>
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient colors={['#F1F5F9', '#E2E8F0']} style={StyleSheet.absoluteFillObject} />
            </View>

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/crm')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Карточка клиента</Text>
                <View style={{width: 40}} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {client.isOffline && (
                    <View style={{backgroundColor: 'rgba(245, 158, 11, 0.15)', padding: 12, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.4)'}}>
                        <Text style={{color: '#d97706', textAlign: 'center', fontWeight: '800'}}>☁️ Офлайн клиент (Ожидает синхронизации)</Text>
                    </View>
                )}

                <BlurView intensity={40} tint="light" style={styles.mainCard}>
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>{client.full_name?.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.clientName}>{client.is_priority ? '⭐ ' : ''}{client.full_name}</Text>
                    <View style={styles.badge}><Text style={styles.badgeText}>{client.get_status_display || client.status || 'Новый'}</Text></View>
                </BlurView>

                <Text style={styles.sectionTitle}>Основная информация</Text>
                <BlurView intensity={50} tint="light" style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Ionicons name="call" size={18} color="#0D416D" style={styles.infoIcon} />
                        <View style={{ flex: 1 }}><Text style={styles.infoLabel}>Телефон</Text><Text style={styles.infoValue}>{client.phone || '—'}</Text></View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Ionicons name="mail" size={18} color="#0D416D" style={styles.infoIcon} />
                        <View style={{ flex: 1 }}><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoValue}>{client.email || '—'}</Text></View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Ionicons name="calendar" size={18} color="#0D416D" style={styles.infoIcon} />
                        <View style={{ flex: 1 }}><Text style={styles.infoLabel}>Дата рождения</Text><Text style={styles.infoValue}>{client.dob || '—'}</Text></View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Ionicons name="location" size={18} color="#0D416D" style={styles.infoIcon} />
                        <View style={{ flex: 1 }}><Text style={styles.infoLabel}>Город / Гражданство</Text><Text style={styles.infoValue}>{client.city || '—'} / {client.citizenship || '—'}</Text></View>
                    </View>
                </BlurView>

                <Text style={styles.sectionTitle}>Документы</Text>
                <BlurView intensity={50} tint="light" style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Ionicons name="card" size={18} color="#0D416D" style={styles.infoIcon} />
                        <View style={{ flex: 1 }}><Text style={styles.infoLabel}>Загранпаспорт</Text><Text style={styles.infoValue}>{client.passport_inter_num || '—'}</Text></View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Ionicons name="id-card" size={18} color="#0D416D" style={styles.infoIcon} />
                        <View style={{ flex: 1 }}><Text style={styles.infoLabel}>Внутренний паспорт</Text><Text style={styles.infoValue}>{client.passport_local_num || '—'}</Text></View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Ionicons name="business" size={18} color="#0D416D" style={styles.infoIcon} />
                        <View style={{ flex: 1 }}><Text style={styles.infoLabel}>Кем выдан / Дата</Text><Text style={styles.infoValue}>{client.passport_issued_by || '—'} {client.passport_issued_date ? `(${client.passport_issued_date})` : ''}</Text></View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Ionicons name="home" size={18} color="#0D416D" style={styles.infoIcon} />
                        <View style={{ flex: 1 }}><Text style={styles.infoLabel}>Прописка</Text><Text style={styles.infoValue}>{client.address_registration || '—'}</Text></View>
                    </View>
                </BlurView>

                <TouchableOpacity style={styles.actionBtn} onPress={() => router.push({ pathname: '/add-deal', params: { clientId: client.id } })}>
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
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
    backBtn: { width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
    headerTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
    errorText: { color: '#ef4444', fontSize: 16, textAlign: 'center', marginTop: 40, fontWeight: '700' },
    scrollContent: { paddingHorizontal: 20 },
    
    mainCard: { alignItems: 'center', padding: 30, borderRadius: 32, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.4)' },
    avatarPlaceholder: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#0D416D', justifyContent: 'center', alignItems: 'center', marginBottom: 15, shadowColor: '#0D416D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    avatarText: { color: '#FFF', fontSize: 36, fontWeight: '900' },
    clientName: { color: '#0F172A', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
    badge: { backgroundColor: 'rgba(13, 65, 109, 0.1)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
    badgeText: { color: '#0D416D', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
    
    sectionTitle: { color: '#334155', fontSize: 13, fontWeight: '900', marginBottom: 10, marginLeft: 5, textTransform: 'uppercase', letterSpacing: 1.5 },
    infoCard: { borderRadius: 24, marginBottom: 25, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.4)' },
    infoRow: { flexDirection: 'row', alignItems: 'center', padding: 18 },
    infoIcon: { marginRight: 15, backgroundColor: 'rgba(255,255,255,0.6)', padding: 12, borderRadius: 14, overflow: 'hidden' },
    infoLabel: { color: '#64748B', fontSize: 11, marginBottom: 4, fontWeight: '800', textTransform: 'uppercase' },
    infoValue: { color: '#1E293B', fontSize: 15, fontWeight: '700' },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.5)', marginLeft: 70 },
    
    actionBtn: { flexDirection: 'row', backgroundColor: '#0D416D', padding: 20, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 10, gap: 10, shadowColor: '#0D416D', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5 },
    actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }
});