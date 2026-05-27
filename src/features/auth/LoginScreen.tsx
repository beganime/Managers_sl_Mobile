import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/ui/Button';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { theme } from '../../theme/theme';
import { toApiError } from '../../api/client';
import { useAuth } from '../../store/auth';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function LoginScreen() {
  const router = useRouter();
  const { isAuthenticated, login, status } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(app)/(tabs)' as any);
    }
  }, [isAuthenticated, router]);

  const emailError = useMemo(() => {
    if (!email.trim()) return null;
    return isValidEmail(email.trim()) ? null : 'Введите корректный email.';
  }, [email]);

  const canSubmit = Boolean(email.trim() && password && !emailError && !submitting);

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Проверьте форму', 'Введите email и пароль для входа.');
      return;
    }

    setSubmitting(true);

    try {
      await login({ email: email.trim().toLowerCase(), password });
      router.replace('/(app)/(tabs)' as any);
    } catch (error) {
      Alert.alert('Ошибка входа', toApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={theme.gradients.screen as [string, string, ...string[]]}
        style={StyleSheet.absoluteFillObject}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <View style={styles.content}>
          <LinearGradient
            colors={theme.gradients.hero as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Text style={styles.kicker}>Students Life Program for Managers</Text>
            <Text style={styles.logo}>ManagerSL</Text>
            <Text style={styles.subtitle}>ManagerSL ERP/CRM workspace</Text>
          </LinearGradient>

          <Card glass style={styles.card}>
            <Text style={styles.title}>Вход в систему</Text>
            <Text style={styles.description}>
              Используйте рабочий аккаунт ManagerSL для доступа к мобильному кабинету.
            </Text>

            <View style={styles.form}>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="manager@example.com"
                error={emailError}
                editable={!submitting && status !== 'loading'}
              />

              <Input
                label="Пароль"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Введите пароль"
                editable={!submitting && status !== 'loading'}
                onSubmitEditing={handleSubmit}
              />
            </View>

            <Button
              title="Войти"
              loading={submitting || status === 'loading'}
              disabled={!canSubmit}
              fullWidth
              onPress={handleSubmit}
            />
          </Card>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboard: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.spacing.xl,
    padding: theme.spacing.lg,
  },
  hero: {
    overflow: 'hidden',
    borderRadius: theme.radius.xl,
    gap: theme.spacing.sm,
    padding: theme.spacing.xl,
    ...theme.shadow.floating,
  },
  kicker: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  logo: {
    color: theme.colors.white,
    fontSize: 36,
    fontWeight: '900',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 15,
    fontWeight: '800',
  },
  card: {
    gap: theme.spacing.lg,
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  description: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  form: {
    gap: theme.spacing.lg,
  },
});
