import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import {
  logoutRequest,
  removeMyAvatar,
  updateMyProfile,
  uploadMyAvatar,
} from '../../src/api/apiClient';
import { preloadAppData } from '../../src/bootstrap/preloadAppData';
import { useTheme } from '../../src/context/ThemeContext';

function fullNameOf(user: any) {
  return (
    user?.full_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ||
    user?.email ||
    'Профиль'
  );
}

function initialsOf(user: any) {
  const full = fullNameOf(user);
  const parts = String(full).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function flattenError(payload: any): string {
  if (!payload) return 'Неизвестная ошибка';

  if (typeof payload === 'string') return payload;
  if (Array.isArray(payload)) return payload.map(flattenError).join('\n');

  if (typeof payload === 'object') {
    if (typeof payload.detail === 'string') return payload.detail;

    const chunks: string[] = [];
    Object.entries(payload).forEach(([key, value]) => {
      const text = flattenError(value);
      if (text) chunks.push(`${key}: ${text}`);
    });

    return chunks.join('\n') || 'Ошибка запроса';
  }

  return 'Ошибка запроса';
}

function filenameFromAsset(asset: ImagePicker.ImagePickerAsset) {
  const direct = asset.fileName?.trim();
  if (direct) return direct;

  const raw = asset.uri.split('/').pop() || 'avatar.jpg';
  return raw.includes('.') ? raw : `${raw}.jpg`;
}

function mimeFromAsset(asset: ImagePicker.ImagePickerAsset) {
  if (asset.mimeType) return asset.mimeType;

  const lower = asset.uri.toLowerCase();

  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}

function StatCard({
  title,
  value,
  hint,
  theme,
  accent = false,
}: {
  title: string;
  value: string;
  hint?: string;
  theme: any;
  accent?: boolean;
}) {
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: accent ? theme.blueSoft : theme.surface,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <Text style={[styles.statTitle, { color: theme.textSecondary }]}>{title}</Text>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      {!!hint && <Text style={[styles.statHint, { color: theme.textMuted }]}>{hint}</Text>}
    </View>
  );
}

function ProfileField({
  label,
  value,
  onChangeText,
  placeholder,
  theme,
  multiline = false,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  theme: any;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
}) {
  return (
    <View
      style={[
        styles.fieldWrap,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        style={[
          styles.fieldInput,
          {
            color: theme.text,
            minHeight: multiline ? 96 : 24,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function QuickLinkCard({
  title,
  subtitle,
  icon,
  onPress,
  theme,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  theme: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.quickCard,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <View style={[styles.quickIconWrap, { backgroundColor: theme.blueSoft }]}>
        <Ionicons name={icon} size={18} color={theme.blue} />
      </View>

      <Text style={[styles.quickTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.quickSub, { color: theme.textSecondary }]}>{subtitle}</Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { theme, themeMode, setTheme } = useTheme();
  const { user, reload } = useCurrentUser();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [dob, setDob] = useState('');
  const [socialContacts, setSocialContacts] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  const [avatarAsset, setAvatarAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [removeAvatarPending, setRemoveAvatarPending] = useState(false);

  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isAdmin = useMemo(
    () => Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin'),
    [user]
  );

  useEffect(() => {
    setFirstName(user?.first_name || '');
    setLastName(user?.last_name || '');
    setMiddleName((user as any)?.middle_name || '');
    setDob(user?.dob || '');
    setSocialContacts((user as any)?.social_contacts || '');
    setJobDescription((user as any)?.job_description || '');
  }, [user]);

  const sal = user?.managersalary;
  const fixed = Number(sal?.fixed_salary || 0);
  const balance = Number(sal?.current_balance || 0);
  const plan = Number(sal?.monthly_plan || 0);
  const revenue = Number(sal?.current_month_revenue || 0);
  const progress = plan > 0 ? Math.min(Math.round((revenue / plan) * 100), 100) : 0;

  const avatarUri =
    avatarAsset?.uri ||
    (removeAvatarPending ? null : (user as any)?.avatar_url || (user as any)?.avatar || null);

  const managedOffice = (user as any)?.access_profile?.managed_office;
  const canViewOfficeDashboard = Boolean((user as any)?.access_profile?.can_view_office_dashboard);

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Нет доступа', 'Разреши приложению доступ к галерее.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      selectionLimit: 1,
    });

    if (result.canceled || !result.assets?.length) return;

    setAvatarAsset(result.assets[0]);
    setRemoveAvatarPending(false);
  };

  const handleRemoveAvatar = async () => {
    if (!avatarUri) return;

    Alert.alert('Удалить фото?', 'Аватар будет убран из профиля.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          setAvatarAsset(null);
          setRemoveAvatarPending(true);
        },
      },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      await updateMyProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        middle_name: middleName.trim(),
        social_contacts: socialContacts.trim(),
        job_description: jobDescription.trim(),
        dob: dob.trim() || null,
      });

      if (removeAvatarPending) {
        await removeMyAvatar();
      }

      if (avatarAsset?.uri) {
        await uploadMyAvatar({
          uri: avatarAsset.uri,
          name: filenameFromAsset(avatarAsset),
          type: mimeFromAsset(avatarAsset),
        });
      }

      await reload({ preferCache: true, silent: true });
      setAvatarAsset(null);
      setRemoveAvatarPending(false);

      Alert.alert('Готово', 'Профиль успешно обновлён.');
    } catch (err: any) {
      Alert.alert('Ошибка', flattenError(err?.response?.data || err?.message));
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);

    try {
      await preloadAppData();
      await reload({ preferCache: true, silent: true });
      Alert.alert('Готово', 'Кэш приложения обновлён.');
    } catch {
      Alert.alert('Ошибка', 'Не удалось обновить кэш.');
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Выход', 'Подтвердить выход из аккаунта?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logoutRequest();
          } finally {
            setLoggingOut(false);
            router.replace('/login');
          }
        },
      },
    ]);
  };

  if (!user) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.blue} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.hero,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <Pressable onPress={handlePickAvatar} style={styles.avatarOuter}>
            <View style={[styles.avatarRing, { borderColor: `${theme.blue}26` }]}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: theme.blue }]}>
                  <Text style={styles.avatarInitials}>{initialsOf(user)}</Text>
                </View>
              )}
            </View>

            <View style={[styles.cameraBtn, { backgroundColor: theme.blue }]}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </Pressable>

          <Text style={[styles.heroName, { color: theme.text }]}>{fullNameOf(user)}</Text>
          <Text style={[styles.heroEmail, { color: theme.textSecondary }]}>{user.email}</Text>

          <View style={styles.roleRow}>
            <View
              style={[
                styles.roleBadge,
                {
                  backgroundColor: theme.backgroundSoft,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons
                name={isAdmin ? 'shield-checkmark-outline' : 'person-outline'}
                size={14}
                color={theme.blue}
              />
              <Text style={[styles.roleBadgeText, { color: theme.text }]}>
                {isAdmin ? 'Администратор' : 'Менеджер'}
              </Text>
            </View>

            {!!user?.office?.city && (
              <View
                style={[
                  styles.roleBadge,
                  {
                    backgroundColor: theme.backgroundSoft,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons name="business-outline" size={14} color={theme.blue} />
                <Text style={[styles.roleBadgeText, { color: theme.text }]}>
                  {user.office.city}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.avatarActions}>
            <Pressable
              onPress={handlePickAvatar}
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: theme.backgroundSoft,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons name="image-outline" size={16} color={theme.blue} />
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Выбрать фото</Text>
            </Pressable>

            <Pressable
              onPress={handleRemoveAvatar}
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: theme.backgroundSoft,
                  borderColor: theme.border,
                  opacity: avatarUri ? 1 : 0.55,
                },
              ]}
              disabled={!avatarUri}
            >
              <Ionicons name="trash-outline" size={16} color={theme.red} />
              <Text style={[styles.secondaryBtnText, { color: theme.red }]}>Убрать</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            title="Баланс"
            value={`$${balance.toLocaleString('ru-RU')}`}
            hint="Текущий баланс"
            theme={theme}
            accent
          />
          <StatCard
            title="Фикс"
            value={`$${fixed.toLocaleString('ru-RU')}`}
            hint="Фиксированная часть"
            theme={theme}
          />
          <StatCard
            title="План"
            value={`$${plan.toLocaleString('ru-RU')}`}
            hint="План на месяц"
            theme={theme}
          />
          <StatCard
            title="Выручка"
            value={`$${revenue.toLocaleString('ru-RU')}`}
            hint={`Выполнение ${progress}%`}
            theme={theme}
          />
        </View>

        <View
          style={[
            styles.quickSection,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Быстрые переходы</Text>
          <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
            Важные страницы прямо из профиля
          </Text>

          <View style={styles.quickGrid}>
            <QuickLinkCard
              title="База знаний"
              subtitle="Материалы и подсказки"
              icon="library-outline"
              onPress={() => router.push('/(app)/knowledge-base' as any)}
              theme={theme}
            />
            <QuickLinkCard
              title="Заявки"
              subtitle="Лиды, фильтры и ответственные"
              icon="file-tray-full-outline"
              onPress={() => router.push('/(app)/leads' as any)}
              theme={theme}
            />
            <QuickLinkCard
              title="Документы"
              subtitle="Шаблоны и генерация"
              icon="document-text-outline"
              onPress={() => router.push('/(app)/documents' as any)}
              theme={theme}
            />
            <QuickLinkCard
              title="Задачи"
              subtitle="Мои задачи и статусы"
              icon="checkbox-outline"
              onPress={() => router.push('/(app)/tasks' as any)}
              theme={theme}
            />
            <QuickLinkCard
              title="Workday"
              subtitle="Приход и уход"
              icon="time-outline"
              onPress={() => router.push('/(app)/workday' as any)}
              theme={theme}
            />
            <QuickLinkCard
              title="Финансы"
              subtitle="Платежи, доходы и расходы"
              icon="wallet-outline"
              onPress={() => router.push('/(app)/admin-payments' as any)}
              theme={theme}
            />
            <QuickLinkCard
              title="Вузы"
              subtitle="Каталог университетов"
              icon="school-outline"
              onPress={() => router.push('/(app)/catalog' as any)}
              theme={theme}
            />

            {isAdmin && (
              <>
                <QuickLinkCard
                  title="Сотрудники"
                  subtitle="Доступы и офисы"
                  icon="people-outline"
                  onPress={() => router.push('/(app)/admin-staff' as any)}
                  theme={theme}
                />
                <QuickLinkCard
                  title="Отчёты"
                  subtitle="AI summary и daily"
                  icon="stats-chart-outline"
                  onPress={() => router.push('/(app)/admin-reports' as any)}
                  theme={theme}
                />
              </>
            )}
          </View>
        </View>

        {(managedOffice || canViewOfficeDashboard) && (
          <View
            style={[
              styles.officeCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: theme.blueSoft }]}>
                <Ionicons name="analytics-outline" size={18} color={theme.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Офисный доступ</Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                  Спец-доступ менеджера
                </Text>
              </View>
            </View>

            <Text style={[styles.officeLine, { color: theme.textSecondary }]}>
              Видеть баланс офиса: {canViewOfficeDashboard ? 'Да' : 'Нет'}
            </Text>

            {!!managedOffice?.city && (
              <Text style={[styles.officeLine, { color: theme.textSecondary }]}>
                Назначенный офис: {managedOffice.city}
              </Text>
            )}

            {!!managedOffice?.address && (
              <Text style={[styles.officeLine, { color: theme.textSecondary }]}>
                Адрес: {managedOffice.address}
              </Text>
            )}
          </View>
        )}

        <ProfileField
          label="Имя"
          value={firstName}
          onChangeText={setFirstName}
          placeholder="Введите имя"
          theme={theme}
        />

        <ProfileField
          label="Фамилия"
          value={lastName}
          onChangeText={setLastName}
          placeholder="Введите фамилию"
          theme={theme}
        />

        <ProfileField
          label="Отчество"
          value={middleName}
          onChangeText={setMiddleName}
          placeholder="Введите отчество"
          theme={theme}
        />

        <ProfileField
          label="Дата рождения"
          value={dob}
          onChangeText={setDob}
          placeholder="YYYY-MM-DD"
          theme={theme}
        />

        <ProfileField
          label="Контакты"
          value={socialContacts}
          onChangeText={setSocialContacts}
          placeholder="@telegram / телефон / instagram"
          theme={theme}
          multiline
        />

        <ProfileField
          label="Описание / должность"
          value={jobDescription}
          onChangeText={setJobDescription}
          placeholder="Чем занимается сотрудник"
          theme={theme}
          multiline
        />

        <View
          style={[
            styles.themeCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Тёмная тема</Text>
            <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
              Переключение внешнего вида приложения
            </Text>
          </View>

          <Switch
            value={themeMode === 'dark'}
            onValueChange={(value) => setTheme(value ? 'dark' : 'light')}
          />
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[
            styles.primaryBtn,
            {
              backgroundColor: theme.blue,
              opacity: saving ? 0.7 : 1,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Сохранить профиль</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={handleSync}
          disabled={syncing}
          style={[
            styles.secondaryLargeBtn,
            {
              backgroundColor: theme.backgroundSoft,
              borderColor: theme.border,
              opacity: syncing ? 0.7 : 1,
            },
          ]}
        >
          {syncing ? (
            <ActivityIndicator color={theme.blue} />
          ) : (
            <>
              <Ionicons name="sync-outline" size={18} color={theme.blue} />
              <Text style={[styles.secondaryLargeBtnText, { color: theme.text }]}>
                Обновить кэш
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={handleLogout}
          disabled={loggingOut}
          style={[
            styles.secondaryLargeBtn,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: loggingOut ? 0.7 : 1,
            },
          ]}
        >
          {loggingOut ? (
            <ActivityIndicator color={theme.red} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color={theme.red} />
              <Text style={[styles.secondaryLargeBtnText, { color: theme.red }]}>Выйти</Text>
            </>
          )}
        </Pressable>

        <View style={{ height: 28 }} />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 100,
    gap: 14,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  avatarOuter: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 999,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 102,
    height: 102,
    borderRadius: 999,
  },
  avatarFallback: {
    width: 102,
    height: 102,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
  },
  cameraBtn: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  heroEmail: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  roleRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  roleBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  avatarActions: {
    width: '100%',
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  statsGrid: {
    gap: 12,
  },
  statCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  statTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  statHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  quickSection: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  quickCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  quickIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  quickSub: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  officeCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  sectionSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
  },
  officeLine: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    marginTop: 4,
  },
  fieldWrap: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  fieldInput: {
    fontSize: 15,
    fontWeight: '700',
  },
  themeCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  primaryBtn: {
    borderRadius: 22,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryLargeBtn: {
    borderWidth: 1,
    borderRadius: 22,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  secondaryLargeBtnText: {
    fontSize: 15,
    fontWeight: '900',
  },
});