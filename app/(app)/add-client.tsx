import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { memo, useCallback, useMemo, useState } from 'react';
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

type FormState = {
  full_name: string;
  phone: string;
  email: string;
  city: string;
  dob: string;
  status: string;
  citizenship: string;
  is_priority: boolean;

  passport_local_num: string;
  passport_inter_num: string;
  passport_issued_by: string;
  passport_issued_date: string;
  address_registration: string;

  is_partner_client: boolean;
  partner_name: string;
  has_discount: boolean;
  discount_amount: string;

  current_tasks: string;
  comments: string;

  relative_full_name: string;
  relative_relation_type: string;
  relative_phone: string;
  relative_work_place: string;

  doc_notes: string;
  contract_notes: string;
};

type ThemeType = {
  text: string;
  textSecondary: string;
  textMuted: string;
  backgroundSoft: string;
  surface: string;
  border: string;
  blue: string;
};

type InputFieldProps = {
  theme: ThemeType;
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  required?: boolean;
  hint?: string;
};

type ToggleRowProps = {
  theme: ThemeType;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
};

type SectionCardProps = {
  theme: ThemeType;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

const STATUS_OPTIONS = [
  { value: 'new', label: 'Новый', icon: 'sparkles-outline' as const },
  { value: 'consultation', label: 'Консультация', icon: 'chatbubble-ellipses-outline' as const },
  { value: 'documents', label: 'Документы', icon: 'document-text-outline' as const },
  { value: 'visa', label: 'Виза', icon: 'airplane-outline' as const },
  { value: 'success', label: 'Успех', icon: 'checkmark-circle-outline' as const },
  { value: 'rejected', label: 'Отказ', icon: 'close-circle-outline' as const },
  { value: 'archive', label: 'Архив', icon: 'archive-outline' as const },
];

function cleanNullable(value: string) {
  const v = value.trim();
  return v ? v : null;
}

function normalizeDecimal(value: string) {
  if (!value.trim()) return 0;
  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
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

function buildStructuredComments(form: FormState) {
  const chunks: string[] = [];

  if (form.comments.trim()) {
    chunks.push(form.comments.trim());
  }

  const hasRelative =
    form.relative_full_name.trim() ||
    form.relative_relation_type.trim() ||
    form.relative_phone.trim() ||
    form.relative_work_place.trim();

  if (hasRelative) {
    chunks.push(
      [
        '=== RELATIVE ===',
        `ФИО: ${form.relative_full_name.trim() || '-'}`,
        `Кем приходится: ${form.relative_relation_type.trim() || '-'}`,
        `Телефон: ${form.relative_phone.trim() || '-'}`,
        `Место работы: ${form.relative_work_place.trim() || '-'}`,
      ].join('\n')
    );
  }

  if (form.contract_notes.trim()) {
    chunks.push(['=== CONTRACT NOTES ===', form.contract_notes.trim()].join('\n'));
  }

  return chunks.filter(Boolean).join('\n\n');
}

function buildStructuredTasks(form: FormState) {
  const chunks: string[] = [];

  if (form.current_tasks.trim()) {
    chunks.push(form.current_tasks.trim());
  }

  if (form.doc_notes.trim()) {
    chunks.push(['=== DOC PREP ===', form.doc_notes.trim()].join('\n'));
  }

  return chunks.filter(Boolean).join('\n\n');
}

function formatDateHint(value: string) {
  if (!value.trim()) return 'Например: 2004-09-21';
  return value;
}

const InputField = memo(function InputField({
  theme,
  label,
  value,
  placeholder,
  onChangeText,
  multiline = false,
  keyboardType = 'default',
  required = false,
  hint,
}: InputFieldProps) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        {label}
        {required ? ' *' : ''}
      </Text>

      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: theme.backgroundSoft,
            borderColor: theme.border,
            minHeight: multiline ? 104 : 58,
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCorrect={false}
          autoCapitalize="none"
          style={[
            styles.input,
            {
              color: theme.text,
              minHeight: multiline ? 82 : 24,
              textAlignVertical: multiline ? 'top' : 'center',
            },
          ]}
        />
      </View>

      {hint ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
});

const ToggleRow = memo(function ToggleRow({
  theme,
  label,
  value,
  onChange,
  hint,
}: ToggleRowProps) {
  return (
    <View style={styles.toggleWrap}>
      <View style={{ flex: 1, paddingRight: 14 }}>
        <Text style={[styles.toggleLabel, { color: theme.text }]}>{label}</Text>
        {hint ? <Text style={[styles.toggleHint, { color: theme.textSecondary }]}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
});

const SectionCard = memo(function SectionCard({
  theme,
  icon,
  title,
  subtitle,
  children,
}: SectionCardProps) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={styles.sectionHeader}>
        <View
          style={[
            styles.sectionIcon,
            { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
          ]}
        >
          <Ionicons name={icon} size={20} color={theme.blue} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>

      {children}
    </View>
  );
});

export default function AddClientScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [submitLoading, setSubmitLoading] = useState(false);
  const [form, setForm] = useState<FormState>({
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

    relative_full_name: '',
    relative_relation_type: '',
    relative_phone: '',
    relative_work_place: '',

    doc_notes: '',
    contract_notes: '',
  });

  const canSubmit = useMemo(() => {
    return (
      !!form.full_name.trim() &&
      !!form.phone.trim() &&
      !!form.city.trim() &&
      !submitLoading
    );
  }, [form.full_name, form.phone, form.city, submitLoading]);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const submit = async () => {
    if (!form.full_name.trim() || !form.phone.trim() || !form.city.trim()) {
      Alert.alert('Ошибка', 'Обязательные поля: ФИО, телефон, город.');
      return;
    }

    if (form.email.trim() && !form.email.includes('@')) {
      Alert.alert('Ошибка', 'Проверь email.');
      return;
    }

    if (form.is_partner_client && !form.partner_name.trim()) {
      Alert.alert('Ошибка', 'Укажи название партнёра.');
      return;
    }

    setSubmitLoading(true);

    try {
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
        partner_name: form.is_partner_client ? form.partner_name.trim() : '',
        has_discount: form.has_discount,
        discount_amount: form.has_discount ? normalizeDecimal(form.discount_amount) : 0,

        current_tasks: buildStructuredTasks(form),
        comments: buildStructuredComments(form),
      };

      const response = await apiClient.post('clients/', payload);
      const created = response?.data;

      Alert.alert('Готово', 'Клиент успешно создан.', [
        {
          text: 'Открыть карточку',
          onPress: () => {
            if (created?.id) {
              router.replace(`/(app)/client/${created.id}` as any);
            } else {
              router.replace('/(app)/crm' as any);
            }
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Ошибка сервера', flattenServerError(error?.response?.data));
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
            styles.hero,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.heroTitle, { color: theme.text }]}>
            Анкета клиента
          </Text>
          <Text style={[styles.heroText, { color: theme.textSecondary }]}>
            Все основные поля собраны в одной форме.
          </Text>
        </View>

        <SectionCard
          theme={theme}
          icon="person-outline"
          title="Основная информация"
          subtitle="Главные поля, которые нужны для карточки клиента"
        >
          <InputField
            theme={theme}
            label="ФИО"
            value={form.full_name}
            onChangeText={(value) => setField('full_name', value)}
            placeholder="Введите полное имя клиента"
            required
          />
          <InputField
            theme={theme}
            label="Телефон"
            value={form.phone}
            onChangeText={(value) => setField('phone', value)}
            placeholder="+993..."
            keyboardType="phone-pad"
            required
          />
          <InputField
            theme={theme}
            label="Email"
            value={form.email}
            onChangeText={(value) => setField('email', value)}
            placeholder="mail@example.com"
            keyboardType="email-address"
          />
          <InputField
            theme={theme}
            label="Город"
            value={form.city}
            onChangeText={(value) => setField('city', value)}
            placeholder="Ашхабад"
            required
          />
          <InputField
            theme={theme}
            label="Дата рождения"
            value={form.dob}
            onChangeText={(value) => setField('dob', value)}
            placeholder="YYYY-MM-DD"
            hint={formatDateHint(form.dob)}
          />
          <InputField
            theme={theme}
            label="Гражданство"
            value={form.citizenship}
            onChangeText={(value) => setField('citizenship', value)}
            placeholder="Туркменистан"
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Статус клиента</Text>
          <View style={styles.chipsWrap}>
            {STATUS_OPTIONS.map((item) => {
              const active = form.status === item.value;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => setField('status', item.value)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? theme.blue : theme.backgroundSoft,
                      borderColor: active ? theme.blue : theme.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={16}
                    color={active ? '#fff' : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? '#fff' : theme.text },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ToggleRow
            theme={theme}
            label="Приоритетный клиент"
            value={form.is_priority}
            onChange={(v) => setField('is_priority', v)}
            hint="Приоритетного клиента проще выделять в CRM и не терять среди остальных"
          />
        </SectionCard>

        <SectionCard
          theme={theme}
          icon="card-outline"
          title="Паспорт и регистрация"
          subtitle="Данные для договора и оформления"
        >
          <InputField
            theme={theme}
            label="Внутренний паспорт"
            value={form.passport_local_num}
            onChangeText={(value) => setField('passport_local_num', value)}
            placeholder="Серия / номер"
          />
          <InputField
            theme={theme}
            label="Загранпаспорт"
            value={form.passport_inter_num}
            onChangeText={(value) => setField('passport_inter_num', value)}
            placeholder="Номер загранпаспорта"
          />
          <InputField
            theme={theme}
            label="Кем выдан паспорт"
            value={form.passport_issued_by}
            onChangeText={(value) => setField('passport_issued_by', value)}
            placeholder="Например: МВД Туркменистана"
          />
          <InputField
            theme={theme}
            label="Дата выдачи паспорта"
            value={form.passport_issued_date}
            onChangeText={(value) => setField('passport_issued_date', value)}
            placeholder="YYYY-MM-DD"
          />
          <InputField
            theme={theme}
            label="Адрес регистрации"
            value={form.address_registration}
            onChangeText={(value) => setField('address_registration', value)}
            placeholder="Полный адрес прописки"
            multiline
          />
          <InputField
            theme={theme}
            label="Заметки по договору"
            value={form.contract_notes}
            onChangeText={(value) => setField('contract_notes', value)}
            placeholder="Особые условия, доверенность, кто подписывает, что важно не забыть"
            multiline
          />
        </SectionCard>

        <SectionCard
          theme={theme}
          icon="people-outline"
          title="Родственник / контактное лицо"
          subtitle="Эти данные пойдут в комментарии структурированным блоком"
        >
          <InputField
            theme={theme}
            label="ФИО родственника"
            value={form.relative_full_name}
            onChangeText={(value) => setField('relative_full_name', value)}
            placeholder="ФИО"
          />
          <InputField
            theme={theme}
            label="Кем приходится"
            value={form.relative_relation_type}
            onChangeText={(value) => setField('relative_relation_type', value)}
            placeholder="Отец / мать / брат / сестра"
          />
          <InputField
            theme={theme}
            label="Телефон родственника"
            value={form.relative_phone}
            onChangeText={(value) => setField('relative_phone', value)}
            placeholder="+993..."
            keyboardType="phone-pad"
          />
          <InputField
            theme={theme}
            label="Место работы"
            value={form.relative_work_place}
            onChangeText={(value) => setField('relative_work_place', value)}
            placeholder="Где работает родственник"
          />

          <Text style={[styles.helper, { color: theme.textSecondary }]}>
            Когда добавишь nested create на backend, этот блок можно будет сразу
            отправлять в `relative`.
          </Text>
        </SectionCard>

        <SectionCard
          theme={theme}
          icon="business-outline"
          title="Партнёрство и скидка"
          subtitle="Финансовый блок клиента"
        >
          <ToggleRow
            theme={theme}
            label="Клиент от партнёра"
            value={form.is_partner_client}
            onChange={(v) => setField('is_partner_client', v)}
          />

          <InputField
            theme={theme}
            label="Название партнёра"
            value={form.partner_name}
            onChangeText={(value) => setField('partner_name', value)}
            placeholder="Название партнёра"
            hint="Обязательно, если включён режим «Клиент от партнёра»"
          />

          <ToggleRow
            theme={theme}
            label="Есть скидка"
            value={form.has_discount}
            onChange={(v) => setField('has_discount', v)}
          />

          <InputField
            theme={theme}
            label="Размер скидки"
            value={form.discount_amount}
            onChangeText={(value) => setField('discount_amount', value)}
            placeholder="0"
            keyboardType="numeric"
            hint="Можно хранить сумму или процент — как у тебя заведено в процессе"
          />
        </SectionCard>

        <SectionCard
          theme={theme}
          icon="briefcase-outline"
          title="Работа менеджера"
          subtitle="Что уже делается по клиенту и что ещё нужно"
        >
          <InputField
            theme={theme}
            label="Текущие задачи"
            value={form.current_tasks}
            onChangeText={(value) => setField('current_tasks', value)}
            placeholder="Что сейчас делаем по клиенту"
            multiline
          />
          <InputField
            theme={theme}
            label="Комментарий"
            value={form.comments}
            onChangeText={(value) => setField('comments', value)}
            placeholder="Любые важные комментарии"
            multiline
          />
          <InputField
            theme={theme}
            label="Подготовка документов"
            value={form.doc_notes}
            onChangeText={(value) => setField('doc_notes', value)}
            placeholder="Что собрано, что не хватает, что проверить"
            multiline
          />
        </SectionCard>

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
            <>
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.submitText}>Сохранить клиента</Text>
            </>
          )}
        </Pressable>

        <View style={{ height: 40 }} />
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
  hero: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 18,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  heroText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 18,
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
  hint: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  helper: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  chip: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  toggleWrap: {
    minHeight: 62,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  toggleHint: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  submitBtn: {
    minHeight: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
});