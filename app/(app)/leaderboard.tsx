// app/(app)/leaderboard.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';

export default function LeaderboardScreen() {
    const [leaders, setLeaders] = useState<any[]>([]);
    const [team, setTeam] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Анимация для парящей короны над первым местом
    const crownAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Бесконечная анимация вверх-вниз
        Animated.loop(
            Animated.sequence([
                Animated.timing(crownAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(crownAnim, {
                    toValue: 0,
                    duration: 1500,
                    useNativeDriver: true,
                })
            ])
        ).start();
    }, []);

    const crownTranslateY = crownAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -8] // Поднимаем на 8 пикселей
    });

    const fetchGamificationData = async () => {
        try {
            // ИСПРАВЛЕНИЕ: Убрал начальные слэши для правильной работы Axios
            const [leaderboardRes, teamRes] = await Promise.allSettled([
                apiClient.get('gamification/leaderboard/'), 
                apiClient.get('users/users/')
            ]);
            
            if (leaderboardRes.status === 'fulfilled') {
                setLeaders(leaderboardRes.value.data.results || leaderboardRes.value.data);
            }
            if (teamRes.status === 'fulfilled') {
                setTeam(teamRes.value.data.results || teamRes.value.data);
            }
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
                <View style={styles.center}><ActivityIndicator size="large" color="#f59e0b" /></View>
            </ScreenWrapper>
        );
    }

    // Распределяем лидеров
    const top1 = leaders.length > 0 ? leaders[0] : null;
    const top2 = leaders.length > 1 ? leaders[1] : null;
    const top3 = leaders.length > 2 ? leaders[2] : null;
    const restLeaders = leaders.slice(3);

    // Безопасное получение выручки
    const getRevenue = (user: any) => {
        const rev = user.managersalary?.current_month_revenue || user.revenue || 0;
        return parseFloat(rev).toLocaleString();
    };

    return (
        <ScreenWrapper>
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient colors={['#F1F5F9', '#E2E8F0']} style={StyleSheet.absoluteFillObject} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D416D" />}>
                
                <Text style={styles.sectionTitle}>🏆 Лучшие менеджеры</Text>
                
                {/* --- ПЬЕДЕСТАЛ ТОП-3 --- */}
                {leaders.length > 0 ? (
                    <View style={styles.pedestalContainer}>
                        
                        {/* 2 МЕСТО (СЛЕВА) */}
                        {top2 && (
                            <View style={[styles.pedestalItem, { marginTop: 40 }]}>
                                <View style={[styles.avatarWrapper, { borderColor: '#94a3b8' }]}>
                                    {top2.avatar ? <Image source={{ uri: top2.avatar }} style={styles.avatarLarge} /> : <View style={[styles.avatarPlaceholderLarge, {backgroundColor: 'rgba(148, 163, 184, 0.2)'}]}><Text style={[styles.avatarInitials, {color: '#64748B'}]}>{top2.first_name?.charAt(0) || '@'}</Text></View>}
                                    <View style={[styles.rankBadgeSmall, { backgroundColor: '#94a3b8', borderColor: '#F1F5F9' }]}><Text style={styles.rankBadgeText}>2</Text></View>
                                </View>
                                <Text style={styles.pedestalName}>{top2.first_name}</Text>
                                <Text style={styles.pedestalRevenue}>${getRevenue(top2)}</Text>
                            </View>
                        )}

                        {/* 1 МЕСТО (ЦЕНТР) */}
                        {top1 && (
                            <View style={[styles.pedestalItem, { zIndex: 10 }]}>
                                {/* АНИМИРОВАННАЯ КОРОНА */}
                                <Animated.View style={{ transform: [{ translateY: crownTranslateY }], alignItems: 'center', marginBottom: -10, zIndex: 20 }}>
                                    <Ionicons name="scan" size={40} color="#f59e0b" style={{ position: 'absolute', opacity: 0.15, transform: [{scale: 1.5}] }} />
                                    <Text style={{ fontSize: 35 }}>👑</Text>
                                </Animated.View>
                                
                                <View style={[styles.avatarWrapper, { borderColor: '#f59e0b', borderWidth: 4, width: 90, height: 90, shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 }]}>
                                    {top1.avatar ? <Image source={{ uri: top1.avatar }} style={[styles.avatarLarge, { width: 82, height: 82, borderRadius: 41 }]} /> : <View style={[styles.avatarPlaceholderLarge, { width: 82, height: 82, borderRadius: 41, backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}><Text style={[styles.avatarInitials, { fontSize: 32, color: '#d97706' }]}>{top1.first_name?.charAt(0) || '@'}</Text></View>}
                                    <View style={[styles.rankBadgeSmall, { backgroundColor: '#f59e0b', borderColor: '#F1F5F9', bottom: -10, width: 28, height: 28, borderRadius: 14 }]}><Text style={[styles.rankBadgeText, {fontSize: 14}]}>1</Text></View>
                                </View>
                                <Text style={[styles.pedestalName, { fontSize: 18, color: '#d97706', marginTop: 15, fontWeight: '900' }]}>{top1.first_name}</Text>
                                <Text style={[styles.pedestalRevenue, { fontSize: 16, color: '#10b981', fontWeight: '900' }]}>${getRevenue(top1)}</Text>
                            </View>
                        )}

                        {/* 3 МЕСТО (СПРАВА) */}
                        {top3 && (
                            <View style={[styles.pedestalItem, { marginTop: 60 }]}>
                                <View style={[styles.avatarWrapper, { borderColor: '#d97706' }]}>
                                    {top3.avatar ? <Image source={{ uri: top3.avatar }} style={styles.avatarLarge} /> : <View style={[styles.avatarPlaceholderLarge, {backgroundColor: 'rgba(217, 119, 6, 0.15)'}]}><Text style={[styles.avatarInitials, {color: '#b45309'}]}>{top3.first_name?.charAt(0) || '@'}</Text></View>}
                                    <View style={[styles.rankBadgeSmall, { backgroundColor: '#d97706', borderColor: '#F1F5F9' }]}><Text style={styles.rankBadgeText}>3</Text></View>
                                </View>
                                <Text style={styles.pedestalName}>{top3.first_name}</Text>
                                <Text style={styles.pedestalRevenue}>${getRevenue(top3)}</Text>
                            </View>
                        )}

                    </View>
                ) : (
                    <BlurView intensity={50} tint="light" style={styles.leadersContainer}><Text style={styles.emptyText}>Рейтинг пока пуст</Text></BlurView>
                )}

                {/* --- ОСТАЛЬНЫЕ МЕСТА (4 и далее) --- */}
                {restLeaders.length > 0 && (
                    <BlurView intensity={50} tint="light" style={styles.leadersContainer}>
                        {restLeaders.map((user, index) => (
                            <View key={user.id} style={styles.leaderRow}>
                                <View style={styles.rankBadge}>
                                    <Text style={styles.rankText}>#{index + 4}</Text>
                                </View>
                                <View style={styles.userInfo}>
                                    <Text style={styles.userName}>{user.first_name || user.email}</Text>
                                    <Text style={styles.userRevenue}>Выручка: ${getRevenue(user)}</Text>
                                </View>
                            </View>
                        ))}
                    </BlurView>
                )}

                {/* --- СПИСОК КОМАНДЫ (С ОФИСАМИ) --- */}
                <Text style={[styles.sectionTitle, { marginTop: 40 }]}>👥 Команда и Офисы</Text>
                {team.length === 0 ? (
                    <Text style={styles.emptyText}>Сотрудники не найдены</Text>
                ) : (
                    team.map((member) => {
                        const isIneffective = member.is_effective === false;

                        return (
                            <BlurView 
                                key={member.id} 
                                intensity={isIneffective ? 20 : 50} 
                                tint="light" 
                                style={[styles.teamCard, isIneffective && styles.teamCardIneffective]}
                            >
                                <View style={styles.avatarWrapperSmall}>
                                    {member.avatar ? (
                                        <Image source={{ uri: member.avatar }} style={[styles.avatar, isIneffective && { opacity: 0.5 }]} />
                                    ) : (
                                        <View style={[styles.avatarPlaceholder, isIneffective && { backgroundColor: 'rgba(148, 163, 184, 0.3)' }]}>
                                            <Text style={[styles.avatarInitialsSmall, isIneffective && {color: '#94A3B8'}]}>{member.first_name?.charAt(0) || '@'}</Text>
                                        </View>
                                    )}
                                </View>
                                
                                <View style={styles.teamContent}>
                                    <Text style={[styles.teamName, isIneffective && { color: '#64748B' }]}>
                                        {member.first_name} {member.last_name}
                                    </Text>
                                    
                                    <View style={styles.officeRow}>
                                        <Ionicons name="location" size={12} color="#64748B" />
                                        <Text style={styles.teamOffice}>{member.office?.city || 'Офис не указан'}</Text>
                                    </View>
                                    
                                    <Text style={styles.teamStatus}>
                                        {member.work_status === 'working' ? '🟢 Работает' : member.work_status === 'vacation' ? '🟡 В отпуске' : '🔴 На больничном'}
                                    </Text>

                                    {isIneffective && (
                                        <View style={styles.ineffectiveBadge}>
                                            <Ionicons name="warning" size={12} color="#ef4444" style={{marginRight: 4}} />
                                            <Text style={styles.ineffectiveText}>Низкая активность</Text>
                                        </View>
                                    )}
                                </View>
                                
                            </BlurView>
                        );
                    })
                )}
                
                <View style={{ height: 100 }} />
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { padding: 20 },
    sectionTitle: { color: '#0F172A', fontSize: 22, fontWeight: '900', marginBottom: 25, marginLeft: 4, letterSpacing: 0.5 },
    
    // Пьедестал
    pedestalContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginBottom: 30, paddingHorizontal: 10, height: 180 },
    pedestalItem: { alignItems: 'center', marginHorizontal: 10, width: '30%' },
    avatarWrapper: { borderRadius: 50, borderWidth: 3, padding: 2, position: 'relative', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
    avatarLarge: { width: 64, height: 64, borderRadius: 32 },
    avatarPlaceholderLarge: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(13, 65, 109, 0.1)', justifyContent: 'center', alignItems: 'center' },
    avatarInitials: { color: '#0D416D', fontSize: 24, fontWeight: '900' },
    avatarInitialsSmall: { color: '#0D416D', fontSize: 18, fontWeight: '900' },
    rankBadgeSmall: { position: 'absolute', bottom: -8, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
    rankBadgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
    pedestalName: { color: '#0F172A', fontSize: 15, fontWeight: '800', marginTop: 12, textAlign: 'center' },
    pedestalRevenue: { color: '#10b981', fontSize: 14, fontWeight: '800', marginTop: 2 },

    // Список лидеров (от 4 места)
    leadersContainer: { borderRadius: 28, padding: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: 'rgba(255,255,255,0.6)' },
    leaderRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(15,23,42,0.05)' },
    rankBadge: { backgroundColor: 'rgba(13, 65, 109, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginRight: 15 },
    rankText: { color: '#0D416D', fontWeight: '900', fontSize: 14 },
    userInfo: { flex: 1 },
    userName: { color: '#1E293B', fontSize: 16, fontWeight: '800' },
    userRevenue: { color: '#10b981', fontSize: 13, marginTop: 4, fontWeight: '700' },
    
    // Команда
    teamCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 24, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: 'rgba(255,255,255,0.6)' },
    teamCardIneffective: { borderColor: '#E2E8F0', backgroundColor: 'rgba(241, 245, 249, 0.6)' },
    avatarWrapperSmall: { marginRight: 15 },
    avatar: { width: 50, height: 50, borderRadius: 25 },
    avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(13, 65, 109, 0.1)', justifyContent: 'center', alignItems: 'center' },
    teamContent: { flex: 1 },
    teamName: { color: '#0F172A', fontSize: 16, fontWeight: '800', marginBottom: 4 },
    officeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    teamOffice: { color: '#475569', fontSize: 13, marginLeft: 4, fontWeight: '600' },
    teamStatus: { color: '#334155', fontSize: 12, fontWeight: '700', marginTop: 2 },
    
    // Бейдж неэффективности
    ineffectiveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
    ineffectiveText: { color: '#ef4444', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
    
    callBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(13, 65, 109, 0.05)', justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: '#94A3B8', fontSize: 15, textAlign: 'center', padding: 20, fontWeight: '600', fontStyle: 'italic' },
});