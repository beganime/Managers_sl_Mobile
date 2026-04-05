import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import ScreenWrapper from '../../components/ScreenWrapper';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import apiClient, { fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

type StaffRole = 'manager' | 'admin';

type OfficeItem = {
  id: number;
  city?: string;
  address?: string;
  phone?: string;
  employee_count?: number;
  monthly_revenue?: number | string;
  target_profile?: {
    id?: number;
    monthly_plan_usd?: number | string;
    comment?: string;
  } | null;
};

type StaffItem = {
  id?: number;
  email: string;
  first_name: string;
  last_name: string;
  role: StaffRole;
  is_staff?: boolean;
  is_superuser?: boolean;
  work_status?: string;
  office?: {
    id?: number;
    city?: string;
    address?: string;
  } | null;
  managersalary?: {
    monthly_plan?: number | string;
    current_month_revenue?: number | string;
    current_balance?: number | string;
    fixed_salary?: number | string;
    commission_percent?: number | string;
    motivation_target?: number | string;
    motivation_reward?: number | string;
  } | null;
  access_profile?: {
    id?: number;
    can_view_office_dashboard?: boolean;
    can_be_in_leaderboard?: boolean;
    managed_office?: {
      id?: number;
      city?: string;
      address?: string;
    } | null;
  } | null;
};

type StaffFormState = {
  id?: number;
  email: string;
  first_name: string;
  last_name: string;
  role: StaffRole;
  password: string;
  office_id: number | null;

  fixed_salary: string;
  monthly_plan: string;
  commission_percent: string;
  motivation_target: string;
  motivation_reward: string;

  can_view_office_dashboard: boolean;
  can_be_in_leaderboard: boolean;
  managed_office_id: number | null;
  office_monthly_plan_usd: string;
  office_plan_comment: string;
};

const EMPTY_FORM: StaffFormState = {
  email: '',
  first_name: '',
  last_name: '',
  role: 'manager',
  password: '',
  office_id: null,

  fixed_salary: '',
  monthly_plan: '',
  commission_percent: '',
  motivation_target: '',
  motivation_reward: '',

  can_view_office_dashboard: false,
  can_be_in_leaderboard: true,
  managed_office_id: null,
  office_monthly_plan_usd: '',
  office_plan_comment: '',
};

function money(value?: number | string | null) {
  const amount = Number(value || 0);
  return `$${amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`;
}

function stringifyNumber(value?: number | string | null) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function safeRole(item: StaffItem): StaffRole {
  return (item.role as StaffRole) || (item.is_superuser ? 'admin' : 'manager');
}

function extractError(error: any) {
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.email?.[0] ||
    error?.response?.data?.password?.[0] ||
    error?.response?.data?.office_id?.[0] ||
    error?.response?.data?.managed_office_id?.[0] ||
    error?.response?.data?.monthly_plan_usd?.[0] ||
    'Не удалось сохранить данные.'
  );
}

export default function AdminStaffScreen() {
  const { theme } = useTheme();
  const { user } = useCurrentUser();

  const isAdmin = !!user && (user.is_superuser || user.is_staff || user.role === 'admin');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [offices, setOffices] = useState<OfficeItem[]>([]);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<StaffFormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      const [staffData, officesData] = await Promise.all([
        fetchAllPages('users/users/'),
        fetchAllPages('users/offices/'),
      ]);

      setStaff((staffData as StaffItem[]) || []);
      setOffices(
        ((officesData as OfficeItem[]) || []).sort((a, b) =>
          String(a.city || '').localeCompare(String(b.city || ''), 'ru')
        )
      );
    } catch (error: any) {
      Alert.alert(
        'Ошибка',
        error?.response?.data?.detail || 'Не удалось загрузить сотрудников и офисы.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void load();
    } else {
      setLoading(false);
    }
  }, [isAdmin, load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return staff.filter((item) => {
      if (!query) return true;

      return [
        item.email,
        item.first_name,
        item.last_name,
        item.office?.city,
        item.office?.address,
        item.access_profile?.managed_office?.city,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [search, staff]);

  const openCreate = () => {
    const defaultOffice = offices[0] || null;

    setForm({
      ...EMPTY_FORM,
      office_id: defaultOffice?.id ?? null,
      managed_office_id: defaultOffice?.id ?? null,
      office_monthly_plan_usd: stringifyNumber(defaultOffice?.target_profile?.monthly_plan_usd),
      office_plan_comment: defaultOffice?.target_profile?.comment || '',
    });
    setModalOpen(true);
  };

  const openEdit = (item: StaffItem) => {
    const managedOfficeId = item.access_profile?.managed_office?.id ?? item.office?.id ?? null;
    const managedOffice = offices.find((o) => o.id === managedOfficeId);

    setForm({
      id: item.id,
      email: item.email || '',
      first_name: item.first_name || '',
      last_name: item.last_name || '',
      role: safeRole(item),
      password: '',
      office_id: item.office?.id ?? null,

      fixed_salary: stringifyNumber(item.managersalary?.fixed_salary),
      monthly_plan: stringifyNumber(item.managersalary?.monthly_plan),
      commission_percent: stringifyNumber(item.managersalary?.commission_percent),
      motivation_target: stringifyNumber(item.managersalary?.motivation_target),
      motivation_reward: stringifyNumber(item.managersalary?.motivation_reward),

      can_view_office_dashboard: !!item.access_profile?.can_view_office_dashboard,
      can_be_in_leaderboard:
        item.access_profile?.can_be_in_leaderboard !== false,
      managed_office_id: managedOfficeId,
      office_monthly_plan_usd: stringifyNumber(
        managedOffice?.target_profile?.monthly_plan_usd
      ),
      office_plan_comment: managedOffice?.target_profile?.comment || '',
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const submit = async () => {
    if (!form.email.trim() || !form.first_name.trim()) {
      Alert.alert('Ошибка', 'Заполни email и имя.');
      return;
    }

    if (!form.id && !form.password.trim()) {
      Alert.alert('Ошибка', 'Для нового сотрудника нужно задать пароль.');
      return;
    }

    if (offices.length > 0 && !form.office_id) {
      Alert.alert('Ошибка', 'Выбери офис сотрудника.');
      return;
    }

    setSaving(true);

    const userPayload: Record<string, any> = {
      email: form.email.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      role: form.role,
      office_id: form.office_id,
    };

    if (form.password.trim()) {
      userPayload.password = form.password.trim();
    }

    try {
      let userId = form.id;

      if (form.id) {
        await apiClient.patch(`users/users/${form.id}/`, userPayload);
      } else {
        const created = await apiClient.post('users/users/', userPayload);
        userId = created?.data?.id;
      }

      if (!userId) {
        throw new Error('Не удалось определить ID сотрудника после сохранения.');
      }

      await apiClient.patch(`users/users/${userId}/salary/`, {
        fixed_salary: Number(form.fixed_salary || 0),
        monthly_plan: Number(form.monthly_plan || 0),
        commission_percent: Number(form.commission_percent || 0),
        motivation_target: Number(form.motivation_target || 0),
        motivation_reward: Number(form.motivation_reward || 0),
      });

      await apiClient.patch(`users/users/${userId}/access_profile/`, {
        can_view_office_dashboard: form.can_view_office_dashboard,
        can_be_in_leaderboard: form.can_be_in_leaderboard,
        managed_office_id: form.managed_office_id,
        monthly_plan_usd: Number(form.office_monthly_plan_usd || 0),
        plan_comment: form.office_plan_comment.trim(),
      });

      setModalOpen(false);
      await load();
    } catch (error: any) {
      Alert.alert('Ошибка', extractError(error));
    } finally {
      setSaving(false);
    }
  };

  const removeStaff = (item: StaffItem) => {
    Alert.alert(
      'Удаление',
      `Удалить сотрудника ${item.first_name} ${item.last_name}?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`users/users/${item.id}/`);
              await load();
            } catch (error: any) {
              Alert.alert(
                'Ошибка',
                error?.response?.data?.detail || 'Не удалось удалить сотрудника.'
              );
            }
          },
        },
      ]
    );
  };

  const selectedManagedOffice = offices.find((o) => o.id === form.managed_office_id);

  if (!isAdmin) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <Text style={[styles.denied, { color: theme.text }]}>
            Доступ только для администратора.
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  if (loading) {
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
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={theme.blue}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>Сотрудники</Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>
              Пользователи, доступы, офисы, рейтинг и планы
            </Text>
          </View>

          <Pressable
            onPress={openCreate}
            style={[styles.primaryBtn, { backgroundColor: theme.blue }]}
          >
            <Text style={styles.primaryBtnText}>+ Сотрудник</Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.searchBox,
            {
              borderColor: theme.border,
              backgroundColor: theme.card,
            },
          ]}
        >
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск по сотрудникам"
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <View
          style={[
            styles.infoCard,
            {
              borderColor: theme.border,
              backgroundColor: theme.card,
            },
          ]}
        >
          <Text style={[styles.infoTitle, { color: theme.text }]}>Офисы в системе</Text>
          <Text style={[styles.infoSub, { color: theme.textSecondary }]}>
            Сейчас доступно {offices.length} офис(ов)
          </Text>
        </View>

        <View
          style={[
            styles.list,
            {
              borderColor: theme.border,
              backgroundColor: theme.card,
            },
          ]}
        >
          {filtered.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>
              Сотрудники не найдены.
            </Text>
          ) : (
            filtered.map((item, index) => {
              const role = safeRole(item);
              const isLast = index === filtered.length - 1;

              return (
                <Pressable
                  key={String(item.id)}
                  onPress={() => openEdit(item)}
                  onLongPress={() => removeStaff(item)}
                  style={[
                    styles.row,
                    {
                      borderBottomColor: theme.divider,
                      borderBottomWidth: isLast ? 0 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>
                      {[item.first_name, item.last_name].filter(Boolean).join(' ') || item.email}
                    </Text>

                    <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                      {item.email} · {item.office?.city || 'Офис не выбран'}
                    </Text>

                    <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                      Оклад: {money(item.managersalary?.fixed_salary)} · План:{' '}
                      {money(item.managersalary?.monthly_plan)}
                    </Text>

                    <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                      Баланс офиса:{' '}
                      {item.access_profile?.can_view_office_dashboard ? 'Да' : 'Нет'} · В рейтинге:{' '}
                      {item.access_profile?.can_be_in_leaderboard !== false ? 'Да' : 'Нет'}
                    </Text>

                    <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                      Назначенный офис:{' '}
                      {item.access_profile?.managed_office?.city ||
                        item.office?.city ||
                        'Не назначен'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.rolePill,
                      {
                        backgroundColor:
                          role === 'admin' ? theme.blueSoft : theme.backgroundSoft,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleText,
                        { color: role === 'admin' ? theme.blue : theme.text },
                      ]}
                    >
                      {role === 'admin' ? 'ADMIN' : 'MANAGER'}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        <Text style={[styles.tip, { color: theme.textSecondary }]}>
          Нажми на сотрудника, чтобы изменить.
        </Text>
        <Text style={[styles.tip, { color: theme.textSecondary }]}>
          Зажми строку, чтобы удалить.
        </Text>
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <View
              style={[
                styles.modalCard,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.card,
                },
              ]}
            >
              <ScrollView contentContainerStyle={styles.modalScrollContent}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {form.id ? 'Редактировать сотрудника' : 'Новый сотрудник'}
                </Text>

                <View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                >
                  <TextInput
                    value={form.email}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))}
                    placeholder="Email"
                    placeholderTextColor={theme.textMuted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={[styles.input, { color: theme.text }]}
                  />
                </View>

                <View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                >
                  <TextInput
                    value={form.first_name}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, first_name: value }))}
                    placeholder="Имя"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.input, { color: theme.text }]}
                  />
                </View>

                <View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                >
                  <TextInput
                    value={form.last_name}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, last_name: value }))}
                    placeholder="Фамилия"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.input, { color: theme.text }]}
                  />
                </View>

                <View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                >
                  <TextInput
                    value={form.password}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, password: value }))}
                    placeholder={form.id ? 'Новый пароль (необязательно)' : 'Пароль'}
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry
                    style={[styles.input, { color: theme.text }]}
                  />
                </View>

                <Text style={[styles.modalSection, { color: theme.text }]}>Роль</Text>
                <View style={styles.roleRow}>
                  {(['manager', 'admin'] as StaffRole[]).map((role) => {
                    const active = form.role === role;
                    return (
                      <Pressable
                        key={role}
                        onPress={() => setForm((prev) => ({ ...prev, role }))}
                        style={[
                          styles.roleChip,
                          {
                            backgroundColor: active ? theme.blueSoft : theme.backgroundSoft,
                            borderColor: active ? theme.blue : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleChipText,
                            { color: active ? theme.blue : theme.text },
                          ]}
                        >
                          {role === 'admin' ? 'Админ' : 'Менеджер'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.modalSection, { color: theme.text }]}>Офис сотрудника</Text>
                {offices.length === 0 ? (
                  <Text style={[styles.officeEmpty, { color: theme.textSecondary }]}>
                    В системе пока нет офисов.
                  </Text>
                ) : (
                  <View style={styles.officeWrap}>
                    {offices.map((office) => {
                      const active = form.office_id === office.id;
                      const title = office.city || `Офис #${office.id}`;
                      const subtitle = office.address || 'Адрес не указан';

                      return (
                        <Pressable
                          key={office.id}
                          onPress={() =>
                            setForm((prev) => ({
                              ...prev,
                              office_id: office.id,
                            }))
                          }
                          style={[
                            styles.officeChip,
                            {
                              backgroundColor: active
                                ? theme.blueSoft
                                : theme.backgroundSoft,
                              borderColor: active ? theme.blue : theme.border,
                            },
                          ]}
                        >
                          <Text style={[styles.officeChipTitle, { color: theme.text }]}>
                            {title}
                          </Text>
                          <Text
                            style={[
                              styles.officeChipSub,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {subtitle}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                <Text style={[styles.modalSection, { color: theme.text }]}>
                  Зарплата и цели
                </Text>

                <View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                >
                  <TextInput
                    value={form.fixed_salary}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, fixed_salary: value }))}
                    placeholder="Фиксированная зарплата"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                    style={[styles.input, { color: theme.text }]}
                  />
                </View>

                <View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                >
                  <TextInput
                    value={form.monthly_plan}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, monthly_plan: value }))}
                    placeholder="Личный план менеджера"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                    style={[styles.input, { color: theme.text }]}
                  />
                </View>

                <View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                >
                  <TextInput
                    value={form.commission_percent}
                    onChangeText={(value) =>
                      setForm((prev) => ({ ...prev, commission_percent: value }))
                    }
                    placeholder="Процент комиссии"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                    style={[styles.input, { color: theme.text }]}
                  />
                </View>

                <View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                >
                  <TextInput
                    value={form.motivation_target}
                    onChangeText={(value) =>
                      setForm((prev) => ({ ...prev, motivation_target: value }))
                    }
                    placeholder="Цель мотивации"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                    style={[styles.input, { color: theme.text }]}
                  />
                </View>

                <View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                >
                  <TextInput
                    value={form.motivation_reward}
                    onChangeText={(value) =>
                      setForm((prev) => ({ ...prev, motivation_reward: value }))
                    }
                    placeholder="Награда за цель"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                    style={[styles.input, { color: theme.text }]}
                  />
                </View>

                <Text style={[styles.modalSection, { color: theme.text }]}>
                  Доступы и рейтинг
                </Text>

                <View
                  style={[
                    styles.switchRow,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchTitle, { color: theme.text }]}>
                      Видеть баланс офиса
                    </Text>
                    <Text style={[styles.switchSub, { color: theme.textSecondary }]}>
                      Для особого менеджера
                    </Text>
                  </View>
                  <Switch
                    value={form.can_view_office_dashboard}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, can_view_office_dashboard: value }))
                    }
                  />
                </View>

                <View
                  style={[
                    styles.switchRow,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchTitle, { color: theme.text }]}>
                      Показывать в рейтинге
                    </Text>
                    <Text style={[styles.switchSub, { color: theme.textSecondary }]}>
                      Админ сам решает, кого показывать
                    </Text>
                  </View>
                  <Switch
                    value={form.can_be_in_leaderboard}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, can_be_in_leaderboard: value }))
                    }
                  />
                </View>

                <Text style={[styles.modalSection, { color: theme.text }]}>
                  Назначенный офис special manager
                </Text>
                {offices.length === 0 ? (
                  <Text style={[styles.officeEmpty, { color: theme.textSecondary }]}>
                    Нет офисов для назначения.
                  </Text>
                ) : (
                  <View style={styles.officeWrap}>
                    {offices.map((office) => {
                      const active = form.managed_office_id === office.id;
                      const title = office.city || `Офис #${office.id}`;
                      const subtitle = office.address || 'Адрес не указан';

                      return (
                        <Pressable
                          key={`managed-${office.id}`}
                          onPress={() =>
                            setForm((prev) => ({
                              ...prev,
                              managed_office_id: office.id,
                              office_monthly_plan_usd: stringifyNumber(
                                office.target_profile?.monthly_plan_usd
                              ),
                              office_plan_comment: office.target_profile?.comment || '',
                            }))
                          }
                          style={[
                            styles.officeChip,
                            {
                              backgroundColor: active
                                ? theme.blueSoft
                                : theme.backgroundSoft,
                              borderColor: active ? theme.blue : theme.border,
                            },
                          ]}
                        >
                          <Text style={[styles.officeChipTitle, { color: theme.text }]}>
                            {title}
                          </Text>
                          <Text
                            style={[
                              styles.officeChipSub,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {subtitle}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                <Text style={[styles.modalSection, { color: theme.text }]}>План офиса</Text>

                <View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                >
                  <TextInput
                    value={form.office_monthly_plan_usd}
                    onChangeText={(value) =>
                      setForm((prev) => ({ ...prev, office_monthly_plan_usd: value }))
                    }
                    placeholder="План офиса на месяц (USD)"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="numeric"
                    style={[styles.input, { color: theme.text }]}
                  />
                </View>

                <View
                  style={[
                    styles.inputWrap,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                >
                  <TextInput
                    value={form.office_plan_comment}
                    onChangeText={(value) =>
                      setForm((prev) => ({ ...prev, office_plan_comment: value }))
                    }
                    placeholder="Комментарий к плану офиса"
                    placeholderTextColor={theme.textMuted}
                    multiline
                    style={[
                      styles.input,
                      {
                        color: theme.text,
                        minHeight: 72,
                        textAlignVertical: 'top',
                      },
                    ]}
                  />
                </View>

                {!!selectedManagedOffice && (
                  <Text style={[styles.tip, { color: theme.textSecondary }]}>
                    Назначенный офис: {selectedManagedOffice.city || `Офис #${selectedManagedOffice.id}`}
                  </Text>
                )}

                <View style={styles.modalActions}>
                  <Pressable
                    onPress={closeModal}
                    style={[
                      styles.modalBtn,
                      {
                        backgroundColor: theme.backgroundSoft,
                        borderWidth: 1,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text style={[styles.modalBtnText, { color: theme.text }]}>Отмена</Text>
                  </Pressable>

                  <Pressable
                    onPress={submit}
                    disabled={saving}
                    style={[
                      styles.modalBtn,
                      {
                        backgroundColor: theme.blue,
                        opacity: saving ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                      {saving ? 'Сохраняю...' : 'Сохранить'}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  denied: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  container: {
    padding: 20,
    paddingBottom: 120,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
  },
  sub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
  },
  primaryBtn: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '900',
  },
  searchBox: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 18,
  },
  searchInput: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoCard: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  infoSub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  rowMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginLeft: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '900',
  },
  empty: {
    padding: 18,
    fontSize: 14,
  },
  tip: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8,18,28,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 10,
    maxHeight: '92%',
  },
  modalScrollContent: {
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 14,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  input: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalSection: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 4,
    marginBottom: 10,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  roleChipText: {
    fontSize: 14,
    fontWeight: '900',
  },
  officeEmpty: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  officeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  officeChip: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },
  officeChipTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  officeChipSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  switchRow: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  switchSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    marginBottom: 4,
  },
  modalBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 14,
  },
  modalBtnText: {
    fontWeight: '900',
    fontSize: 15,
  },
});