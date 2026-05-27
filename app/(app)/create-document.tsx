import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient, { fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import { safeGoBack } from '../../src/navigation/safeGoBack';

type TemplateField = {
  key: string;
  label?: string;
  is_required?: boolean;
  field_type?: 'text' | 'textarea' | 'numeric' | 'date';
};

type TemplateItem = {
  id: number;
  title?: string;
  name?: string;
  description?: string;
  fields_config?: TemplateField[] | string | null;
};

type DealItem = {
  id: number;
  deal_type?: string;
  total_to_pay_usd?: number | string | null;
  client_data?: {
    full_name?: string;
  };
  client_name?: string;
};

function flattenServerError(data: any): string {
  if (!data) return 'Не удалось создать документ.';
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return data.map((x) => String(x)).join('\n');
  if (typeof data === 'object') {
    return Object.entries(data)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
      .join('\n');
  }
  return 'Не удалось создать документ.';
}

export default function CreateDocumentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ dealId?: string; clientName?: string }>();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [selectedDealId, setSelectedDealId] = useState(params.dealId ? String(params.dealId) : '');
  const [formData, setFormData] = useState<Record<string, string>>({});

  const loadData = async () => {
    try {
      const [tplData, dealData] = await Promise.all([
        fetchAllPages('documents/templates/').catch(() => []),
        fetchAllPages('analytics/deals/').catch(() => []),
      ]);

      const safeTemplates = (tplData || []) as TemplateItem[];
      const safeDeals = (dealData || []) as DealItem[];

      setTemplates(safeTemplates);
      setDeals(safeDeals);

      if (safeTemplates.length > 0) {
        setSelectedTemplate((prev) => prev || safeTemplates[0]);
      }

      if (!params.dealId && safeDeals.length > 0) {
        setSelectedDealId((prev) => prev || String(safeDeals[0].id));
      }
    } catch (error) {
      console.error('Ошибка загрузки данных для документа', error);
      Alert.alert('Ошибка', 'Не удалось загрузить шаблоны документов.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectedDeal = useMemo(
    () => deals.find((d) => String(d.id) === String(selectedDealId)),
    [deals, selectedDealId]
  );

  const fields = useMemo<TemplateField[]>(() => {
    if (!selectedTemplate?.fields_config) return [];

    try {
      return Array.isArray(selectedTemplate.fields_config)
        ? selectedTemplate.fields_config
        : (JSON.parse(selectedTemplate.fields_config) as TemplateField[]);
    } catch {
      return [];
    }
  }, [selectedTemplate]);

  const setField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerate = async () => {
    if (!selectedTemplate?.id) {
      Alert.alert('Ошибка', 'Выберите шаблон.');
      return;
    }

    for (const field of fields) {
      if (field.is_required && !String(formData[field.key] || '').trim()) {
        Alert.alert('Ошибка', `Заполните обязательное поле: ${field.label || field.key}`);
        return;
      }
    }

    setGenerating(true);

    try {
      const payload: any = {
        template: Number(selectedTemplate.id),
        context_data: formData,
      };

      if (selectedDealId && Number.isFinite(Number(selectedDealId))) {
        payload.deal = Number(selectedDealId);
      }

      const clientTitle =
        params.clientName ||
        selectedDeal?.client_data?.full_name ||
        selectedDeal?.client_name ||
        '';

      const templateTitle =
        selectedTemplate.title ||
        selectedTemplate.name ||
        `Шаблон #${selectedTemplate.id}`;

      if (clientTitle) {
        payload.title = `${templateTitle} — ${clientTitle}`;
      } else {
        payload.title = templateTitle;
      }

      const res = await apiClient.post('documents/generated/', payload);
      const createdDoc = res.data;

      Alert.alert(
        'Готово',
        createdDoc?.status === 'approved'
          ? 'Документ уже одобрен.'
          : 'Документ создан и отправлен на проверку администратору.',
        [
          {
            text: 'К документам',
            onPress: () => router.replace('/(app)/documents' as any),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Ошибка сервера', flattenServerError(error?.response?.data));
    } finally {
      setGenerating(false);
    }
  };

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => safeGoBack(router, '/(app)/documents')}
            style={[
              styles.backBtn,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons name="chevron-back" size={18} color={theme.text} />
          </Pressable>

          <Text style={[styles.title, { color: theme.text }]}>Создать документ</Text>

          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            void loadData();
          }} tintColor={theme.blue} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>1. Шаблон</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {templates.map((tpl) => {
                const active = selectedTemplate?.id === tpl.id;
                const label = tpl.title || tpl.name || `Шаблон #${tpl.id}`;

                return (
                  <Pressable
                    key={tpl.id}
                    onPress={() => {
                      setSelectedTemplate(tpl);
                      setFormData({});
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? theme.blue : theme.surface,
                        borderColor: active ? theme.blue : theme.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '800' }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {selectedTemplate?.description ? (
              <View
                style={[
                  styles.noteCard,
                  {
                    backgroundColor: theme.backgroundSoft,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={[styles.noteText, { color: theme.textSecondary }]}>
                  {selectedTemplate.description}
                </Text>
              </View>
            ) : null}
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>2. Сделка</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {deals.map((deal) => {
                const active = String(selectedDealId) === String(deal.id);
                const dealLabel =
                  deal.client_data?.full_name ||
                  deal.client_name ||
                  `Сделка #${deal.id}`;

                return (
                  <Pressable
                    key={deal.id}
                    onPress={() => setSelectedDealId(String(deal.id))}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? theme.blue : theme.surface,
                        borderColor: active ? theme.blue : theme.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '800' }}>
                      {dealLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {selectedDeal ? (
              <View
                style={[
                  styles.noteCard,
                  {
                    backgroundColor: theme.backgroundSoft,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={[styles.noteStrong, { color: theme.text }]}>
                  {selectedDeal.client_data?.full_name ||
                    selectedDeal.client_name ||
                    `Сделка #${selectedDeal.id}`}
                </Text>
                <Text style={[styles.noteText, { color: theme.textSecondary }]}>
                  #{selectedDeal.id} · {selectedDeal.deal_type || 'deal'} · $
                  {Number(selectedDeal.total_to_pay_usd || 0).toFixed(2)}
                </Text>
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Сделка не выбрана. Можно создать документ и без привязки, но лучше привязывать к сделке.
              </Text>
            )}
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>3. Поля шаблона</Text>

            {fields.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Для этого шаблона нет динамических полей. Можно создать документ сразу.
              </Text>
            ) : (
              fields.map((field, index) => (
                <View key={`${field.key}-${index}`} style={{ marginBottom: 12 }}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    {field.label || field.key}
                    {field.is_required ? ' *' : ''}
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
                      value={String(formData[field.key] || '')}
                      onChangeText={(val) => setField(field.key, val)}
                      placeholder={`Введите ${String(field.label || field.key).toLowerCase()}`}
                      placeholderTextColor={theme.textMuted}
                      multiline={field.field_type === 'textarea'}
                      keyboardType={field.field_type === 'numeric' ? 'numeric' : 'default'}
                      style={[
                        styles.input,
                        {
                          color: theme.text,
                          minHeight: field.field_type === 'textarea' ? 72 : 24,
                          textAlignVertical: field.field_type === 'textarea' ? 'top' : 'center',
                        },
                      ]}
                    />
                  </View>
                </View>
              ))
            )}

            <Pressable
              onPress={handleGenerate}
              disabled={generating}
              style={[
                styles.submitBtn,
                {
                  backgroundColor: theme.blue,
                  opacity: generating ? 0.75 : 1,
                },
              ]}
            >
              {generating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Сгенерировать документ</Text>
                </>
              )}
            </Pressable>

            <Text style={[styles.hint, { color: theme.textMuted }]}>
              После генерации документ попадает на проверку.
              {'\n'}
              Скачивание доступно только после одобрения администратором.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
  },
  container: {
    padding: 20,
    paddingBottom: 120,
    gap: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteCard: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  noteStrong: {
    fontSize: 15,
    fontWeight: '900',
  },
  noteText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
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
  submitBtn: {
    marginTop: 12,
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  hint: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
});
