// app/(app)/leaderboard.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';

export default function LeaderboardScreen() {
    const [leaders, setLeaders] = useState<any[]>([]);
    const [team, setTeam] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchGamificationData = async () => {
        try {
            const [leaderboardRes, teamRes] = await Promise.all([
                apiClient.get('/gamification/leaderboard/'),
                apiClient.get('/users/users/')
            ]);
            
            setLeaders(leaderboardRes.data.results || leaderboardRes.data);
            setTeam(teamRes.data.results || teamRes.data);
        } catch (error) {
            console.error("Ошибка загрузки рейтинга", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchGamificationData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchGamificationData();
    };

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}>
                
                <Text style={styles.sectionTitle}>🏆 Топ месяца</Text>
                <BlurView intensity={40} tint="dark" style={styles.leadersContainer}>
                    {leaders.length === 0 ? (
                        <Text style={styles.emptyText}>Рейтинг пока пуст</Text>
                    ) : (
                        leaders.map((user, index) => (
                            <View key={user.id} style={styles.leaderRow}>
                                <View style={styles.rankBadge}>
                                    <Text style={styles.rankText}>#{index + 1}</Text>
                                </View>
                                <View style={styles.userInfo}>
                                    <Text style={styles.userName}>{user.first_name || user.email}</Text>
                                    <Text style={styles.userRevenue}>Выручка: ${user.revenue || 0}</Text>
                                </View>
                                {index === 0 && <Ionicons name="medal" size={24} color="#fbbf24" />}
                                {index === 1 && <Ionicons name="medal" size={24} color="#9ca3af" />}
                                {index === 2 && <Ionicons name="medal" size={24} color="#b45309" />}
                            </View>
                        ))
                    )}
                </BlurView>

                <Text style={[styles.sectionTitle, { marginTop: 30 }]}>👥 Команда</Text>
                {team.length === 0 ? (
                    <Text style={styles.emptyText}>Сотрудники не найдены</Text>
                ) : (
                    team.map((member) => (
                        <BlurView key={member.id} intensity={30} tint="dark" style={styles.teamCard}>
                            {member.avatar ? (
                                <Image source={{ uri: member.avatar }} style={styles.avatar} />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <Ionicons name="person" size={20} color="#fff" />
                                </View>
                            )}
                            <View style={styles.teamContent}>
                                <Text style={styles.teamName}>{member.first_name} {member.last_name}</Text>
                                <Text style={styles.teamStatus}>
                                    {member.work_status === 'working' ? '🟢 В офисе' : member.work_status === 'vacation' ? '🟡 В отпуске' : '🔴 На больничном'}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.callBtn}>
                                <Ionicons name="call" size={18} color="#3b82f6" />
                            </TouchableOpacity>
                        </BlurView>
                    ))
                )}
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    sectionTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 15, marginLeft: 4, letterSpacing: 0.5 },
    leadersContainer: {
        borderRadius: 24,
        padding: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    leaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    rankBadge: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        marginRight: 15,
    },
    rankText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    userInfo: { flex: 1 },
    userName: { color: '#fff', fontSize: 16, fontWeight: '600' },
    userRevenue: { color: '#4ade80', fontSize: 12, marginTop: 2, fontWeight: '500' },
    teamCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    avatar: { width: 46, height: 46, borderRadius: 23, marginRight: 15 },
    avatarPlaceholder: {
        width: 46, height: 46, borderRadius: 23, marginRight: 15,
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        justifyContent: 'center', alignItems: 'center',
    },
    teamContent: { flex: 1 },
    teamName: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
    teamStatus: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
    callBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        justifyContent: 'center', alignItems: 'center',
    },
    emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', padding: 20 },
});