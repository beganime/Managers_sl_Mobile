import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { createClient, getClient, updateClient } from '../../api/crm';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/cards/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Input } from '../../components/forms/Input';
import { Header } from '../../components/layout/Header';
import { LoadingState } from '../../components/ui/LoadingState';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { theme } from '../../theme/theme';
import { toApiError } from '../../api/client';

type ClientForm = {
  full_name: string;
  phone: string;
  email: string;
  direction: string;
  dob: string;
  citizenship: string;
  city: string;
  address: string;
  registration_address: string;
  passport_local_num: string;
  passport_inter_num: string;
  passport_issued_by: string;
  passport_issued_date: string;
  passport_valid_until: string;
  interested_country: string;
  interested_university: string;
  interested_program: string;
  comments: string;
};

const initialForm: ClientForm = {
  full_name: '',
  phone: '',
  email: '',
  direction: 'admission',
  dob: '',
  citizenship: '',
  city: '',
  address: '',
  registration_address: '',
  passport_local_num: '',
  passport_inter_num: '',
  passport_issued_by: '',
  passport_issued_date: '',
  passport_valid_until: '',
  interested_country: '',
  interested_university: '',
  interested_program: '',
  comments: '',
};

export function ClientFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = Boolean(id);
  const [form, setForm] = useState<ClientForm>(initialForm);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    getClient(id)
      .then((client) => {
        setForm({
          full_name: String(client.full_name || ''),
          phone: String(client.phone || ''),
          email: String(client.email || ''),
          direction: String(client.direction || 'admission'),
          dob: String(client.dob || ''),
          citizenship: String(client.citizenship || ''),
          city: String(client.city || ''),
          address: String(client.address || ''),
          registration_address: String(client.registration_address || ''),
          passport_local_num: String(client.passport_local_num || ''),
          passport_inter_num: String(client.passport_inter_num || ''),
          passport_issued_by: String(client.passport_issued_by || ''),
          passport_issued_date: String(client.passport_issued_date || ''),
          passport_valid_until: String(client.passport_valid_until || ''),
          interested_country: String(client.interested_country || ''),
          interested_university: String(client.interested_university || ''),
          interested_program: String(client.interested_program || ''),
          comments: String(client.comments || ''),
        });
      })
      .catch((requestError) => setError(toApiError(requestError).message))
      .finally(() => setLoading(false));
  }, [id]);

  const setField = useCallback((key: keyof ClientForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const validation = useMemo(() => {
    if (!form.full_name.trim()) return 'Укажите ФИО клиента.';
    if (!form.phone.trim() && !form.email.trim()) return 'Укажите телефон или email.';
    if (!form.direction.trim()) return 'Укажите направление.';
    return null;
  }, [form.direction, form.email, form.full_name, form.phone]);

  const submit = async () => {
    if (validation) {
      Alert.alert('Проверьте форму', validation);
      return;
    }

    setSaving(true);

    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, value.trim() || undefined])
      );
      const client = editing && id ? await updateClient(id, payload) : await createClient(payload as any);
      router.replace(`/(app)/crm/clients/${client.id}` as any);
    } catch (requestError) {
      Alert.alert('Не удалось сохранить', toApiError(requestError).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <Header
        title={editing ? 'Редактировать клиента' : 'Создать клиента'}
        subtitle="Обязательные поля: ФИО, телефон или email, направление."
        showBack
      />

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading && !error ? (
        <Card style={styles.form}>
          <SectionTitle title="Основное" />
          <Input label="ФИО" value={form.full_name} onChangeText={(value) => setField('full_name', value)} />
          <Input label="Телефон" value={form.phone} onChangeText={(value) => setField('phone', value)} keyboardType="phone-pad" />
          <Input label="Email" value={form.email} onChangeText={(value) => setField('email', value)} keyboardType="email-address" autoCapitalize="none" />
          <Input label="Направление" value={form.direction} onChangeText={(value) => setField('direction', value)} />
          <Input label="Дата рождения" value={form.dob} onChangeText={(value) => setField('dob', value)} placeholder="YYYY-MM-DD" />
          <Input label="Гражданство" value={form.citizenship} onChangeText={(value) => setField('citizenship', value)} />
          <Input label="Город" value={form.city} onChangeText={(value) => setField('city', value)} />
          <Input label="Адрес" value={form.address} onChangeText={(value) => setField('address', value)} multiline />
          <Input label="Адрес регистрации" value={form.registration_address} onChangeText={(value) => setField('registration_address', value)} multiline />

          <SectionTitle title="Паспорт" />
          <Input label="Паспорт" value={form.passport_local_num} onChangeText={(value) => setField('passport_local_num', value)} />
          <Input label="Загранпаспорт" value={form.passport_inter_num} onChangeText={(value) => setField('passport_inter_num', value)} />
          <Input label="Кем выдан паспорт" value={form.passport_issued_by} onChangeText={(value) => setField('passport_issued_by', value)} />
          <Input label="Дата выдачи" value={form.passport_issued_date} onChangeText={(value) => setField('passport_issued_date', value)} placeholder="YYYY-MM-DD" />
          <Input label="Срок действия" value={form.passport_valid_until} onChangeText={(value) => setField('passport_valid_until', value)} placeholder="YYYY-MM-DD" />

          <SectionTitle title="Интерес" />
          <Input label="Интересующая страна" value={form.interested_country} onChangeText={(value) => setField('interested_country', value)} />
          <Input label="Интересующий вуз" value={form.interested_university} onChangeText={(value) => setField('interested_university', value)} />
          <Input label="Интересующая программа" value={form.interested_program} onChangeText={(value) => setField('interested_program', value)} />
          <Input label="Комментарий" value={form.comments} onChangeText={(value) => setField('comments', value)} multiline />
          <Button title="Сохранить клиента" loading={saving} onPress={submit} />
        </Card>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: theme.spacing.md,
  },
});
