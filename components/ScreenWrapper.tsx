// src/components/ScreenWrapper.tsx
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

const { width, height } = Dimensions.get('window');

interface ScreenWrapperProps {
    children: React.ReactNode;
}

export default function ScreenWrapper({ children }: ScreenWrapperProps) {
    return (
        <View style={styles.container}>
            {/* Базовый градиент в стиле iOS */}
            <LinearGradient
                colors={['#0f172a', '#1e3a8a', '#000000']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
            
            {/* Декоративные пятна (Блюр) для глубины */}
            <View style={[styles.circle, { top: -height * 0.1, left: -width * 0.2, backgroundColor: 'rgba(59, 130, 246, 0.2)' }]} />
            <View style={[styles.circle, { top: height * 0.4, right: -width * 0.4, backgroundColor: 'rgba(236, 72, 153, 0.15)' }]} />

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
        backgroundColor: '#000',
    },
    circle: {
        position: 'absolute',
        width: width,
        height: width,
        borderRadius: width / 2,
        filter: 'blur(60px)',
    },
    content: {
        flex: 1,
        // Отступы, чтобы контент не перекрывался прозрачным хедером и таббаром
        paddingTop: 100, 
        paddingBottom: 90,
        paddingHorizontal: 20,
    }
});