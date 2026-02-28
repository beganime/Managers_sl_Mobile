import { BlurView } from 'expo-blur';
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';

export default function DashboardScreen() {
    return (
        <ScreenWrapper>
            <ScrollView showsVerticalScrollIndicator={false}>
                <BlurView intensity={40} tint="dark" style={styles.glassCard}>
                    <Text style={styles.title}>🏆 Рейтинг месяца</Text>
                    <Text style={styles.text}>Здесь будет список менеджеров из API /api/gamification/leaderboard/</Text>
                </BlurView>

                <BlurView intensity={40} tint="dark" style={[styles.glassCard, { marginTop: 15 }]}>
                    <Text style={styles.title}>⏱ Моя смена</Text>
                    <Text style={styles.text}>Кнопка "Начать день" (API /api/timetracking/shifts/)</Text>
                </BlurView>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    glassCard: {
        padding: 20,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    title: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
    text: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 14 }
});