// components/ScreenWrapper.tsx
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { useTheme } from '../src/context/ThemeContext';

const { width, height } = Dimensions.get('window');

const BOTTOM_PADDING =
    Platform.OS === 'ios'   ? 65 + 20 + 16 :
    Platform.OS === 'web'   ? 80            : 60 + 12 + 16;

interface Props {
    children:   React.ReactNode;
    noPadding?: boolean;
}

export default function ScreenWrapper({ children, noPadding }: Props) {
    const { theme } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <LinearGradient
                colors={theme.gradientBg as [string, string, ...string[]]}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
            <View style={[styles.circle, { top: -height * 0.1, left: -width * 0.2, backgroundColor: theme.primaryDeep, opacity: 0.07 }]} />
            <View style={[styles.circle, { top: height * 0.4, right: -width * 0.4, backgroundColor: theme.accent, opacity: 0.05 }]} />
            <View style={[styles.content, noPadding && styles.noPadding]}>
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    circle: {
        position: 'absolute',
        width: width * 1.2,
        height: width * 1.2,
        borderRadius: (width * 1.2) / 2,
        ...Platform.select({ web: { filter: 'blur(80px)' as any }, default: {} }),
    },
    content: {
        flex: 1,
        paddingTop: Platform.OS === 'web' ? 80 : Platform.OS === 'ios' ? 100 : 90,
        paddingBottom: Platform.OS === 'web' ? 80 : BOTTOM_PADDING,
    },
    noPadding: { paddingBottom: 0 },
});