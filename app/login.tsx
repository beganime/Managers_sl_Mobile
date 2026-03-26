import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import BrandMark from '../components/BrandMark';
import PremiumCard from '../components/PremiumCard';
import { APP_CONFIG } from '../src/config/app';
import { login } from '../src/api/mobile';
import { useTheme } from '../src/context/ThemeContext';

export default function LoginScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const disabled = useMemo(() => !email.trim() || !password.trim(), [email, password]);

  const handleLogin = async () => {
    if (disabled) return;
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(app)');
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.non_field_errors?.[0] ||
        'Не удалось войти. Проверь почту, пароль и доступность сервера.';
      Alert.alert('Ошибка входа', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient colors={theme.gradientMain} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.orb, { backgroundColor: theme.red, top: 60, right: -40, opacity: 0.10 }]} />
      <View style={[styles.orb, styles.largeOrb, { backgroundColor: theme.blue, bottom: 40, left: -80, opacity: 0.10 }]} />

      <View style={styles.content}>
        <BrandMark />

        <PremiumCard style={styles.card}>
          <Text style={[styles.title, { color: theme.text }]}>Вход в CRM</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Премиальное рабочее приложение для команды {APP_CONFIG.companyName}
          </Text>

          <View style={styles.form}>
            <View style={[styles.inputWrap, { backgroundColor: theme.glassStrong, borderColor: theme.border }]}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="manager@studentslife"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text }]}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={[styles.inputWrap, { backgroundColor: theme.glassStrong, borderColor: theme.border }]}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Пароль</Text>
              <TextInput
                secureTextEntry
                placeholder="Введите пароль"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text }]}
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <Pressable
              onPress={handleLogin}
              style={({ pressed }) => [
                styles.button,
                { opacity: pressed || disabled ? 0.88 : 1 },
              ]}
              disabled={disabled || loading}
            >
              <LinearGradient colors={[theme.red, theme.blue]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buttonGradient}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Войти</Text>}
              </LinearGradient>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textMuted }]}>{APP_CONFIG.domain}</Text>
            <Text style={[styles.footerText, { color: theme.textMuted }]}>{APP_CONFIG.appName} · {APP_CONFIG.companyName}</Text>
          </View>
        </PremiumCard>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  orb: { position: 'absolute', width: 220, height: 220, borderRadius: 999 },
  largeOrb: { width: 320, height: 320 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 22, gap: 22 },
  card: { padding: 22 },
  title: { fontSize: 28, fontWeight: '900' },
  subtitle: { marginTop: 8, lineHeight: 20 },
  form: { marginTop: 24, gap: 14 },
  inputWrap: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  input: { fontSize: 16, fontWeight: '600' },
  button: { marginTop: 6, borderRadius: 20, overflow: 'hidden' },
  buttonGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  footer: { marginTop: 18, gap: 4 },
  footerText: { fontSize: 12, fontWeight: '600' }
}
