// app/login.tsx
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import apiClient from '../src/api/apiClient';
import { saveToken } from '../src/utils/storage';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("Ошибка", "Заполните все поля");
            return;
        }

        setLoading(true);
        try {
            console.log("Отправка запроса на авторизацию...");
            const response = await apiClient.post('/token/', { email, password });
            
            console.log("Успешный ответ:", response.data);
            
            // Сохраняем токены универсальным методом
            await saveToken('access_token', response.data.access);
            await saveToken('refresh_token', response.data.refresh);
            
            // Перебрасываем в защищенную зону
            router.replace('/(app)');
        } catch (error: any) {
            // Выводим ошибку в консоль для дебага
            console.error("Ошибка авторизации:", error.response?.data || error.message);
            Alert.alert(
                "Ошибка входа", 
                error.response?.data?.detail || "Неверный логин или пароль. Либо API недоступен."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView 
            style={styles.container} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <LinearGradient
                colors={['#0f172a', '#1e3a8a', '#312e81']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            <View style={[styles.circle, { top: height * 0.05, left: -width * 0.2, backgroundColor: 'rgba(59, 130, 246, 0.4)' }]} />
            <View style={[styles.circle, { bottom: height * 0.1, right: -width * 0.3, backgroundColor: 'rgba(236, 72, 153, 0.3)' }]} />

            <View style={styles.blurContainer}>
                <BlurView intensity={50} tint="dark" style={styles.glassCard}>
                    <Text style={styles.title}>Managers SL</Text>
                    <Text style={styles.subtitle}>Система управления</Text>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Email сотрудника"
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Пароль"
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Войти</Text>
                        )}
                    </TouchableOpacity>
                </BlurView>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    circle: {
        position: 'absolute',
        width: width * 0.9,
        height: width * 0.9,
        borderRadius: width * 0.45,
    },
    blurContainer: {
        width: '85%',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    glassCard: {
        padding: 32,
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)', 
    },
    title: {
        fontSize: 34,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 4,
        letterSpacing: 1,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 32,
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    inputContainer: {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    input: {
        height: 56,
        paddingHorizontal: 20,
        color: '#fff',
        fontSize: 16,
        outlineStyle: 'none', // Убирает синюю рамку инпута на Web
    },
    button: {
        width: '100%',
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 10,
        borderWidth: 1,
        borderColor: 'rgba(96, 165, 250, 0.5)',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});