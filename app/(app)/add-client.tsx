// app/(app)/add-client.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
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
import apiClient from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

function cleanNullable(value: string) {
  const v = value.trim();
  return v ? v : null;
}

function flattenServerError(data: any): string {
  if (!data) return 'Не удалось создать клиента.';

  if (typeof data === 'string') return data;

  if (Array.isArray(data)) {
    return data.map((x) => String(x)).join('\n');
  }

  if (typeof data === 'object') {
    return Object.entries(data)
      .map(([key, value]) => {
        if (Array.isArray(value)) return `${key}: ${value.join(', ')}`;
        if (typeof value === 'object') return `${key}: ${JSON.stringify(value)}`;
        return `${key}: ${String(value)}`;
      })
      .join('\n');
  }

  return 'Не удалось создать клиента.';
}

export default function AddClientScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [submitLoading, setSubmitLoading] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    city: '',
    dob: '',
    status: 'new',
    citizenship: 'Туркменистан',
    is_priority: false,

    passport_local_num: '',
    passport_inter_num: '',
    passport_issued_by: '',
    passport_issued_date: '',
    address_registration: '',

    is_partner_client: false,
    partner_name: '',
    has_discount: false,
    discount_amount: '',

    current_tasks: '',
    comments: '',

    // временно, пока relative на бэке read-only
    relative_full_name: '',
    relative_relation_type: '',
    relative_phone: '',
    relative_work_place: '',

    // временно для оформления документов
    doc_notes: '',
    contract_notes: '',
  });

  const canSubmit = useMemo(
    () =>
      !!form.full_name.trim() &&
      !!form.phone.trim() &&
      !!form.city.trim() &&
      !submitLoading,
    [form.full_name, form.phone, form.city, submitLoading]
  );

  const setField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const Input = ({
    label,
    field,
    placeholder,
    multiline = false,
    keyboardType = 'default' as
      | 'default'
      | 'email-address'
      | 'numeric'
      | 'phone-pad',
  }) => (
    <View style={styles.fieldBlock}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: theme.backgroundSoft,
            borderColor: theme.border,
            minHeight: multiline ? 96 : 58,
          },
        ]}
      >
        <TextInput
          value={(form as any)[field]}
          onChangeText={(value) => setField(field, value)}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          multiline={multiline}
          keyboardType={keyboardType}
          style={[
            styles.input,
            {
              color: theme.text,
              minHeight: multiline ? 74 : 24,
              textAlignVertical: multiline ? 'top' : 'center',
            },
          ]}
        />
      </View>
    </View>
  );

  const submit = async () => {
    if (!form.full_name.trim() || !form.phone.trim() || !form.city.trim()) {
      Alert.alert('Ошибка', 'Обязательные поля: ФИО, телефон, город.');
      return;
    }

    setSubmitLoading(true);

    try {
      const extraComments = [
        form.comments.trim(),
        form.relative_full_name ||
        form.relative_relation_type ||
        form.relative_phone ||
        form.relative_work_place
          ? [
              '=== RELATIVE ===',
              `ФИО: ${form.relative_full_name || '-'}`,
              `Кем приходится: ${form.relative_relation_type || '-'}`,
              `Телефон: ${form.relative_phone || '-'}`,
              `Место работы: ${form.relative_work_place || '-'}`,
            ].join('\n')
          : '',
        form.contract_notes.trim()
          ? ['=== CONTRACT NOTES ===', form.contract_notes.trim()].join('\n')
          : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const mergedTasks = [
        form.current_tasks.trim(),
        form.doc_notes.trim()
          ? ['=== DOC PREP ===', form.doc_notes.trim()].join('\n')
          : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const payload: any = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: cleanNullable(form.email),
        city: form.city.trim(),
        dob: cleanNullable(form.dob),
        status: form.status,
        citizenship: form.citizenship.trim() || 'Туркменистан',
        is_priority: form.is_priority,

        passport_local_num: form.passport_local_num.trim(),
        passport_inter_num: form.passport_inter_num.trim(),
        passport_issued_by: form.passport_issued_by.trim(),
        passport_issued_date: cleanNullable(form.passport_issued_date),
        address_registration: form.address_registration.trim(),

        is_partner_client: form.is_partner_client,
        partner_name: form.partner_name.trim(),
        has_discount: form.has_discount,
        discount_amount: Number(form.discount_amount || 0),

        current_tasks: mergedTasks,
        comments: extraComments,
      };

      await apiClient.post('clients/', payload);

      Alert.alert('Готово', 'Клиент успешно создан.', [
        {
          text: 'OK',
          onPress: () => router.replace('/(app)/crm' as any),
        },
      ]);
    } catch (error: any) {
      Alert.alert(
        'Ошибка сервера',
        flattenServerError(error?.response?.data)
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.backBtn,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>

          <Text style={[styles.title, { color: theme.text }]}>Новый клиент</Text>

          <View style={{ width: 46 }} />
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Основное</Text>

          <Input label="ФИО *" field="full_name" placeholder="ФИО клиента" />
          <Input
            label="Телефон *"
            field="phone"
            placeholder="+993..."
            keyboardType="phone-pad"
          />
          <Input
            label="Email"
            field="email"
            placeholder="mail@example.com"
            keyboardType="email-address"
          />
          <Input label="Город *" field="city" placeholder="Ашхабад" />
          <Input label="Дата рождения" field="dob" placeholder="YYYY-MM-DD" />
          <Input
            label="Гражданство"
            field="citizenship"
            placeholder="Туркменистан"
          />

          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: theme.text }]}>
              Приоритетный клиент
            </Text>
            <Switch
              value={form.is_priority}
              onValueChange={(v) => setField('is_priority', v)}
            />
          </View>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Паспорт и договор
          </Text>

          <Input
            label="Внутренний паспорт"
            field="passport_local_num"
            placeholder="Серия / номер"
          />
          <Input
            label="Загранпаспорт"
            field="passport_inter_num"
            placeholder="Номер загранпаспорта"
          />
          <Input
            label="Кем выдан"
            field="passport_issued_by"
            placeholder="МВД Туркменистана"
          />
          <Input
            label="Дата выдачи"
            field="passport_issued_date"
            placeholder="YYYY-MM-DD"
          />
          <Input
            label="Адрес регистрации"
            field="address_registration"
            placeholder="Полный адрес"
            multiline
          />
          <Input
            label="Заметки по договору"
            field="contract_notes"
            placeholder="Особые условия, доверенность, кто подписывает..."
            multiline
          />
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Партнёрский блок
          </Text>

          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: theme.text }]}>
              Клиент от партнёра
            </Text>
            <Switch
              value={form.is_partner_client}
              onValueChange={(v) => setField('is_partner_client', v)}
            />
          </View>

          <Input
            label="Название партнёра"
            field="partner_name"
            placeholder="Название партнёра"
          />

          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: theme.text }]}>
              Есть скидка
            </Text>
            <Switch
              value={form.has_discount}
              onValueChange={(v) => setField('has_discount', v)}
            />
          </View>

          <Input
            label="Сумма / процент скидки"
            field="discount_amount"
            placeholder="0"
            keyboardType="numeric"
          />
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Родственник
          </Text>

          <Input
            label="ФИО родственника"
            field="relative_full_name"
            placeholder="ФИО"
          />
          <Input
            label="Кем приходится"
            field="relative_relation_type"
            placeholder="Отец / мать / брат"
          />
          <Input
            label="Телефон родственника"
            field="relative_phone"
            placeholder="+993..."
            keyboardType="phone-pad"
          />
          <Input
            label="Место работы"
            field="relative_work_place"
            placeholder="Работа родственника"
          />

          <Text style={[styles.helper, { color: theme.textSecondary }]}>
            Пока backend не принимает nested relative через POST /clients/.
            Эти данные временно сохраняются в комментариях клиента.
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Работа менеджера
          </Text>

          <Input
            label="Текущие задачи"
            field="current_tasks"
            placeholder="Что сейчас делаем по клиенту"
            multiline
          />
          <Input
            label="Комментарий"
            field="comments"
            placeholder="Важные комментарии"
            multiline
          />
          <Input
            label="Поля для оформления документа"
            field="doc_notes"
            placeholder="Что собрано / что не собрано / что проверить"
            multiline
          />
        </View>

        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={[
            styles.submitBtn,
            { backgroundColor: canSubmit ? theme.blue : theme.border },
          ]}
        >
          {submitLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Сохранить клиента</Text>
          )}
        </Pressable>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 120,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 14,
  },
  fieldBlock: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    fontSize: 15,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  switchText: {
    fontSize: 15,
    fontWeight: '700',
  },
  helper: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  submitBtn: {
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
});