import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function DashboardScreen() {
    const router = useRouter();

    const handleLogout = async () => {
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
        router.replace('/login');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Дашборд ERP</Text>
            <Text style={styles.subtitle}>Здесь будут данные по сделкам и задачам</Text>
            
            <TouchableOpacity style={styles.button} onPress={handleLogout}>
                <Text style={styles.buttonText}>Выйти</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
    subtitle: { fontSize: 16, color: '#6b7280', marginTop: 8, marginBottom: 24 },
    button: { backgroundColor: '#ef4444', padding: 12, borderRadius: 8 },
    buttonText: { color: '#fff', fontWeight: 'bold' }
});