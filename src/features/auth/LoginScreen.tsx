import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../../api/client';
import { Input } from '../../components/forms/Input';
import { Button } from '../../components/ui/Button';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../store/auth';
import { useAppTheme } from '../../theme/useAppTheme';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const CAPABILITIES: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  { icon: 'people-outline', title: 'Клиенты и заявки', text: 'Работа с анкетами, чатами и документами.' },
  { icon: 'time-outline', title: 'Рабочий день', text: 'Учёт времени, отчёты и контроль процессов.' },
  { icon: 'apps-outline', title: 'Все сервисы', text: 'Задачи, экзамены, переводы и диск в одном месте.' },
];

export function LoginScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const { themeMode, setTheme } = useTheme();
  const { width } = useWindowDimensions();
  const { isAuthenticated, login, status } = useAuth();
  const wide = width >= 880;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace('/(app)/(tabs)' as any);
  }, [isAuthenticated, router]);

  const emailError = useMemo(() => {
    if (!email.trim()) return null;
    return isValidEmail(email.trim()) ? null : 'Проверьте формат email.';
  }, [email]);
  const canSubmit = Boolean(email.trim() && password && !emailError && !submitting);

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Проверьте форму', 'Введите корректный email и пароль.');
      return;
    }
    setSubmitting(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      router.replace('/(app)/(tabs)' as any);
    } catch (error) {
      Alert.alert('Не удалось войти', toApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: appTheme.colors.background }]}>
      <View style={[styles.topAccent, { backgroundColor: appTheme.colors.accent }]} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        style={styles.keyboard}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.page, wide && styles.pageWide]}>
            <View
              style={[
                styles.shell,
                wide && styles.shellWide,
                {
                  backgroundColor: appTheme.colors.surfaceStrong,
                  borderColor: appTheme.colors.border,
                  ...appTheme.shadow.floating,
                },
              ]}
            >
              <BrandPanel compact={!wide} />

              <View style={[styles.formPanel, wide && styles.formPanelWide]}>
                <View style={styles.formTopbar}>
                  <Text style={[styles.internalLabel, { color: appTheme.colors.textMuted }]}>ВНУТРЕННЯЯ СИСТЕМА</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Сменить тему"
                    onPress={() => setTheme(themeMode === 'dark' ? 'light' : 'dark')}
                    style={({ pressed }) => [
                      styles.themeButton,
                      { backgroundColor: appTheme.colors.surfaceSoft, borderColor: appTheme.colors.border },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name={themeMode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={18} color={appTheme.colors.text} />
                  </Pressable>
                </View>

                <View style={styles.formHeader}>
                  <Text style={[styles.title, { color: appTheme.colors.text }]}>Вход в ManagerSL</Text>
                  <Text style={[styles.description, { color: appTheme.colors.textMuted }]}>Используйте рабочий аккаунт Students Life.</Text>
                </View>

                <View style={styles.form}>
                  <Input
                    label="Рабочий email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="name@manager-sl.ru"
                    error={emailError}
                    editable={!submitting && status !== 'loading'}
                    returnKeyType="next"
                    maxLength={255}
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
                    maxLength={255}
                    rightElement={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={passwordVisible ? 'Скрыть пароль' : 'Показать пароль'}
                        hitSlop={8}
                        onPress={() => setPasswordVisible((current) => !current)}
                        style={styles.eyeButton}
                      >
                        <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={21} color={appTheme.colors.textMuted} />
                      </Pressable>
                    }
                  />
                </View>

                <Button
                  title="Войти в систему"
                  loading={submitting || status === 'loading'}
                  disabled={!canSubmit}
                  fullWidth
                  onPress={handleSubmit}
                  style={styles.submitButton}
                />

                <View style={[styles.securityNote, { borderColor: appTheme.colors.border }]}>
                  <View style={[styles.securityIcon, { backgroundColor: appTheme.colors.successSoft }]}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={appTheme.colors.success} />
                  </View>
                  <View style={styles.securityCopy}>
                    <Text style={[styles.securityTitle, { color: appTheme.colors.text }]}>Защищённое подключение</Text>
                    <Text style={[styles.securityText, { color: appTheme.colors.textMuted }]}>Доступ разрешён только сотрудникам компании.</Text>
                  </View>
                </View>

                <Text style={[styles.help, { color: appTheme.colors.textSoft }]}>Проблемы со входом? Обратитесь к администратору ManagerSL.</Text>
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: appTheme.colors.screenTextMuted }]}>© 2026 Students Life</Text>
              <View style={styles.footerStatus}>
                <View style={[styles.statusDot, { backgroundColor: appTheme.colors.success }]} />
                <Text style={[styles.footerText, { color: appTheme.colors.screenTextMuted }]}>manager-sl.ru</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BrandPanel({ compact }: { compact: boolean }) {
  return (
    <View style={[styles.brandPanel, compact && styles.brandPanelCompact]}>
      <View style={styles.brandHeader}>
        <View style={styles.logoFrame}>
          <Image source={require('../../../assets/images/icon-release.png')} style={styles.logoImage} resizeMode="contain" />
        </View>
        <View style={styles.brandNameWrap}>
          <Text style={styles.brandName}>ManagerSL</Text>
          <Text style={styles.companyName}>STUDENTS LIFE</Text>
        </View>
      </View>

      {!compact ? (
        <>
          <View style={styles.brandCopy}>
            <Text style={styles.brandEyebrow}>ЕДИНОЕ РАБОЧЕЕ ПРОСТРАНСТВО</Text>
            <Text style={styles.brandTitle}>Работа с клиентами без лишней сложности.</Text>
            <Text style={styles.brandText}>Заявки, документы, коммуникация и внутренние сервисы собраны в одном кабинете.</Text>
          </View>
          <View style={styles.capabilities}>
            {CAPABILITIES.map((item) => (
              <View key={item.title} style={styles.capability}>
                <View style={styles.capabilityIcon}>
                  <Ionicons name={item.icon} size={19} color="#FFFFFF" />
                </View>
                <View style={styles.capabilityCopy}>
                  <Text style={styles.capabilityTitle}>{item.title}</Text>
                  <Text style={styles.capabilityText}>{item.text}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={styles.compactCaption}>Рабочий кабинет сотрудников</Text>
      )}
      <View style={styles.brandRule} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topAccent: { height: 4, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 2 },
  keyboard: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 28 },
  page: { alignSelf: 'center', maxWidth: 520, width: '100%' },
  pageWide: { maxWidth: 1120 },
  shell: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  shellWide: { flexDirection: 'row', minHeight: 680 },
  brandPanel: { backgroundColor: '#0B1F36', flex: 1.06, justifyContent: 'space-between', minHeight: 680, overflow: 'hidden', padding: 44, position: 'relative' },
  brandPanelCompact: { flexBasis: 112, flexGrow: 0, flexShrink: 0, minHeight: 112, paddingHorizontal: 22, paddingVertical: 18 },
  brandHeader: { alignItems: 'center', flexDirection: 'row', gap: 13 },
  logoFrame: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 15, height: 52, justifyContent: 'center', overflow: 'hidden', width: 52 },
  logoImage: { height: 48, width: 48 },
  brandNameWrap: { gap: 2 },
  brandName: { color: '#FFFFFF', fontSize: 23, fontWeight: '900', letterSpacing: -0.3 },
  companyName: { color: '#A9BACD', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  brandCopy: { gap: 15, marginVertical: 42 },
  brandEyebrow: { color: '#D96A78', fontSize: 10.5, fontWeight: '900', letterSpacing: 1.3 },
  brandTitle: { color: '#FFFFFF', fontSize: 35, fontWeight: '900', letterSpacing: -0.8, lineHeight: 42, maxWidth: 420 },
  brandText: { color: '#B8C6D5', fontSize: 15, fontWeight: '600', lineHeight: 23, maxWidth: 420 },
  capabilities: { gap: 21 },
  capability: { alignItems: 'center', flexDirection: 'row', gap: 13 },
  capabilityIcon: { alignItems: 'center', backgroundColor: '#8F2133', borderRadius: 13, height: 42, justifyContent: 'center', width: 42 },
  capabilityCopy: { flex: 1, gap: 3 },
  capabilityTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  capabilityText: { color: '#9FB0C2', fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  compactCaption: { color: '#AFC0D2', fontSize: 12.5, fontWeight: '700', marginLeft: 65, marginTop: -7 },
  brandRule: { backgroundColor: '#981B2E', bottom: 0, height: 5, left: 0, position: 'absolute', width: 108 },
  formPanel: { gap: 25, padding: 24 },
  formPanelWide: { flex: 0.94, justifyContent: 'center', paddingHorizontal: 58, paddingVertical: 52 },
  formTopbar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  internalLabel: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.1 },
  themeButton: { alignItems: 'center', borderRadius: 12, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  formHeader: { gap: 8 },
  title: { fontSize: 29, fontWeight: '900', letterSpacing: -0.5, lineHeight: 35 },
  description: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  form: { gap: 18 },
  eyeButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  submitButton: { minHeight: 54 },
  securityNote: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', gap: 11, paddingTop: 20 },
  securityIcon: { alignItems: 'center', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  securityCopy: { flex: 1, gap: 2 },
  securityTitle: { fontSize: 13, fontWeight: '900' },
  securityText: { fontSize: 11.5, fontWeight: '600', lineHeight: 16 },
  help: { fontSize: 11.5, fontWeight: '600', lineHeight: 17, textAlign: 'center' },
  footer: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 18 },
  footerText: { fontSize: 11.5, fontWeight: '700' },
  footerStatus: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  statusDot: { borderRadius: 4, height: 7, width: 7 },
  pressed: { opacity: 0.7 },
});
