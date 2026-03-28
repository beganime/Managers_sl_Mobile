import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
  const { user, reload } = useCurrentUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bootRedirecting, setBootRedirecting] = useState(false);

  // Если пользователь уже есть в памяти — не держим его на логине
  useFocusEffect(
    useCallback(() => {
      let active = true;

      const redirectIfAuthorized = async () => {
        if (!user) return;

        try {
          if (!active) return;
          setBootRedirecting(true);
          router.replace('/(app)');
        } finally {
          if (active) {
            setBootRedirecting(false);
          }
        }
      };

      redirectIfAuthorized();

      return () => {
        active = false;
      };
    }, [router, user])
  );

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
    !!email.trim() &&
    !!password &&
    !emailError &&
    !passwordError &&
    !loading &&
    !bootRedirecting;

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Внимание', 'Заполни email и пароль.');
      return;
    }

    if (emailError || passwordError) {
      Alert.alert('Проверь данные', emailError || passwordError);
      return;
    }

    setLoading(true);
    try {
      await loginRequest(email.trim(), password);

      // Важно: после логина принудительно обновляем current user,
      // чтобы приложение сразу увидело авторизацию без перезапуска
      try {
        await reload();
      } catch (reloadError) {
        console.log('reload after login failed', reloadError);
      }

      router.replace('/(app)');
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.non_field_errors?.[0] ||
        'Не удалось войти. Если это web-режим, сначала исправь CORS на сервере.';
      Alert.alert('Ошибка входа', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={theme.gradientMain as [string, string, ...string[]]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.orbBlue, { backgroundColor: theme.blue }]} />
      <View style={[styles.orbRed, { backgroundColor: theme.red }]} />

      <View style={styles.content}>
        <ManagerSLBrand />

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
          <Text style={[styles.cardTitle, { color: theme.text }]}>Вход в систему</Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            Надёжный доступ для менеджеров и администраторов
          </Text>

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
                <Pressable onPress={() => setPasswordVisible((v) => !v)}>
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
              />
              {!!passwordError && (
                <Text style={[styles.errorText, { color: theme.red }]}>{passwordError}</Text>
              )}
            </View>

            <Pressable
              onPress={submit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.buttonShell,
                { opacity: !canSubmit ? 0.55 : pressed ? 0.9 : 1 },
              ]}
            >
              <LinearGradient
                colors={['#B71D17', '#D93B2C', '#F05A3C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.button}
              >
                {loading || bootRedirecting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Войти</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  orbBlue: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 999,
    top: 20,
    right: -120,
    opacity: 0.08,
  },
  orbRed: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 999,
    bottom: -80,
    left: -140,
    opacity: 0.08,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  card: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 22,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 10,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  cardSub: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  form: {
    marginTop: 22,
    gap: 14,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
    fontWeight: '600',
  },
  passwordHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    marginTop: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },
  button: {
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});