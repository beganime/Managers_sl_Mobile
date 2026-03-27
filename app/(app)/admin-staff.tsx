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

type StaffItem = {
  id?: number;
  email: string;
  first_name: string;
  last_name: string;
  role: StaffRole;
  is_staff?: boolean;
  is_superuser?: boolean;
  work_status?: string;
  office?: { city?: string; address?: string } | null;
  managersalary?: {
    monthly_plan?: number;
    current_month_revenue?: number;
    current_balance?: number;
    fixed_salary?: number;
  } | null;
};

export default function AdminStaffScreen() {
  const { theme } = useTheme();
  const { user } = useCurrentUser();

  const isAdmin = !!user && (user.is_superuser || user.is_staff || user.role === 'admin');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState<StaffItem & { password?: string }>({
    email: '',
    first_name: '',
    last_name: '',
    role: 'manager',
    password: '',
  });

  const load = useCallback(async () => {
    try {
      const data = await fetchAllPages('users/users/');
      setStaff(data as StaffItem[]);
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.detail || 'Не удалось загрузить сотрудников.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((item) => {
      if (!q) return true;
      return (
        String(item.email || '').toLowerCase().includes(q) ||
        String(item.first_name || '').toLowerCase().includes(q) ||
        String(item.last_name || '').toLowerCase().includes(q) ||
        String(item.office?.city || '').toLowerCase().includes(q)
      );
    });
  }, [search, staff]);

  const openCreate = () => {
    setForm({
      email: '',
      first_name: '',
      last_name: '',
      role: 'manager',
      password: '',
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
      is_staff: item.is_staff,
      is_superuser: item.is_superuser,
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.email.trim() || !form.first_name.trim()) {
      Alert.alert('Ошибка', 'Заполни email и имя.');
      return;
    }

    setSaving(true);

    const payload: any = {
      email: form.email.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      role: form.role,
      is_staff: form.role === 'admin',
      is_superuser: form.role === 'admin',
    };

    if (form.password?.trim()) {
      payload.password = form.password.trim();
    }

    try {
      if (form.id) {
        await apiClient.patch(`users/users/${form.id}/`, payload);
      } else {
        await apiClient.post('users/users/', payload);
      }

      setSaving(false);
      setModalOpen(false);
      await load();
    } catch (error: any) {
      setSaving(false);
      Alert.alert(
        'Ошибка',
        error?.response?.data?.detail ||
          error?.response?.data?.email?.[0] ||
          error?.response?.data?.password?.[0] ||
          'Не удалось сохранить сотрудника.'
      );
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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Сотрудники</Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>CRUD сотрудников с мобилки</Text>
          </View>

          <Pressable onPress={openCreate} style={[styles.primaryBtn, { backgroundColor: theme.blue }]}>
            <Text style={styles.primaryBtnText}>+ Сотрудник</Text>
          </Pressable>
        </View>

        <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск по имени, email, офису"
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <View style={[styles.list, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {filtered.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>Сотрудники не найдены.</Text>
          ) : (
            filtered.map((item) => {
              const role = (item.role as StaffRole) || (item.is_superuser ? 'admin' : 'manager');
              return (
                <Pressable
                  key={String(item.id)}
                  onPress={() => openEdit(item)}
                  onLongPress={() => removeStaff(item)}
                  style={[styles.row, { borderBottomColor: theme.divider }]}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>
                      {[item.first_name, item.last_name].filter(Boolean).join(' ') || item.email}
                    </Text>
                    <Text style={[styles.rowMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                      {item.email} · {item.office?.city || 'Без офиса'}
                    </Text>
                    <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                      Оклад: ${Number(item.managersalary?.fixed_salary || 0).toFixed(0)} · План: $
                      {Number(item.managersalary?.monthly_plan || 0).toFixed(0)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.rolePill,
                      { backgroundColor: role === 'admin' ? theme.redSoft : theme.blueSoft },
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleText,
                        { color: role === 'admin' ? theme.red : theme.blue },
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
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
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
                        backgroundColor: active ? theme.blue : theme.surface,
                        borderColor: active ? theme.blue : theme.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '900' }}>
                      {role === 'admin' ? 'Админ' : 'Менеджер'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable onPress={() => setModalOpen(false)} style={[styles.modalBtn, { backgroundColor: theme.backgroundSoft }]}>
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Отмена</Text>
              </Pressable>

              <Pressable onPress={submit} style={[styles.modalBtn, { backgroundColor: theme.blue }]}>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  denied: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  container: { padding: 20, paddingBottom: 120 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '900' },
  sub: { marginTop: 6, fontSize: 13, fontWeight: '700' },
  primaryBtn: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  primaryBtnText: { color: '#fff', fontWeight: '900' },
  searchBox: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, marginTop: 18 },
  searchInput: { fontSize: 15, fontWeight: '600' },
  list: { marginTop: 16, borderWidth: 1, borderRadius: 22, overflow: 'hidden' },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '900' },
  rowMeta: { marginTop: 4, fontSize: 12, fontWeight: '600' },
  rolePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  roleText: { fontSize: 12, fontWeight: '900' },
  empty: { padding: 18, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(8,18,28,0.35)', justifyContent: 'center', padding: 18 },
  modalCard: { borderWidth: 1, borderRadius: 24, padding: 18 },
  modalTitle: { fontSize: 20, fontWeight: '900', marginBottom: 14 },
  inputWrap: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  input: { fontSize: 15, fontWeight: '600' },
  modalSection: { fontSize: 15, fontWeight: '900', marginTop: 4, marginBottom: 10 },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleChip: { flex: 1, borderWidth: 1, borderRadius: 16, alignItems: 'center', paddingVertical: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 14 },
  modalBtnText: { fontWeight: '900', fontSize: 15 },
});