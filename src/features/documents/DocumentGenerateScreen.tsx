import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { extractItems, toApiError } from '../../api/client';
import { listApplications, listClients } from '../../api/crm';
import { generateDocumentFromTemplate, getDocumentTemplate } from '../../api/documents';
import { listDeals } from '../../api/finance';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { ApiListItem, EntityId } from '../../types';
import { getEntityId, getEntityString, getEntityTitle, getEntityValue } from '../../utils/entity';

type TemplateField = {
  id?: EntityId;
  key: string;
  jinja_key?: string;
  label: string;
  field_type?: string;
  data_source?: string;
  default_value?: string | number | boolean | null;
  options?: unknown;
  is_required?: boolean;
  help_text?: string;
};

type GeneratorData = {
  template: ApiListItem;
  clients: ApiListItem[];
  applications: ApiListItem[];
  deals: ApiListItem[];
};

type ClientMode = 'existing' | 'manual';

const clientModeOptions = [
  { label: 'Из базы', value: 'existing' },
  { label: 'Вручную', value: 'manual' },
];

function normalizeFields(template: ApiListItem): TemplateField[] {
  const raw = getEntityValue(template, ['fields_config', 'fields']);
  const fields = Array.isArray(raw) ? raw : [];

  return fields
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => {
      const key = String(item.key || item.jinja_key || '').trim();
      return {
        id: getEntityId(item),
        key,
        jinja_key: String(item.jinja_key || '').trim(),
        label: String(item.label || key || 'Поле документа'),
        field_type: String(item.field_type || 'text'),
        data_source: String(item.data_source || 'custom'),
        default_value: item.default_value as TemplateField['default_value'],
        options: item.options,
        is_required: item.is_required !== false,
        help_text: String(item.help_text || ''),
      };
    })
    .filter((field) => field.key);
}

function defaultFieldValue(field: TemplateField) {
  if (field.default_value === null || field.default_value === undefined) return '';
  return String(field.default_value);
}

function sourceIsCovered(field: TemplateField, selected: { client?: string; application?: string; deal?: string }) {
  if (field.data_source === 'client') return Boolean(selected.client);
  if (field.data_source === 'application') return Boolean(selected.application);
  if (field.data_source === 'deal') return Boolean(selected.deal);
  if (field.data_source === 'manager' || field.data_source === 'company' || field.data_source === 'office') return true;
  return false;
}

function isClientFioField(field: TemplateField) {
  return ['client_fio', 'client_full_name', 'client_name'].includes(field.key) ||
    ['client_fio', 'client_full_name', 'client_name'].includes(field.jinja_key || '');
}

function getClientDisplayName(client?: ApiListItem) {
  if (!client) return '';
  return getEntityString(client, ['full_name', 'client_name', 'fio', 'name', 'title']) || getEntityTitle(client, '');
}

export function DocumentGenerateScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const [clientMode, setClientMode] = useState<ClientMode>('existing');
  const [clientFio, setClientFio] = useState('');
  const [comment, setComment] = useState('');
  const [clientId, setClientId] = useState('');
  const [applicationId, setApplicationId] = useState('');
  const [dealId, setDealId] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loader = useCallback(async (): Promise<GeneratorData> => {
    const [template, clients, applications, deals] = await Promise.all([
      getDocumentTemplate(id),
      listClients({ limit: 12 }).catch(() => []),
      listApplications({ limit: 12 }).catch(() => []),
      listDeals({ limit: 12 }).catch(() => []),
    ]);

    return {
      template,
      clients: extractItems<ApiListItem>(clients),
      applications: extractItems<ApiListItem>(applications),
      deals: extractItems<ApiListItem>(deals),
    };
  }, [id]);

  const { data, loading, error, reload } = useAsyncResource(loader);
  const fields = useMemo(() => (data ? normalizeFields(data.template) : []), [data]);
  const visibleFields = useMemo(() => fields.filter((field) => !isClientFioField(field)), [fields]);
  const selectedClient = useMemo(
    () => data?.clients.find((client) => String(getEntityId(client) || '') === String(clientId)) || undefined,
    [clientId, data?.clients]
  );
  const templateTitle = getEntityTitle(data?.template, 'Документ');
  const trimmedClientFio = clientFio.trim();
  const generatedTitle = trimmedClientFio ? `${templateTitle} - ${trimmedClientFio}` : templateTitle;

  useEffect(() => {
    if (!fields.length) return;

    setFieldValues((current) => {
      const next = { ...current };
      fields.forEach((field) => {
        if (next[field.key] === undefined) {
          next[field.key] = defaultFieldValue(field);
        }
      });
      return next;
    });
  }, [fields]);

  useEffect(() => {
    if (clientMode !== 'existing') return;
    setClientFio(getClientDisplayName(selectedClient));
  }, [clientMode, selectedClient]);

  useEffect(() => {
    setFieldValues((current) => {
      if (current.client_fio === clientFio && current.client_full_name === clientFio && current.client_name === clientFio) {
        return current;
      }

      return {
        ...current,
        client_fio: clientFio,
        client_full_name: clientFio,
        client_name: clientFio,
      };
    });
  }, [clientFio]);

  const submit = async () => {
    const missing = fields.filter((field) => {
      if (!field.is_required) return false;
      if (isClientFioField(field)) return !trimmedClientFio;
      if (String(fieldValues[field.key] || '').trim()) return false;
      return !sourceIsCovered(field, {
        client: clientMode === 'existing' ? clientId : trimmedClientFio,
        application: applicationId,
        deal: dealId,
      });
    });

    if (missing.length) {
      Alert.alert('Создание документа', `Заполните обязательные поля: ${missing.map((field) => field.label).join(', ')}`);
      return;
    }

    setSaving(true);

    try {
      const contextData: Record<string, unknown> = {};
      fields.forEach((field) => {
        if (isClientFioField(field)) return;

        const value = String(fieldValues[field.key] || '').trim();
        if (!value) return;

        if (field.field_type === 'number') {
          const numericValue = Number(value.replace(',', '.'));
          contextData[field.key] = Number.isFinite(numericValue) ? numericValue : value;
        } else if (field.field_type === 'boolean') {
          contextData[field.key] = ['1', 'true', 'yes', 'да'].includes(value.toLowerCase());
        } else {
          contextData[field.key] = value;
        }

        if (field.jinja_key && field.jinja_key !== field.key) {
          contextData[field.jinja_key] = contextData[field.key];
        }
      });

      if (trimmedClientFio) {
        contextData.client_fio = trimmedClientFio;
        contextData.client_full_name = trimmedClientFio;
        contextData.client_name = trimmedClientFio;
      }

      const saved = await generateDocumentFromTemplate(id, {
        title: generatedTitle,
        client_fio: trimmedClientFio || undefined,
        comment: comment.trim(),
        client: clientMode === 'existing' && clientId ? clientId : undefined,
        application: applicationId || undefined,
        deal: dealId || undefined,
        context_data: contextData,
      });

      router.replace(`/(app)/documents-v2/generated/${getEntityId(saved)}` as any);
    } catch (requestError) {
      Alert.alert('Создание документа', toApiError(requestError).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <ScreenContainer>
        <Header title="Создать документ" showBack parentFallback="/(app)/documents-v2" />
        <LoadingState title="Открываем шаблон" />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer>
        <Header title="Создать документ" showBack parentFallback="/(app)/documents-v2" />
        <ErrorState message={error} actionTitle="Повторить" onAction={reload} />
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <Header title="Создать документ" showBack parentFallback="/(app)/documents-v2" />
        <EmptyState title="Шаблон не найден" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Header
        title="Создать документ"
        subtitle={getEntityTitle(data.template, 'Шаблон')}
        showBack
        parentFallback="/(app)/documents-v2"
      />

      <Card glass style={styles.hero}>
        <Text style={[styles.heroKicker, { color: appTheme.colors.accent }]}>Document generator</Text>
        <Text style={[styles.heroTitle, { color: appTheme.colors.text }]}>{getEntityTitle(data.template, 'Шаблон')}</Text>
        <Text style={[styles.heroText, { color: appTheme.colors.textMuted }]}>
          Выберите связанный объект и заполните поля шаблона. Документ сформируется без ручной вставки технических данных.
        </Text>
      </Card>

      <Card style={styles.form}>
        <Text style={[styles.fieldLabel, { color: appTheme.colors.textMuted }]}>Название документа</Text>
        <Text style={[styles.generatedTitle, { color: appTheme.colors.text }]}>{generatedTitle}</Text>
        <SegmentedControl
          options={clientModeOptions}
          value={clientMode}
          onChange={(value) => {
            const nextMode = value as ClientMode;
            setClientMode(nextMode);
            if (nextMode === 'manual') {
              setClientId('');
            }
          }}
        />
        <Input
          label="ФИО клиента"
          placeholder="Иванов Иван Иванович"
          value={clientFio}
          onChangeText={setClientFio}
        />
        <Input
          label="Комментарий"
          placeholder="Комментарий для согласования"
          value={comment}
          onChangeText={setComment}
          multiline
          style={styles.shortTextarea}
        />
      </Card>

      {clientMode === 'existing' ? (
        <SelectableSection
          title="Клиент"
          icon="person-outline"
          items={data.clients}
          selectedId={clientId}
          empty="Клиенты не найдены"
          onSelect={setClientId}
        />
      ) : (
        <Card style={styles.selectCard}>
          <Text style={[styles.selectTitle, { color: appTheme.colors.text }]}>Клиент вручную</Text>
          <Text style={[styles.emptyText, { color: appTheme.colors.textMuted }]}>
            Документ будет создан без привязки к клиенту из базы. В веб-кабинете колонка клиента останется пустой, а ФИО попадёт в поле client_fio.
          </Text>
        </Card>
      )}
      <SelectableSection
        title="Заявка"
        icon="school-outline"
        items={data.applications}
        selectedId={applicationId}
        empty="Заявки не найдены"
        onSelect={setApplicationId}
      />
      <SelectableSection
        title="Сделка"
        icon="receipt-outline"
        items={data.deals}
        selectedId={dealId}
        empty="Сделки не найдены"
        onSelect={setDealId}
      />

      <Card style={styles.form}>
        <SectionTitle
          title="Поля документа"
          subtitle={fields.length ? 'Заполните данные, которые нужны этому шаблону.' : 'У шаблона нет дополнительных полей.'}
        />
        {visibleFields.length ? (
          visibleFields.map((field) => (
            <TemplateFieldInput
              key={field.key}
              field={field}
              value={fieldValues[field.key] || ''}
              onChangeText={(value) => setFieldValues((current) => ({ ...current, [field.key]: value }))}
            />
          ))
        ) : null}

        <Button title="Сгенерировать документ" loading={saving} onPress={submit} />
      </Card>
    </ScreenContainer>
  );
}

const SelectableSection = memo(function SelectableSection({
  title,
  icon,
  items,
  selectedId,
  empty,
  onSelect,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: ApiListItem[];
  selectedId: string;
  empty: string;
  onSelect: (id: string) => void;
}) {
  const appTheme = useAppTheme();

  return (
    <Card style={styles.selectCard}>
      <View style={styles.selectHeader}>
        <View style={[styles.selectIcon, { backgroundColor: appTheme.colors.primarySoft }]}>
          <Ionicons name={icon} size={18} color={appTheme.colors.primary} />
        </View>
        <Text style={[styles.selectTitle, { color: appTheme.colors.text }]}>{title}</Text>
        {selectedId ? (
          <Pressable onPress={() => onSelect('')} style={[styles.clearButton, { backgroundColor: appTheme.colors.accentSoft }]}>
            <Text style={[styles.clearText, { color: appTheme.colors.accent }]}>Сбросить</Text>
          </Pressable>
        ) : null}
      </View>
      {items.length ? (
        <View style={styles.chips}>
          {items.slice(0, 12).map((item) => {
            const id = String(getEntityId(item) || '');
            const active = selectedId === id;
            const subtitle = getEntityString(item, ['phone', 'email', 'status', 'client_name', 'university_name']);

            return (
              <Pressable
                key={id}
                onPress={() => onSelect(active ? '' : id)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    borderColor: active ? appTheme.colors.primary : appTheme.colors.border,
                    backgroundColor: active ? appTheme.colors.primary : appTheme.colors.surfaceSoft,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipTitle, { color: active ? appTheme.colors.white : appTheme.colors.text }]} numberOfLines={1}>
                  {getEntityTitle(item, title)}
                </Text>
                {subtitle ? (
                  <Text style={[styles.chipSubtitle, { color: active ? appTheme.colors.white : appTheme.colors.textMuted }]} numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={[styles.emptyText, { color: appTheme.colors.textMuted }]}>{empty}</Text>
      )}
    </Card>
  );
});

function TemplateFieldInput({
  field,
  value,
  onChangeText,
}: {
  field: TemplateField;
  value: string;
  onChangeText: (value: string) => void;
}) {
  const appTheme = useAppTheme();
  const options = Array.isArray(field.options)
    ? field.options.map((option) => String(option))
    : [];
  const placeholder = options.length ? `Варианты: ${options.join(', ')}` : field.help_text || field.label;

  if (field.field_type === 'boolean') {
    return (
      <View style={styles.booleanWrap}>
        <Text style={[styles.fieldLabel, { color: appTheme.colors.textMuted }]}>{field.label}{field.is_required ? ' *' : ''}</Text>
        <View style={styles.booleanRow}>
          <Choice active={value === 'true'} label="Да" onPress={() => onChangeText('true')} />
          <Choice active={value === 'false'} label="Нет" onPress={() => onChangeText('false')} />
        </View>
      </View>
    );
  }

  return (
    <Input
      label={`${field.label}${field.is_required ? ' *' : ''}`}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      keyboardType={field.field_type === 'number' ? 'decimal-pad' : 'default'}
      multiline={field.field_type === 'textarea'}
      style={field.field_type === 'textarea' ? styles.textarea : undefined}
      autoCapitalize="sentences"
    />
  );
}

function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.choice,
        {
          borderColor: active ? appTheme.colors.primary : appTheme.colors.border,
          backgroundColor: active ? appTheme.colors.primary : appTheme.colors.surfaceSoft,
        },
      ]}
    >
      <Text style={[styles.choiceText, { color: active ? appTheme.colors.white : appTheme.colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: theme.spacing.md,
  },
  heroKicker: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  heroText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  form: {
    gap: theme.spacing.lg,
  },
  shortTextarea: {
    minHeight: 86,
    paddingTop: theme.spacing.md,
    textAlignVertical: 'top',
  },
  textarea: {
    minHeight: 132,
    paddingTop: theme.spacing.md,
    textAlignVertical: 'top',
  },
  selectCard: {
    gap: theme.spacing.md,
  },
  selectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  selectIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  selectTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  clearButton: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 7,
  },
  clearText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    minWidth: 132,
    maxWidth: '100%',
    flexGrow: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
    padding: theme.spacing.md,
    gap: 4,
  },
  chipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  chipTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  chipSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  chipTextActive: {
    color: theme.colors.white,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  fieldLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  generatedTitle: {
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 23,
  },
  booleanWrap: {
    gap: theme.spacing.sm,
  },
  booleanRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  choice: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
  },
  choiceActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  choiceText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '900',
  },
  choiceTextActive: {
    color: theme.colors.white,
  },
  pressed: {
    opacity: 0.72,
  },
});
