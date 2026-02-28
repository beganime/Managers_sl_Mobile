// app/(app)/client/[id].tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../../../components/ScreenWrapper';
import apiClient from '../../../src/api/apiClient';

export default function ClientDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [client, setClient] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchClient = async () => {
            try {
                // В офлайне можно добавить чтение из кэша по ID, но пока делаем прямой запрос
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

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
            </ScreenWrapper>
        );
    }

    if (!client) {
        return (
            <ScreenWrapper>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.errorText}>Клиент не найден</Text>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Карточка клиента</Text>
                <View style={{width: 40}} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                <BlurView intensity={40} tint="dark" style={styles.mainCard}>
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>{client.full_name?.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.clientName}>{client.is_priority ? '⭐ ' : ''}{client.full_name}</Text>
                    <Text style={styles.clientStatus}>{client.status || 'Новый'}</Text>
                </BlurView>

                <Text style={styles.sectionTitle}>Контакты</Text>
                <BlurView intensity={30} tint="dark" style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Ionicons name="call" size={18} color="#3b82f6" style={styles.infoIcon} />
                        <View>
                            <Text style={styles.infoLabel}>Телефон</Text>
                            <Text style={styles.infoValue}>{client.phone}</Text>
                        </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Ionicons name="mail" size={18} color="#3b82f6" style={styles.infoIcon} />
                        <View>
                            <Text style={styles.infoLabel}>Email</Text>
                            <Text style={styles.infoValue}>{client.email || 'Не указан'}</Text>
                        </View>
                    </View>
                </BlurView>

                <Text style={styles.sectionTitle}>Документы</Text>
                <BlurView intensity={30} tint="dark" style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Ionicons name="earth" size={18} color="#10b981" style={styles.infoIcon} />
                        <View>
                            <Text style={styles.infoLabel}>Гражданство</Text>
                            <Text style={styles.infoValue}>{client.citizenship || 'Туркменистан'}</Text>
                        </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoRow}>
                        <Ionicons name="book" size={18} color="#10b981" style={styles.infoIcon} />
                        <View>
                            <Text style={styles.infoLabel}>Загранпаспорт</Text>
                            <Text style={styles.infoValue}>{client.passport_inter_num || 'Не заполнен'}</Text>
                        </View>
                    </View>
                </BlurView>

                {/* Комментарии */}
                {client.comments ? (
                    <>
                        <Text style={styles.sectionTitle}>Комментарии</Text>
                        <BlurView intensity={30} tint="dark" style={[styles.infoCard, { padding: 20 }]}>
                            <Text style={{color: 'rgba(255,255,255,0.8)', lineHeight: 22}}>{client.comments}</Text>
                        </BlurView>
                    </>
                ) : null}

                <View style={{height: 50}} />
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
    mainCard: { alignItems: 'center', padding: 30, borderRadius: 24, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(59, 130, 246, 0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 2, borderColor: '#3b82f6' },
    avatarText: { color: '#60a5fa', fontSize: 32, fontWeight: 'bold' },
    clientName: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    clientStatus: { color: '#60a5fa', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
    sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginLeft: 5 },
    infoCard: { borderRadius: 20, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    infoRow: { flexDirection: 'row', alignItems: 'center', padding: 15 },
    infoIcon: { marginRight: 15, backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 12 },
    infoLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 2 },
    infoValue: { color: '#fff', fontSize: 16, fontWeight: '500' },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginLeft: 60 }
});