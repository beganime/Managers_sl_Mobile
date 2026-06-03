import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../../api/client';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../store/auth';
import { theme } from '../../theme/theme';

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
        colors={['#071A33', '#0B2545', '#7A1020']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.logoBadge}>
              <Ionicons name="briefcase" size={26} color={theme.colors.white} />
            </View>
            <Text style={styles.kicker}>Students Life Program for Managers</Text>
            <Text style={styles.logo}>ManagerSL</Text>
            <Text style={styles.subtitle}>ERP / CRM / HRM mobile workspace</Text>
          </View>

          <BlurView intensity={42} tint="light" style={styles.glassFrame}>
            <Card glass style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.title}>Вход в кабинет</Text>
                <Text style={styles.description}>
                  Откройте рабочий день, CRM, финансы, документы и уведомления в одном мобильном пространстве.
                </Text>
              </View>

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

              <View style={styles.secureRow}>
                <Ionicons name="shield-checkmark-outline" size={17} color={theme.colors.success} />
                <Text style={styles.secureText}>Защищённая сессия ManagerSL</Text>
              </View>
            </Card>
          </BlurView>

          <View style={styles.footerPills}>
            <FeaturePill icon="people-outline" label="CRM" />
            <FeaturePill icon="wallet-outline" label="Finance" />
            <FeaturePill icon="document-text-outline" label="Docs" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FeaturePill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.featurePill}>
      <Ionicons name={icon} size={15} color={theme.colors.white} />
      <Text style={styles.featureText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.primary,
  },
  keyboard: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: theme.spacing.xl,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  brand: {
    gap: theme.spacing.sm,
  },
  logoBadge: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  kicker: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  logo: {
    color: theme.colors.white,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 0,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 16,
    fontWeight: '800',
  },
  glassFrame: {
    overflow: 'hidden',
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  card: {
    gap: theme.spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  cardHeader: {
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.text,
    fontSize: 25,
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
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.successSoft,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  secureText: {
    color: theme.colors.success,
    fontSize: 13,
    fontWeight: '900',
  },
  footerPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 9,
  },
  featureText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
});
