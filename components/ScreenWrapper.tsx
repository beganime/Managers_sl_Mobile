// components/ScreenWrapper.tsx
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native'; // Добавлен Platform

const { width, height } = Dimensions.get('window');

interface ScreenWrapperProps {
    children: React.ReactNode;
}

export default function ScreenWrapper({ children }: ScreenWrapperProps) {
    return (
        <View style={styles.container}>
            {/* Базовый градиент в стиле iOS (Светлая тема) */}
            <LinearGradient
                colors={['#F8FAFC', '#F1F5F9', '#E2E8F0']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
            
            {/* Декоративные пятна (Блюр) для глубины под матовым стеклом */}
            <View style={[styles.circle, { top: -height * 0.1, left: -width * 0.2, backgroundColor: '#0D416D', opacity: 0.08 }]} />
            <View style={[styles.circle, { top: height * 0.4, right: -width * 0.4, backgroundColor: '#10b981', opacity: 0.05 }]} />

            {/* Контент страницы */}
            <View style={styles.content}>
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC', // Светлый фон по умолчанию
    },
    circle: {
        position: 'absolute',
        width: width * 1.2,
        height: width * 1.2,
        borderRadius: (width * 1.2) / 2,
        // Для Web будет работать CSS-фильтр, для Native просто мягкая прозрачность
        filter: 'blur(80px)', 
    },
    content: {
        flex: 1,
        // Отступы, чтобы контент не перекрывался прозрачным хедером и таббаром
        paddingTop: Platform.OS === 'ios' ? 100 : 90, 
        paddingBottom: Platform.OS === 'ios' ? 95 : 85,
        // Убрали paddingHorizontal, чтобы страницы могли делать edge-to-edge дизайн (например, для шапок)
    }
});