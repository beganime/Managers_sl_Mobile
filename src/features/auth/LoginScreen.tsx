import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { useAppTheme } from '../../theme/useAppTheme';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function LoginScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const { isAuthenticated, login, status } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="always"
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

          <BlurView intensity={42} tint={appTheme.dark ? 'dark' : 'light'} style={styles.glassFrame}>
            <Card
              glass
              style={[
                styles.card,
                {
                  backgroundColor: appTheme.dark ? 'rgba(8,18,36,0.84)' : 'rgba(255,255,255,0.82)',
                  borderColor: appTheme.dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.34)',
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.title, { color: appTheme.colors.text }]}>Вход в кабинет</Text>
                <Text style={[styles.description, { color: appTheme.colors.textMuted }]}>
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
                  returnKeyType="next"
                />

                <Input
                  label="Пароль"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!passwordVisible}
                  placeholder="Введите пароль"
                  editable={!submitting && status !== 'loading'}
                  onSubmitEditing={handleSubmit}
                  returnKeyType="done"
                  rightElement={
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={passwordVisible ? 'Скрыть пароль' : 'Показать пароль'}
                      hitSlop={8}
                      onPress={() => setPasswordVisible((current) => !current)}
                      style={styles.eyeButton}
                    >
                      <Ionicons
                        name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                        size={21}
                        color={appTheme.colors.textMuted}
                      />
                    </Pressable>
                  }
                />
              </View>

              <Button
                title="Войти"
                loading={submitting || status === 'loading'}
                disabled={!canSubmit}
                fullWidth
                onPress={handleSubmit}
              />

              <View style={[styles.secureRow, { backgroundColor: appTheme.colors.successSoft }]}>
                <Ionicons name="shield-checkmark-outline" size={17} color={appTheme.colors.success} />
                <Text style={[styles.secureText, { color: appTheme.colors.success }]}>
                  Защищённая сессия ManagerSL
                </Text>
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
    paddingBottom: 56,
    paddingTop: theme.spacing.xl,
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
  eyeButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  secureText: {
    color: theme.colors.success,
    flex: 1,
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
    paddingVertical: theme.spacing.sm,
  },
  featureText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
});
