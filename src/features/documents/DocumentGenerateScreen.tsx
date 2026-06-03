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
import { SectionTitle } from '../../components/ui/SectionTitle';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { theme } from '../../theme/theme';
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

export function DocumentGenerateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const [title, setTitle] = useState('');
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

  const submit = async () => {
    const missing = fields.filter((field) => {
      if (!field.is_required) return false;
      if (String(fieldValues[field.key] || '').trim()) return false;
      return !sourceIsCovered(field, { client: clientId, application: applicationId, deal: dealId });
    });

    if (missing.length) {
      Alert.alert('Создание документа', `Заполните обязательные поля: ${missing.map((field) => field.label).join(', ')}`);
      return;
    }

    setSaving(true);

    try {
      const contextData: Record<string, unknown> = {};
      fields.forEach((field) => {
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

      const saved = await generateDocumentFromTemplate(id, {
        title: title.trim() || getEntityTitle(data?.template, 'Документ'),
        comment: comment.trim(),
        client: clientId || undefined,
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
        <Text style={styles.heroKicker}>Document generator</Text>
        <Text style={styles.heroTitle}>{getEntityTitle(data.template, 'Шаблон')}</Text>
        <Text style={styles.heroText}>
          Выберите связанный объект и заполните поля шаблона. Документ сформируется без ручной вставки технических данных.
        </Text>
      </Card>

      <Card style={styles.form}>
        <Input
          label="Название документа"
          placeholder={getEntityTitle(data.template, 'Документ')}
          value={title}
          onChangeText={setTitle}
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

      <SelectableSection
        title="Клиент"
        icon="person-outline"
        items={data.clients}
        selectedId={clientId}
        empty="Клиенты не найдены"
        onSelect={setClientId}
      />
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
        {fields.length ? (
          fields.map((field) => (
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
  return (
    <Card style={styles.selectCard}>
      <View style={styles.selectHeader}>
        <View style={styles.selectIcon}>
          <Ionicons name={icon} size={18} color={theme.colors.primary} />
        </View>
        <Text style={styles.selectTitle}>{title}</Text>
        {selectedId ? (
          <Pressable onPress={() => onSelect('')} style={styles.clearButton}>
            <Text style={styles.clearText}>Сбросить</Text>
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
                style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.chipTitle, active && styles.chipTextActive]} numberOfLines={1}>
                  {getEntityTitle(item, title)}
                </Text>
                {subtitle ? (
                  <Text style={[styles.chipSubtitle, active && styles.chipTextActive]} numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={styles.emptyText}>{empty}</Text>
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
  const options = Array.isArray(field.options)
    ? field.options.map((option) => String(option))
    : [];
  const placeholder = options.length ? `Варианты: ${options.join(', ')}` : field.help_text || field.label;

  if (field.field_type === 'boolean') {
    return (
      <View style={styles.booleanWrap}>
        <Text style={styles.fieldLabel}>{field.label}{field.is_required ? ' *' : ''}</Text>
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
  return (
    <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}>
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
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
