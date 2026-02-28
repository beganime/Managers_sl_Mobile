import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import { deleteToken } from '../../src/utils/storage';

export default function ProfileScreen() {
    const router = useRouter();

    const handleLogout = async () => {
        Alert.alert("Выход", "Вы уверены, что хотите выйти?", [
            { text: "Отмена", style: "cancel" },
            { 
                text: "Выйти", 
                style: "destructive",
                onPress: async () => {
                    await deleteToken('access_token');
                    await deleteToken('refresh_token');
                    router.replace('/login');
                }
            }
        ]);
    };

    return (
        <ScreenWrapper>
            <BlurView intensity={40} tint="dark" style={styles.glassCard}>
                <Text style={styles.title}>👤 Мой профиль</Text>
                <Text style={styles.text}>Здесь будут данные из /api/users/users/me/</Text>
                
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Выйти из аккаунта</Text>
                </TouchableOpacity>
            </BlurView>
        </ScreenWrapper>
    );
}
const styles = StyleSheet.create({
    glassCard: { padding: 20, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    title: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
    text: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 20 },
    logoutBtn: { backgroundColor: 'rgba(239, 68, 68, 0.2)', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.5)' },
    logoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 }
});