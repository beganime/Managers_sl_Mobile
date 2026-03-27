import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import ScreenWrapper from '../../components/ScreenWrapper';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import apiClient from '../../src/api/apiClient';
import { preloadAppData } from '../../src/bootstrap/preloadAppData';
import { useTheme } from '../../src/context/ThemeContext';
import { clearSession } from '../../src/utils/storage';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fullNameOf(user: any) {
  return (
    user?.full_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.email ||
    'Пользователь'
  );
}

function initialsOf(user: any) {
  const full = fullNameOf(user);
  return full
    .split(' ')
    .slice(0, 2)
    .map((x: string) => x[0]?.toUpperCase())
    .join('');
}

function flattenError(data: any): string {
  if (!data) return 'Не удалось обновить профиль.';
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return data.map(String).join('\n');
  if (typeof data === 'object') {
    return Object.entries(data)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
      .join('\n');
  }
  return 'Не удалось обновить профиль.';
}

// ─── quick nav items ───────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Учет времени',   route: '/(app)/workday',         icon: 'time-outline',            color: '#3B82F6' },
  { label: 'Задачи',         route: '/(app)/tasks',            icon: 'checkmark-circle-outline', color: '#10B981' },
  { label: 'База знаний',    route: '/(app)/knowledge-base',   icon: 'library-outline',          color: '#8B5CF6' },
  { label: 'CRM',            route: '/(app)/crm',              icon: 'people-outline',            color: '#F59E0B' },
  { label: 'Каталог вузов',  route: '/(app)/catalog',          icon: 'school-outline',            color: '#06B6D4' },
  { label: 'Команда',        route: '/(app)/admin-staff',      icon: 'business-outline',          color: '#EF4444', adminOnly: true },
  { label: 'Платежи',        route: '/(app)/admin-payments',   icon: 'card-outline',              color: '#F97316', adminOnly: true },
  { label: 'Документы',      route: '/(app)/documents',        icon: 'document-text-outline',     color: '#6366F1', adminOnly: true },
  { label: 'Отчёты',         route: '/(app)/admin-reports',    icon: 'bar-chart-outline',         color: '#14B8A6', adminOnly: true },
];

// ─── sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ label, theme }: { label: string; theme: any }) {
  return (
    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{label}</Text>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  keyboardType = 'default' as any,
  secure = false,
  theme,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: any;
  secure?: boolean;
  theme: any;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <View
        style={[
          styles.fieldInput,
          {
            backgroundColor: theme.backgroundSoft,
            borderColor: theme.border,
            minHeight: multiline ? 96 : 52,
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder || label}
          placeholderTextColor={theme.textMuted}
          multiline={multiline}
          keyboardType={keyboardType}
          secureTextEntry={secure}
          style={[
            styles.fieldText,
            {
              color: theme.text,
              minHeight: multiline ? 72 : 24,
              textAlignVertical: multiline ? 'top' : 'center',
            },
          ]}
        />
      </View>
    </View>
  );
}

function StatRow({
  icon,
  label,
  value,
  color,
  theme,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  theme: any;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.statRow,
        !last && { borderBottomWidth: 1, borderBottomColor: theme.divider },
      ]}
    >
      <View style={[styles.statIconWrap, { backgroundColor: color + '1A' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

// ─── main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { theme, themeMode, setTheme } = useTheme();
  const { user, reload } = useCurrentUser();

  const isAdmin = useMemo(
    () => Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin'),
    [user],
  );

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  // ── form state ──
  const [firstName, setFirstName]           = useState('');
  const [lastName, setLastName]             = useState('');
  const [middleName, setMiddleName]         = useState('');
  const [dob, setDob]                       = useState('');
  const [socialContacts, setSocialContacts] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [avatarAsset, setAvatarAsset]       = useState<any>(null);

  const [saving, setSaving]       = useState(false);
  const [syncing, setSyncing]     = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.first_name || '');
    setLastName(user.last_name || '');
    setMiddleName((user as any).middle_name || '');
    setDob(user.dob || '');
    setSocialContacts((user as any).social_contacts || '');
    setJobDescription((user as any).job_description || '');
  }, [user]);

  // ── avatar picker ──
  const handlePickAvatar = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert('Нет доступа', 'Разреши доступ к галерее.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      setAvatarAsset(result.assets[0]);
    }
  };

  // ── save profile ──
  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Save text fields
      await apiClient.patch('users/users/me/', {
        first_name:      firstName.trim(),
        last_name:       lastName.trim(),
        middle_name:     middleName.trim(),
        social_contacts: socialContacts.trim(),
        job_description: jobDescription.trim(),
        dob:             dob.trim() || null,
      });

      // 2. Upload avatar separately with multipart
      if (avatarAsset?.uri) {
        const fd = new FormData();
        fd.append('avatar', {
          uri:  avatarAsset.uri,
          type: avatarAsset.mimeType || 'image/jpeg',
          name: avatarAsset.fileName || `avatar_${Date.now()}.jpg`,
        } as any);

        await apiClient.patch('users/users/me/', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      await reload();
      setAvatarAsset(null);
      Alert.alert('Готово', 'Профиль успешно обновлён.');
    } catch (err: any) {
      Alert.alert('Ошибка', flattenError(err?.response?.data));
    } finally {
      setSaving(false);
    }
  };

  // ── sync cache ──
  const handleSync = async () => {
    setSyncing(true);
    try {
      await preloadAppData();
      await reload();
      Alert.alert('Готово', 'Кэш приложения обновлён.');
    } catch {
      Alert.alert('Ошибка', 'Не удалось обновить кэш.');
    } finally {
      setSyncing(false);
    }
  };

  // ── logout — clears tokens, navigates to login ──
  const handleLogout = async () => {
    Alert.alert('Выход', 'Подтвердить выход из аккаунта?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            // Best-effort server logout
            try {
              const { getToken } = await import('../../src/utils/storage');
              const refresh = await getToken('refresh_token');
              if (refresh) {
                await apiClient.post('auth/logout/', { refresh });
              }
            } catch {}
            // Always clear local session
            await clearSession();
          } finally {
            setLoggingOut(false);
            router.replace('/login');
          }
        },
      },
    ]);
  };

  // ── nav items filtered by role ──
  const navItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin],
  );

  const avatarUri = avatarAsset?.uri || (user as any)?.avatar || null;

  // ── salary helpers ──
  const sal = user?.managersalary;
  const fixed   = Number(sal?.fixed_salary || 0);
  const balance = Number(sal?.current_balance || 0);
  const plan    = Number(sal?.monthly_plan || 0);
  const revenue = Number(sal?.current_month_revenue || 0);
  const progress = plan > 0 ? Math.min(Math.round((revenue / plan) * 100), 100) : 0;

  return (
    <ScreenWrapper>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── HERO ─────────────────────────────────────────────────────── */}
          <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {/* Avatar */}
            <Pressable onPress={handlePickAvatar} style={styles.avatarOuter}>
              <View style={[styles.avatarRing, { borderColor: theme.blue + '40' }]}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatarImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: theme.blue }]}>
                    <Text style={styles.avatarInitials}>{initialsOf(user)}</Text>
                  </View>
                )}
              </View>
              <View style={[styles.cameraBtn, { backgroundColor: theme.blue }]}>
                <Ionicons name="camera" size={13} color="#fff" />
              </View>
            </Pressable>

            {avatarAsset && (
              <View style={[styles.avatarHint, { backgroundColor: theme.blueSoft }]}>
                <Ionicons name="checkmark-circle" size={14} color={theme.blue} />
                <Text style={[styles.avatarHintText, { color: theme.blue }]}>
                  Новое фото выбрано — сохраните профиль
                </Text>
              </View>
            )}

            {/* Name & meta */}
            <Text style={[styles.heroName, { color: theme.text }]}>{fullNameOf(user)}</Text>
            <Text style={[styles.heroEmail, { color: theme.textSecondary }]}>{user?.email}</Text>

            {/* Badges */}
            <View style={styles.heroBadges}>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: isAdmin ? theme.redSoft : theme.blueSoft },
                ]}
              >
                <Ionicons
                  name={isAdmin ? 'shield-checkmark' : 'person'}
                  size={12}
                  color={isAdmin ? theme.red : theme.blue}
                />
                <Text style={[styles.badgeText, { color: isAdmin ? theme.red : theme.blue }]}>
                  {isAdmin ? 'Администратор' : 'Менеджер'}
                </Text>
              </View>

              {user?.office?.city ? (
                <View style={[styles.badge, { backgroundColor: theme.backgroundSoft }]}>
                  <Ionicons name="location-outline" size={12} color={theme.textSecondary} />
                  <Text style={[styles.badgeText, { color: theme.textSecondary }]}>
                    {user.office.city}
                  </Text>
                </View>
              ) : null}

              {(user as any)?.work_status ? (
                <View style={[styles.badge, { backgroundColor: theme.backgroundSoft }]}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          (user as any).work_status === 'working' ? theme.success : theme.warning,
                      },
                    ]}
                  />
                  <Text style={[styles.badgeText, { color: theme.textSecondary }]}>
                    {(user as any).work_status === 'working'
                      ? 'Работаю'
                      : (user as any).work_status === 'vacation'
                      ? 'Отпуск'
                      : 'Больничный'}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ── ФИНАНСЫ ──────────────────────────────────────────────────── */}
          <SectionTitle label="Финансы и план" theme={theme} />
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {/* Progress bar */}
            <View style={styles.planRow}>
              <Text style={[styles.planLabel, { color: theme.text }]}>Выполнение плана</Text>
              <Text style={[styles.planPercent, { color: theme.blue }]}>{progress}%</Text>
            </View>
            <View style={[styles.progressBg, { backgroundColor: theme.backgroundSoft }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress}%` as any,
                    backgroundColor: progress >= 100 ? theme.success : theme.blue,
                  },
                ]}
              />
            </View>
            <Text style={[styles.planSub, { color: theme.textSecondary }]}>
              ${revenue.toLocaleString('ru-RU')} из ${plan.toLocaleString('ru-RU')}
            </Text>

            <View style={[styles.divider, { backgroundColor: theme.divider }]} />

            <StatRow
              icon="cash-outline"
              label="Фиксированный оклад"
              value={`$${fixed.toLocaleString('ru-RU')}`}
              color="#10B981"
              theme={theme}
            />
            <StatRow
              icon="gift-outline"
              label="Бонусный баланс"
              value={`$${balance.toLocaleString('ru-RU')}`}
              color="#F59E0B"
              theme={theme}
            />
            <StatRow
              icon="trending-up-outline"
              label="Выручка за месяц"
              value={`$${revenue.toLocaleString('ru-RU')}`}
              color="#3B82F6"
              theme={theme}
            />
            <StatRow
              icon="trophy-outline"
              label="План месяца"
              value={`$${plan.toLocaleString('ru-RU')}`}
              color="#8B5CF6"
              theme={theme}
              last
            />
          </View>

          {/* ── БЫСТРАЯ НАВИГАЦИЯ ─────────────────────────────────────────── */}
          <SectionTitle label="Быстрая навигация" theme={theme} />
          <View style={[styles.navGrid, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {navItems.map((item, index) => {
              const isLast = index === navItems.length - 1;
              const isLastRow = navItems.length % 2 !== 0 && index === navItems.length - 1;
              return (
                <Pressable
                  key={item.route}
                  onPress={() => router.push(item.route as any)}
                  style={({ pressed }) => [
                    styles.navItem,
                    {
                      borderBottomColor: theme.divider,
                      borderRightColor: theme.divider,
                      borderBottomWidth: isLast || (navItems.length % 2 === 0 && index >= navItems.length - 2) ? 0 : 1,
                      borderRightWidth: index % 2 === 0 && !isLastRow ? 1 : 0,
                      opacity: pressed ? 0.7 : 1,
                      width: isLastRow ? '100%' : '50%',
                    },
                  ]}
                >
                  <View style={[styles.navIconWrap, { backgroundColor: item.color + '18' }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <Text style={[styles.navLabel, { color: theme.text }]}>{item.label}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={theme.textMuted}
                    style={{ marginTop: 2 }}
                  />
                </Pressable>
              );
            })}
          </View>

          {/* ── РЕДАКТИРОВАНИЕ ───────────────────────────────────────────── */}
          <SectionTitle label="Редактирование профиля" theme={theme} />
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Field label="Имя"        value={firstName}      onChange={setFirstName}      theme={theme} />
            <Field label="Фамилия"    value={lastName}       onChange={setLastName}       theme={theme} />
            <Field label="Отчество"   value={middleName}     onChange={setMiddleName}     theme={theme} />
            <Field
              label="Дата рождения"
              value={dob}
              onChange={setDob}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              theme={theme}
            />
            <Field
              label="Контакты (Telegram / WhatsApp)"
              value={socialContacts}
              onChange={setSocialContacts}
              placeholder="@username или номер"
              theme={theme}
            />
            <Field
              label="Описание должности"
              value={jobDescription}
              onChange={setJobDescription}
              placeholder="Чем занимаетесь"
              multiline
              theme={theme}
            />

            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveBtn, { backgroundColor: theme.blue, opacity: saving ? 0.7 : 1 }]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Сохранить изменения</Text>
                </>
              )}
            </Pressable>
          </View>

          {/* ── НАСТРОЙКИ ────────────────────────────────────────────────── */}
          <SectionTitle label="Настройки" theme={theme} />
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.settingRow}>
              <View style={[styles.settingIconWrap, { backgroundColor: '#6366F11A' }]}>
                <Ionicons name="moon-outline" size={18} color="#6366F1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Тёмная тема</Text>
                <Text style={[styles.settingSub, { color: theme.textSecondary }]}>
                  Переключение между светлой и тёмной темой
                </Text>
              </View>
              <Switch
                value={themeMode === 'dark'}
                onValueChange={(v) => setTheme(v ? 'dark' : 'light')}
                trackColor={{ false: theme.border, true: theme.blue }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* ── СИСТЕМНЫЕ КНОПКИ ─────────────────────────────────────────── */}
          <SectionTitle label="Система" theme={theme} />
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable
              onPress={handleSync}
              style={[styles.sysRow, { borderBottomWidth: 1, borderBottomColor: theme.divider }]}
            >
              <View style={[styles.settingIconWrap, { backgroundColor: '#3B82F61A' }]}>
                {syncing ? (
                  <ActivityIndicator size="small" color="#3B82F6" />
                ) : (
                  <Ionicons name="sync-outline" size={18} color="#3B82F6" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Обновить кэш</Text>
                <Text style={[styles.settingSub, { color: theme.textSecondary }]}>
                  Загрузить актуальные данные с сервера
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>

            <Pressable onPress={handleLogout} style={styles.sysRow}>
              <View style={[styles.settingIconWrap, { backgroundColor: theme.redSoft }]}>
                {loggingOut ? (
                  <ActivityIndicator size="small" color={theme.red} />
                ) : (
                  <Ionicons name="log-out-outline" size={18} color={theme.red} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: theme.red }]}>Выйти из аккаунта</Text>
                <Text style={[styles.settingSub, { color: theme.textSecondary }]}>
                  Токен будет удалён с устройства
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </ScreenWrapper>
  );
}

// ─── styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 120,
    gap: 0,
  },

  // Hero
  hero: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarOuter: { position: 'relative', marginBottom: 14 },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 28,
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { color: '#fff', fontSize: 30, fontWeight: '900' },
  cameraBtn: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  avatarHintText: { fontSize: 12, fontWeight: '700' },
  heroName: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  heroEmail: { marginTop: 4, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: '800' },
  statusDot: { width: 7, height: 7, borderRadius: 999 },

  // Section title
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 4,
  },

  // Card
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },

  // Finance stats
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  planLabel: { fontSize: 15, fontWeight: '800' },
  planPercent: { fontSize: 15, fontWeight: '900' },
  progressBg: { height: 8, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 999 },
  planSub: { marginTop: 6, fontSize: 12, fontWeight: '600' },
  divider: { height: 1, marginVertical: 14 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: { flex: 1, fontSize: 14, fontWeight: '700' },
  statValue: { fontSize: 14, fontWeight: '900' },

  // Nav grid
  navGrid: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
  },
  navIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: { flex: 1, fontSize: 13, fontWeight: '800' },

  // Form fields
  fieldWrap: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldText: { fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
    paddingVertical: 16,
    marginTop: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },

  // Settings
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: { fontSize: 15, fontWeight: '800' },
  settingSub: { marginTop: 2, fontSize: 12, fontWeight: '600' },

  // Sys rows
  sysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
});