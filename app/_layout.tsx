// app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import AnimatedSplash from '../components/AnimatedSplash';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { getToken } from '../src/utils/storage';

function RootNavigator() {
    const [isReady,             setIsReady]             = useState(false);
    const [isAuthenticated,     setIsAuthenticated]     = useState(false);
    const [showSplash,          setShowSplash]          = useState(true);
    const { isDark }            = useTheme();
    const segments              = useSegments();
    const router                = useRouter();

    useEffect(() => {
        getToken('access_token').then(token => {
            setIsAuthenticated(!!token);
            setIsReady(true);
        }).catch(() => {
            setIsAuthenticated(false);
            setIsReady(true);
        });
    }, []);

    useEffect(() => {
        if (!isReady || showSplash) return;
        const inApp   = segments[0] === '(app)';
        const isLogin = segments[0] === 'login';
        if (!isAuthenticated && !isLogin) router.replace('/login');
        else if (isAuthenticated && isLogin) router.replace('/(app)');
    }, [isAuthenticated, isReady, showSplash, segments]);

    if (showSplash) {
        return <AnimatedSplash onAnimationFinish={() => setShowSplash(false)} />;
    }
    if (!isReady) return null;

    return (
        <>
            <StatusBar
                barStyle={isDark ? 'light-content' : 'dark-content'}
                backgroundColor="transparent"
                translucent
            />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="login"  options={{ animation: 'fade' }} />
                <Stack.Screen name="(app)"  options={{ animation: 'fade' }} />
            </Stack>
        </>
    );
}

export default function RootLayout() {
    return (
        <ThemeProvider>
            <RootNavigator />
        </ThemeProvider>
    );
}