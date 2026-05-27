import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { createLead, getLead, updateLead } from '../../api/crm';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { ErrorState } from '../../components/ui/ErrorState';
import { Header } from '../../components/layout/Header';
import { LoadingState } from '../../components/ui/LoadingState';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { theme } from '../../theme/theme';
import { toApiError } from '../../api/client';

type LeadForm = {
  full_name: string;
  phone: string;
  email: string;
  city: string;
  direction: string;
  interested_country: string;
  interested_program: string;
  comment: string;
};

const initialForm: LeadForm = {
  full_name: '',
  phone: '',
  email: '',
  city: '',
  direction: 'admission',
  interested_country: '',
  interested_program: '',
  comment: '',
};

export function LeadFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = Boolean(id);
  const [form, setForm] = useState<LeadForm>(initialForm);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    getLead(id)
      .then((lead) => {
        setForm({
          full_name: String(lead.full_name || ''),
          phone: String(lead.phone || ''),
          email: String(lead.email || ''),
          city: String(lead.city || ''),
          direction: String(lead.direction || 'admission'),
          interested_country: String(lead.interested_country || ''),
          interested_program: String(lead.interested_program || ''),
          comment: String(lead.comment || ''),
        });
      })
      .catch((requestError) => setError(toApiError(requestError).message))
      .finally(() => setLoading(false));
  }, [id]);

  const setField = useCallback((key: keyof LeadForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const validation = useMemo(() => {
    if (!form.full_name.trim()) return 'Укажите ФИО лида.';
    if (!form.phone.trim()) return 'Укажите телефон лида.';
    return null;
  }, [form.full_name, form.phone]);

  const submit = async () => {
    if (validation) {
      Alert.alert('Проверьте форму', validation);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,
        email: form.email.trim() || undefined,
      };
      const lead = editing && id ? await updateLead(id, payload) : await createLead(payload);
      router.replace(`/(app)/crm/leads/${lead.id}` as any);
    } catch (requestError) {
      Alert.alert('Не удалось сохранить', toApiError(requestError).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <Header
        title={editing ? 'Редактировать лид' : 'Создать лид'}
        subtitle="Контакт потенциального клиента."
        showBack
      />

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading && !error ? (
        <Card style={styles.form}>
          <Input label="ФИО" value={form.full_name} onChangeText={(value) => setField('full_name', value)} />
          <Input label="Телефон" value={form.phone} onChangeText={(value) => setField('phone', value)} keyboardType="phone-pad" />
          <Input label="Email" value={form.email} onChangeText={(value) => setField('email', value)} keyboardType="email-address" autoCapitalize="none" />
          <Input label="Город" value={form.city} onChangeText={(value) => setField('city', value)} />
          <Input label="Направление" value={form.direction} onChangeText={(value) => setField('direction', value)} />
          <Input label="Интересующая страна" value={form.interested_country} onChangeText={(value) => setField('interested_country', value)} />
          <Input label="Интересующая программа" value={form.interested_program} onChangeText={(value) => setField('interested_program', value)} />
          <Input label="Комментарий" value={form.comment} onChangeText={(value) => setField('comment', value)} multiline />
          <Button title="Сохранить" loading={saving} onPress={submit} />
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
