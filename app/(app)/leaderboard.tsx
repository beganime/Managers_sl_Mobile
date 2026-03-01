// app/(app)/leaderboard.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
            const [leaderboardRes, teamRes] = await Promise.allSettled([
                apiClient.get('/gamification/leaderboard/'), 
                apiClient.get('/users/users/') // Запрос к твоему UserViewSet
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
                <View style={styles.center}><ActivityIndicator size="large" color="#fbbf24" /></View>
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
            <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}>
                
                <Text style={styles.sectionTitle}>🏆 Лучшие менеджеры</Text>
                
                {/* --- ПЬЕДЕСТАЛ ТОП-3 --- */}
                {leaders.length > 0 ? (
                    <View style={styles.pedestalContainer}>
                        
                        {/* 2 МЕСТО (СЛЕВА) */}
                        {top2 && (
                            <View style={[styles.pedestalItem, { marginTop: 40 }]}>
                                <View style={[styles.avatarWrapper, { borderColor: '#9ca3af' }]}>
                                    {top2.avatar ? <Image source={{ uri: top2.avatar }} style={styles.avatarLarge} /> : <View style={styles.avatarPlaceholderLarge}><Text style={styles.avatarInitials}>{top2.first_name?.charAt(0) || '@'}</Text></View>}
                                    <View style={[styles.rankBadgeSmall, { backgroundColor: '#9ca3af' }]}><Text style={styles.rankBadgeText}>2</Text></View>
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
                                    <Ionicons name="scan" size={40} color="#fbbf24" style={{ position: 'absolute', opacity: 0.3, transform: [{scale: 1.5}] }} />
                                    <Text style={{ fontSize: 35 }}>👑</Text>
                                </Animated.View>
                                
                                <View style={[styles.avatarWrapper, { borderColor: '#fbbf24', borderWidth: 4, width: 90, height: 90 }]}>
                                    {top1.avatar ? <Image source={{ uri: top1.avatar }} style={[styles.avatarLarge, { width: 82, height: 82, borderRadius: 41 }]} /> : <View style={[styles.avatarPlaceholderLarge, { width: 82, height: 82, borderRadius: 41 }]}><Text style={[styles.avatarInitials, { fontSize: 32 }]}>{top1.first_name?.charAt(0) || '@'}</Text></View>}
                                    <View style={[styles.rankBadgeSmall, { backgroundColor: '#fbbf24', bottom: -10 }]}><Text style={styles.rankBadgeText}>1</Text></View>
                                </View>
                                <Text style={[styles.pedestalName, { fontSize: 18, color: '#fbbf24', marginTop: 15 }]}>{top1.first_name}</Text>
                                <Text style={[styles.pedestalRevenue, { fontSize: 16, color: '#fff' }]}>${getRevenue(top1)}</Text>
                            </View>
                        )}

                        {/* 3 МЕСТО (СПРАВА) */}
                        {top3 && (
                            <View style={[styles.pedestalItem, { marginTop: 60 }]}>
                                <View style={[styles.avatarWrapper, { borderColor: '#b45309' }]}>
                                    {top3.avatar ? <Image source={{ uri: top3.avatar }} style={styles.avatarLarge} /> : <View style={styles.avatarPlaceholderLarge}><Text style={styles.avatarInitials}>{top3.first_name?.charAt(0) || '@'}</Text></View>}
                                    <View style={[styles.rankBadgeSmall, { backgroundColor: '#b45309' }]}><Text style={styles.rankBadgeText}>3</Text></View>
                                </View>
                                <Text style={styles.pedestalName}>{top3.first_name}</Text>
                                <Text style={styles.pedestalRevenue}>${getRevenue(top3)}</Text>
                            </View>
                        )}

                    </View>
                ) : (
                    <BlurView intensity={40} tint="dark" style={styles.leadersContainer}><Text style={styles.emptyText}>Рейтинг пока пуст</Text></BlurView>
                )}

                {/* --- ОСТАЛЬНЫЕ МЕСТА (4 и далее) --- */}
                {restLeaders.length > 0 && (
                    <BlurView intensity={40} tint="dark" style={styles.leadersContainer}>
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
                        // Проверяем поле is_effective из бэкенда
                        const isIneffective = member.is_effective === false;

                        return (
                            <BlurView 
                                key={member.id} 
                                intensity={30} 
                                tint="dark" 
                                style={[styles.teamCard, isIneffective && styles.teamCardIneffective]}
                            >
                                <View style={styles.avatarWrapperSmall}>
                                    {member.avatar ? (
                                        <Image source={{ uri: member.avatar }} style={[styles.avatar, isIneffective && { opacity: 0.5 }]} />
                                    ) : (
                                        <View style={[styles.avatarPlaceholder, isIneffective && { backgroundColor: 'rgba(156, 163, 175, 0.5)' }]}>
                                            <Text style={styles.avatarInitials}>{member.first_name?.charAt(0) || '@'}</Text>
                                        </View>
                                    )}
                                </View>
                                
                                <View style={styles.teamContent}>
                                    <Text style={[styles.teamName, isIneffective && { color: '#9ca3af' }]}>
                                        {member.first_name} {member.last_name}
                                    </Text>
                                    
                                    {/* --- ОФИС (из поля office_name) --- */}
                                    <View style={styles.officeRow}>
                                        <Ionicons name="location" size={12} color="rgba(255,255,255,0.4)" />
                                        <Text style={styles.teamOffice}>{member.office_name || 'Офис не указан'}</Text>
                                    </View>
                                    
                                    <Text style={styles.teamStatus}>
                                        {member.work_status === 'working' ? '🟢 В офисе' : member.work_status === 'vacation' ? '🟡 В отпуске' : '🔴 На больничном'}
                                    </Text>

                                    {/* --- БЕЙДЖ НЕЭФФЕКТИВНОСТИ --- */}
                                    {isIneffective && (
                                        <View style={styles.ineffectiveBadge}>
                                            <Ionicons name="warning" size={12} color="#fca5a5" style={{marginRight: 4}} />
                                            <Text style={styles.ineffectiveText}>Низкая активность</Text>
                                        </View>
                                    )}
                                </View>
                                
                                <TouchableOpacity style={styles.callBtn}>
                                    <Ionicons name="call" size={18} color={isIneffective ? "#9ca3af" : "#3b82f6"} />
                                </TouchableOpacity>
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
    sectionTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 20, marginLeft: 4, letterSpacing: 0.5 },
    
    // Пьедестал
    pedestalContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginBottom: 30, paddingHorizontal: 10, height: 180 },
    pedestalItem: { alignItems: 'center', marginHorizontal: 10, width: '30%' },
    avatarWrapper: { borderRadius: 50, borderWidth: 3, padding: 2, position: 'relative', alignItems: 'center', justifyContent: 'center' },
    avatarLarge: { width: 64, height: 64, borderRadius: 32 },
    avatarPlaceholderLarge: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(59, 130, 246, 0.3)', justifyContent: 'center', alignItems: 'center' },
    avatarInitials: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    rankBadgeSmall: { position: 'absolute', bottom: -8, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1f2937' },
    rankBadgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
    pedestalName: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginTop: 12, textAlign: 'center' },
    pedestalRevenue: { color: '#4ade80', fontSize: 13, fontWeight: '600', marginTop: 2 },

    // Список лидеров (от 4 места)
    leadersContainer: { borderRadius: 24, padding: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', backgroundColor: 'rgba(0,0,0,0.2)' },
    leaderRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    rankBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginRight: 15 },
    rankText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    userInfo: { flex: 1 },
    userName: { color: '#fff', fontSize: 16, fontWeight: '600' },
    userRevenue: { color: '#4ade80', fontSize: 12, marginTop: 2, fontWeight: '500' },
    
    // Команда
    teamCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.05)' },
    teamCardIneffective: { borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(0, 0, 0, 0.4)' }, // Тусклая карточка для неэффективных
    avatarWrapperSmall: { marginRight: 15 },
    avatar: { width: 50, height: 50, borderRadius: 25 },
    avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(59, 130, 246, 0.4)', justifyContent: 'center', alignItems: 'center' },
    teamContent: { flex: 1 },
    teamName: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 2 },
    officeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    teamOffice: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginLeft: 4 },
    teamStatus: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '500' },
    
    // Бейдж неэффективности
    ineffectiveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
    ineffectiveText: { color: '#fca5a5', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
    
    callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.05)', justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', padding: 20 },
});