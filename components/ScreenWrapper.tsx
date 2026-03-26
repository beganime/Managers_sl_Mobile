// components/ScreenWrapper.tsx
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';

const { width, height } = Dimensions.get('window');

// Увеличенный отступ снизу, чтобы таббар точно не перекрывал контент
const BOTTOM_PADDING =
    Platform.OS === 'ios'   ? 100 :
    Platform.OS === 'web'   ? 80 : 90;

interface Props {
    children:   React.ReactNode;
    noPadding?: boolean;
}

export default function ScreenWrapper({ children, noPadding }: Props) {
    return (
        <View style={styles.container}>
            {/* Всегда светлый, "воздушный" градиент */}
            <LinearGradient
                colors={['#F8FAFC', '#F1F5F9', '#FFFFFF']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
            
            {/* Легкие, еле заметные акцентные пятна для глубины (не тёмные!) */}
            <View style={[styles.circle, { top: -height * 0.1, left: -width * 0.2, backgroundColor: '#007AFF', opacity: 0.03 }]} />
            <View style={[styles.circle, { top: height * 0.4, right: -width * 0.4, backgroundColor: '#34C759', opacity: 0.03 }]} />
            
            <View style={[styles.content, noPadding && styles.noPadding]}>
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    circle: {
        position: 'absolute',
        width: width * 1.2,
        height: width * 1.2,
        borderRadius: (width * 1.2) / 2,
        ...Platform.select({ web: { filter: 'blur(80px)' as any }, default: {} }),
    },
    content: {
        flex: 1,
        paddingTop: Platform.OS === 'web' ? 80 : Platform.OS === 'ios' ? 60 : 50,
        paddingBottom: BOTTOM_PADDING,
    },
    noPadding: { paddingBottom: 0 },
});