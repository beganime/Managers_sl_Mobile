import { BlurView } from 'expo-blur';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';

export default function CatalogScreen() {
    return (
        <ScreenWrapper>
            <BlurView intensity={40} tint="dark" style={styles.glassCard}>
                <Text style={styles.title}>📚 База знаний и ВУЗы</Text>
                <Text style={styles.text}>Услуги, программы и скрипты продаж</Text>
            </BlurView>
        </ScreenWrapper>
    );
}
const styles = StyleSheet.create({
    glassCard: { padding: 20, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    title: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
    text: { color: 'rgba(255,255,255,0.7)', fontSize: 14 }
});