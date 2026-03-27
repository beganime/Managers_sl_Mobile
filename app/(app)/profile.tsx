import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import apiClient, { logoutRequest } from '../../src/api/apiClient';
import { preloadAppData } from '../../src/bootstrap/preloadAppData';
import { useTheme } from '../../src/context/ThemeContext';

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
    .map((x) => x[0]?.toUpperCase())
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

export default function ProfileScreen() {
  const { theme, themeMode, setTheme } = useTheme();
  const { user, reload } = useCurrentUser();

  const isAdmin = useMemo(
    () => Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin'),
    [user]
  );

  const [syncing, setSyncing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [dob, setDob] = useState('');
  const [socialContacts, setSocialContacts] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  const [avatarAsset, setAvatarAsset] = useState<any>(null);

  useEffect(() => {
    setFirstName(user?.first_name || '');
    setLastName(user?.last_name || '');
    setMiddleName(user?.middle_name || '');
    setDob(user?.dob || '');
    setSocialContacts(user?.social_contacts || '');
    setJobDescription(user?.job_description || '');
  }, [user]);

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

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutRequest();
      router.replace('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Доступ нужен', 'Разреши доступ к галерее, чтобы выбрать аватар.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!asset) return;

    setAvatarAsset(asset);
  };

  const handleSaveProfile = async () => {
    setSaving(true);

    try {
      const textPayload: any = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        middle_name: middleName.trim(),
        social_contacts: socialContacts.trim(),
        job_description: jobDescription.trim(),
        dob: dob.trim() ? dob.trim() : null,
      };

      await apiClient.patch('users/users/me/', textPayload);

      if (avatarAsset?.uri) {
        const formData = new FormData();

        formData.append(
          'avatar',
          {
            uri: avatarAsset.uri,
            type: avatarAsset.mimeType || 'image/jpeg',
            name: avatarAsset.fileName || `avatar-${Date.now()}.jpg`,
          } as any
        );

        await apiClient.patch('users/users/me/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      await reload();
      setAvatarAsset(null);
      Alert.alert('Готово', 'Профиль обновлён.');
    } catch (error: any) {
      Alert.alert('Ошибка сервера', flattenError(error?.response?.data));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Pressable onPress={handlePickAvatar} style={styles.avatarWrap}>
            {avatarAsset?.uri || user?.avatar ? (
              <Image
                source={{ uri: avatarAsset?.uri || user?.avatar }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: theme.blue }]}>
                <Text style={styles.avatarFallbackText}>{initialsOf(user)}</Text>
              </View>
            )}

            <View style={[styles.cameraBadge, { backgroundColor: theme.blue }]}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </Pressable>

          <Text style={[styles.name, { color: theme.text }]}>{fullNameOf(user)}</Text>
          <Text style={[styles.email, { color: theme.textSecondary }]}>{user?.email}</Text>

          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: isAdmin ? theme.redSoft : theme.blueSoft }]}>
              <Text style={[styles.badgeText, { color: isAdmin ? theme.red : theme.blue }]}>
                {isAdmin ? 'Администратор' : 'Менеджер'}
              </Text>
            </View>

            {!!user?.office?.city && (
              <View style={[styles.badge, { backgroundColor: theme.backgroundSoft }]}>
                <Text style={[styles.badgeText, { color: theme.textSecondary }]}>
                  {user.office.city}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Редактирование профиля</Text>

          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Имя</Text>
            <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                style={[styles.input, { color: theme.text }]}
                placeholder="Имя"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Фамилия</Text>
            <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                style={[styles.input, { color: theme.text }]}
                placeholder="Фамилия"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Отчество</Text>
            <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
              <TextInput
                value={middleName}
                onChangeText={setMiddleName}
                style={[styles.input, { color: theme.text }]}
                placeholder="Отчество"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Дата рождения</Text>
            <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
              <TextInput
                value={dob}
                onChangeText={setDob}
                style={[styles.input, { color: theme.text }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Соц. контакты</Text>
            <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
              <TextInput
                value={socialContacts}
                onChangeText={setSocialContacts}
                style={[styles.input, { color: theme.text }]}
                placeholder="Telegram / WhatsApp / Instagram"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Описание должности</Text>
            <View
              style={[
                styles.inputWrap,
                { backgroundColor: theme.backgroundSoft, borderColor: theme.border, minHeight: 98 },
              ]}
            >
              <TextInput
                value={jobDescription}
                onChangeText={setJobDescription}
                style={[styles.input, { color: theme.text, minHeight: 72, textAlignVertical: 'top' }]}
                placeholder="Чем занимается сотрудник"
                placeholderTextColor={theme.textMuted}
                multiline
              />
            </View>
          </View>

          <Pressable onPress={handleSaveProfile} style={[styles.actionBtn, { backgroundColor: theme.blue }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Сохранить профиль</Text>}
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Тёмная тема</Text>
              <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                Переключение светлой и тёмной темы
              </Text>
            </View>
            <Switch
              value={themeMode === 'dark'}
              onValueChange={(value) => setTheme(value ? 'dark' : 'light')}
            />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Финансы</Text>
          <Text style={[styles.stat, { color: theme.textSecondary }]}>
            Оклад: ${Number(user?.managersalary?.fixed_salary || 0).toFixed(0)}
          </Text>
          <Text style={[styles.stat, { color: theme.textSecondary }]}>
            Текущий баланс: ${Number(user?.managersalary?.current_balance || 0).toFixed(0)}
          </Text>
          <Text style={[styles.stat, { color: theme.textSecondary }]}>
            План месяца: ${Number(user?.managersalary?.monthly_plan || 0).toFixed(0)}
          </Text>
          <Text style={[styles.stat, { color: theme.textSecondary }]}>
            Выручка: ${Number(user?.managersalary?.current_month_revenue || 0).toFixed(0)}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Быстрые разделы</Text>

          <Pressable onPress={() => router.push('/(app)/workday')} style={[styles.linkRow, { borderBottomColor: theme.divider }]}>
            <Text style={[styles.linkText, { color: theme.text }]}>Учет рабочего времени</Text>
            <Text style={[styles.linkHint, { color: theme.blue }]}>Открыть</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/(app)/tasks')} style={[styles.linkRow, { borderBottomColor: theme.divider }]}>
            <Text style={[styles.linkText, { color: theme.text }]}>Задачи</Text>
            <Text style={[styles.linkHint, { color: theme.blue }]}>Открыть</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/(app)/knowledge-base')} style={[styles.linkRow, { borderBottomColor: theme.divider }]}>
            <Text style={[styles.linkText, { color: theme.text }]}>База знаний</Text>
            <Text style={[styles.linkHint, { color: theme.blue }]}>Открыть</Text>
          </Pressable>

          {isAdmin && (
            <>
              <Pressable onPress={() => router.push('/(app)/admin-staff')} style={[styles.linkRow, { borderBottomColor: theme.divider }]}>
                <Text style={[styles.linkText, { color: theme.text }]}>Команда</Text>
                <Text style={[styles.linkHint, { color: theme.blue }]}>Открыть</Text>
              </Pressable>

              <Pressable onPress={() => router.push('/(app)/admin-payments')} style={[styles.linkRow, { borderBottomColor: theme.divider }]}>
                <Text style={[styles.linkText, { color: theme.text }]}>Платежи</Text>
                <Text style={[styles.linkHint, { color: theme.blue }]}>Открыть</Text>
              </Pressable>

              <Pressable onPress={() => router.push('/(app)/documents')} style={styles.linkRow}>
                <Text style={[styles.linkText, { color: theme.text }]}>Документы</Text>
                <Text style={[styles.linkHint, { color: theme.blue }]}>Открыть</Text>
              </Pressable>
            </>
          )}
        </View>

        <Pressable onPress={handleSync} style={[styles.actionBtn, { backgroundColor: theme.blue }]}>
          <Text style={styles.actionBtnText}>{syncing ? 'Синхронизация...' : 'Обновить локальный кэш'}</Text>
        </Pressable>

        <Pressable
          onPress={() =>
            Alert.alert('Выход', 'Подтвердить выход из аккаунта?', [
              { text: 'Отмена', style: 'cancel' },
              { text: 'Выйти', style: 'destructive', onPress: handleLogout },
            ])
          }
          style={[styles.logoutBtn, { backgroundColor: theme.redSoft }]}
        >
          <Text style={[styles.logoutText, { color: theme.red }]}>
            {loggingOut ? 'Выходим...' : 'Выйти из аккаунта'}
          </Text>
        </Pressable>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 120, gap: 14 },
  hero: { borderWidth: 1, borderRadius: 24, padding: 18, alignItems: 'center' },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatar: { width: 92, height: 92, borderRadius: 28 },
  avatarFallback: {
    width: 92,
    height: 92,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { color: '#fff', fontWeight: '900', fontSize: 28 },
  cameraBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 24, fontWeight: '900', textAlign: 'center' },
  email: { marginTop: 6, fontSize: 14, fontWeight: '600' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, justifyContent: 'center' },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { fontWeight: '900', fontSize: 12 },
  card: { borderWidth: 1, borderRadius: 22, padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  cardSub: { marginTop: 4, fontSize: 13, fontWeight: '600' },
  fieldBlock: { marginTop: 14 },
  label: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inputWrap: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  input: { fontSize: 15, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stat: { marginTop: 8, fontSize: 14, fontWeight: '600' },
  linkRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: { fontSize: 15, fontWeight: '800' },
  linkHint: { fontSize: 13, fontWeight: '900' },
  actionBtn: { borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  actionBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  logoutBtn: { borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  logoutText: { fontWeight: '900', fontSize: 15 },
});