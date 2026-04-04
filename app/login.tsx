import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import ManagerSLBrand from '../components/branding/ManagerSLBrand';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { loginRequest } from '../src/api/apiClient';
import { useTheme } from '../src/context/ThemeContext';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function LoginScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, hydrated, loading: sessionLoading, reload } = useCurrentUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (hydrated && user?.id) {
      router.replace('/(app)');
    }
  }, [hydrated, router, user?.id]);

  const emailError = useMemo(() => {
    if (!email.trim()) return '';
    return isValidEmail(email.trim()) ? '' : 'Неверный формат email';
  }, [email]);

  const passwordError = useMemo(() => {
    if (!password) return '';
    if (password.length < 6) return 'Пароль должен быть не меньше 6 символов';
    return '';
  }, [password]);

  const canSubmit =
    hydrated &&
    !sessionLoading &&
    !!email.trim() &&
    !!password &&
    !emailError &&
    !passwordError &&
    !submitting;

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Внимание', 'Заполни email и пароль.');
      return;
    }

    if (emailError || passwordError) {
      Alert.alert('Проверь данные', emailError || passwordError);
      return;
    }

    setSubmitting(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      await loginRequest(normalizedEmail, password);

      const freshUser = await reload({ preferCache: true });

      if (!freshUser?.id) {
        Alert.alert(
          'Вход выполнен не до конца',
          'Токен получен, но профиль не загрузился. Повтори вход ещё раз.'
        );
        return;
      }

      router.replace('/(app)');
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.non_field_errors?.[0] ||
        error?.response?.data?.email?.[0] ||
        'Не удалось войти.';
      Alert.alert('Ошибка входа', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={theme.gradientMain as [string, string, ...string[]]}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.content}>
            <View style={styles.brandWrap}>
              <ManagerSLBrand />
            </View>

            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.glassStrong,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: theme.backgroundSoft,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={[styles.badgeDot, { backgroundColor: theme.blue }]} />
                  <Text style={[styles.badgeText, { color: theme.textSecondary }]}>
                    Secure login
                  </Text>
                </View>
              </View>

              <Text style={[styles.cardTitle, { color: theme.text }]}>Вход в систему</Text>

              <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                Авторизация для менеджеров и администраторов
              </Text>

              <View
                style={[
                  styles.heroPanel,
                  {
                    backgroundColor: theme.backgroundSoft,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.heroRow}>
                  <View style={[styles.heroIconBox, { backgroundColor: theme.blueSoft }]}>
                    <Text style={[styles.heroIcon, { color: theme.blue }]}>✦</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.heroTitle, { color: theme.text }]}>
                      ManagerSL Access
                    </Text>
                    <Text style={[styles.heroText, { color: theme.textSecondary }]}>
                      Быстрый вход, аккуратный интерфейс и удобная работа на телефоне
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.form}>
                <View
                  style={[
                    styles.inputWrap,
                    {
                      backgroundColor: theme.surface,
                      borderColor: emailError ? theme.red : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>

                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="manager@studentslife.com"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.input, { color: theme.text }]}
                    returnKeyType="next"
                    editable={!submitting}
                  />

                  {!!emailError && (
                    <Text style={[styles.errorText, { color: theme.red }]}>{emailError}</Text>
                  )}
                </View>

                <View
                  style={[
                    styles.inputWrap,
                    {
                      backgroundColor: theme.surface,
                      borderColor: passwordError ? theme.red : theme.border,
                    },
                  ]}
                >
                  <View style={styles.passwordHead}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Пароль</Text>

                    <Pressable
                      onPress={() => setPasswordVisible((v) => !v)}
                      style={({ pressed }) => [
                        styles.togglePill,
                        {
                          backgroundColor: theme.backgroundSoft,
                          borderColor: theme.border,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.toggleText, { color: theme.blue }]}>
                        {passwordVisible ? 'Скрыть' : 'Показать'}
                      </Text>
                    </Pressable>
                  </View>

                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!passwordVisible}
                    placeholder="Введите пароль"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.input, { color: theme.text }]}
                    returnKeyType="done"
                    onSubmitEditing={submit}
                    editable={!submitting}
                  />

                  {!!passwordError && (
                    <Text style={[styles.errorText, { color: theme.red }]}>
                      {passwordError}
                    </Text>
                  )}
                </View>

                <Pressable
                  onPress={submit}
                  disabled={!canSubmit}
                  style={({ pressed }) => [
                    styles.buttonShell,
                    {
                      opacity: !canSubmit ? 0.55 : pressed ? 0.94 : 1,
                      transform: [{ scale: pressed ? 0.995 : 1 }],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={['#A71E17', '#CF3527', '#F05A3C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.button}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Войти</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 28,
  },
  content: {
    paddingHorizontal: 20,
  },
  brandWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  card: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 22,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 12,
  },
  cardHeader: {
    marginBottom: 14,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardTitle: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  cardSub: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  heroPanel: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    fontSize: 18,
    fontWeight: '900',
  },
  heroTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  heroText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  form: {
    marginTop: 20,
    gap: 14,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 2,
  },
  passwordHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  togglePill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '800',
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
  },
  buttonShell: {
    marginTop: 6,
    borderRadius: 22,
    overflow: 'hidden',
  },
  button: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.25,
  },
});