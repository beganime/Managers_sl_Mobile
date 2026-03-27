import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
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
    monthly_plan?: number;
    current_month_revenue?: number;
    current_balance?: number;
    fixed_salary?: number;
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
};

const EMPTY_FORM: StaffFormState = {
  email: '',
  first_name: '',
  last_name: '',
  role: 'manager',
  password: '',
  office_id: null,
};

function money(value?: number | string | null) {
  const amount = Number(value || 0);
  return `$${amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`;
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
          String(a.city || '').localeCompare(String(b.city || ''), 'ru'),
        ),
      );
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.detail || 'Не удалось загрузить сотрудников и офисы.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      load();
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
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [search, staff]);

  const openCreate = () => {
    setForm({
      ...EMPTY_FORM,
      office_id: offices[0]?.id ?? null,
    });
    setModalOpen(true);
  };

  const openEdit = (item: StaffItem) => {
    setForm({
      id: item.id,
      email: item.email || '',
      first_name: item.first_name || '',
      last_name: item.last_name || '',
      role: (item.role as StaffRole) || (item.is_superuser ? 'admin' : 'manager'),
      password: '',
      office_id: item.office?.id ?? null,
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

    const payload: Record<string, any> = {
      email: form.email.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      role: form.role,
      office_id: form.office_id,
    };

    if (form.password.trim()) {
      payload.password = form.password.trim();
    }

    try {
      if (form.id) {
        await apiClient.patch(`users/users/${form.id}/`, payload);
      } else {
        await apiClient.post('users/users/', payload);
      }

      setModalOpen(false);
      await load();
    } catch (error: any) {
      Alert.alert(
        'Ошибка',
        error?.response?.data?.detail ||
          error?.response?.data?.email?.[0] ||
          error?.response?.data?.password?.[0] ||
          error?.response?.data?.office_id?.[0] ||
          'Не удалось сохранить сотрудника.',
      );
    } finally {
      setSaving(false);
    }
  };

  const removeStaff = (item: StaffItem) => {
    Alert.alert('Удаление', `Удалить сотрудника ${item.first_name} ${item.last_name}?`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`users/users/${item.id}/`);
            await load();
          } catch (error: any) {
            Alert.alert('Ошибка', error?.response?.data?.detail || 'Не удалось удалить сотрудника.');
          }
        },
      },
    ]);
  };

  if (!isAdmin) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <Text style={[styles.denied, { color: theme.text }]}>Доступ только для администратора.</Text>
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
              load();
            }}
            tintColor={theme.blue}
          />
        }
        showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>Сотрудники</Text>
            <Text style={[styles.sub, { color: theme.textMuted }]}>Добавление, редактирование и привязка к офису</Text>
          </View>

          <Pressable style={[styles.primaryBtn, { backgroundColor: theme.blue }]} onPress={openCreate}>
            <Text style={styles.primaryBtnText}>+ Сотрудник</Text>
          </Pressable>
        </View>

        <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск по имени, email или офису"
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.infoTitle, { color: theme.text }]}>Офисы в системе</Text>
          <Text style={[styles.infoSub, { color: theme.textMuted }]}>Сейчас доступно {offices.length} офис(ов)</Text>
        </View>

        <View style={[styles.list, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {filtered.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textMuted }]}>Сотрудники не найдены.</Text>
          ) : (
            filtered.map((item) => {
              const role = (item.role as StaffRole) || (item.is_superuser ? 'admin' : 'manager');

              return (
                <Pressable
                  key={String(item.id)}
                  onPress={() => openEdit(item)}
                  onLongPress={() => removeStaff(item)}
                  style={[styles.row, { borderBottomColor: theme.divider }]}> 
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>
                      {[item.first_name, item.last_name].filter(Boolean).join(' ') || item.email}
                    </Text>
                    <Text style={[styles.rowMeta, { color: theme.textMuted }]}>
                      {item.email} · {item.office?.city || 'Офис не выбран'}
                    </Text>
                    <Text style={[styles.rowMeta, { color: theme.textMuted }]}>
                      Оклад: {money(item.managersalary?.fixed_salary)} · План: {money(item.managersalary?.monthly_plan)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.rolePill,
                      {
                        backgroundColor: role === 'admin' ? theme.redSoft : theme.blueSoft,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.roleText,
                        {
                          color: role === 'admin' ? theme.red : theme.blue,
                        },
                      ]}>
                      {role === 'admin' ? 'ADMIN' : 'MANAGER'}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        <Text style={[styles.tip, { color: theme.textMuted }]}>Нажми на сотрудника, чтобы изменить. Зажми строку, чтобы удалить.</Text>
      </ScrollView>

      <Modal transparent visible={modalOpen} animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {form.id ? 'Редактировать сотрудника' : 'Новый сотрудник'}
            </Text>

            <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}> 
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

            <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}> 
              <TextInput
                value={form.first_name}
                onChangeText={(value) => setForm((prev) => ({ ...prev, first_name: value }))}
                placeholder="Имя"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text }]}
              />
            </View>

            <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}> 
              <TextInput
                value={form.last_name}
                onChangeText={(value) => setForm((prev) => ({ ...prev, last_name: value }))}
                placeholder="Фамилия"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text }]}
              />
            </View>

            <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}> 
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
                    ]}>
                    <Text style={[styles.roleChipText, { color: active ? theme.blue : theme.text }]}>
                      {role === 'admin' ? 'Админ' : 'Менеджер'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.modalSection, { color: theme.text }]}>Офис</Text>
            {offices.length === 0 ? (
              <Text style={[styles.officeEmpty, { color: theme.textMuted }]}>В системе пока нет офисов.</Text>
            ) : (
              <View style={styles.officeWrap}>
                {offices.map((office) => {
                  const active = form.office_id === office.id;
                  const title = office.city || `Офис #${office.id}`;
                  const subtitle = office.address || 'Адрес не указан';

                  return (
                    <Pressable
                      key={office.id}
                      onPress={() => setForm((prev) => ({ ...prev, office_id: office.id }))}
                      style={[
                        styles.officeChip,
                        {
                          backgroundColor: active ? theme.blueSoft : theme.backgroundSoft,
                          borderColor: active ? theme.blue : theme.border,
                        },
                      ]}>
                      <Text style={[styles.officeChipTitle, { color: active ? theme.blue : theme.text }]}>{title}</Text>
                      <Text style={[styles.officeChipSub, { color: theme.textMuted }]} numberOfLines={2}>
                        {subtitle}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable
                onPress={closeModal}
                style={[styles.modalBtn, { backgroundColor: theme.backgroundSoft }]}>
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Отмена</Text>
              </Pressable>

              <Pressable
                onPress={submit}
                disabled={saving}
                style={[styles.modalBtn, { backgroundColor: theme.blue, opacity: saving ? 0.7 : 1 }]}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                  {saving ? 'Сохраняю...' : 'Сохранить'}
                </Text>
              </Pressable>
            </View>
          </View>
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
    borderBottomWidth: 1,
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
    padding: 18,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    maxHeight: '86%',
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
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
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
