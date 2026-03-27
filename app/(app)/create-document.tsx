// app/(app)/create-document.tsx
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

  const [templates, setTemplates] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [selectedDealId, setSelectedDealId] = useState<string>(
    params.dealId ? String(params.dealId) : ''
  );
  const [formData, setFormData] = useState<Record<string, string>>({});

  const loadData = async () => {
    try {
      const [tplData, dealData] = await Promise.all([
        fetchAllPages('documents/templates/').catch(() => []),
        fetchAllPages('analytics/deals/').catch(() => []),
      ]);

      setTemplates(tplData || []);
      setDeals(dealData || []);

      if ((tplData || []).length > 0) {
        setSelectedTemplate((prev: any) => prev || tplData[0]);
      }

      if (!params.dealId && (dealData || []).length > 0) {
        setSelectedDealId((prev) => prev || String(dealData[0].id));
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
    loadData();
  }, []);

  const selectedDeal = useMemo(
    () => deals.find((d) => String(d.id) === String(selectedDealId)),
    [deals, selectedDealId]
  );

  const fields = useMemo(() => {
    if (!selectedTemplate || !selectedTemplate.fields_config) return [];
    try {
      return Array.isArray(selectedTemplate.fields_config)
        ? selectedTemplate.fields_config
        : JSON.parse(selectedTemplate.fields_config);
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

      if (clientTitle) {
        payload.title = `${selectedTemplate.title} — ${clientTitle}`;
      }

      const res = await apiClient.post('documents/generated/', payload);

      const createdDoc = res.data;

      Alert.alert(
        'Готово',
        createdDoc?.status === 'generated'
          ? 'Документ сгенерирован и отправлен на одобрение администратору.'
          : 'Документ создан.',
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

        <Text style={[styles.title, { color: theme.text }]}>Создать документ</Text>

        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              tintColor={theme.blue}
            />
          }
        >
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              1. Шаблон
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipsRow}>
                {templates.map((tpl) => {
                  const active = selectedTemplate?.id === tpl.id;
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
                      <Ionicons
                        name={active ? 'document-text' : 'document-text-outline'}
                        size={16}
                        color={active ? '#fff' : theme.textSecondary}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={{
                          color: active ? '#fff' : theme.text,
                          fontWeight: '900',
                        }}
                      >
                        {tpl.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {selectedTemplate?.description ? (
              <View
                style={[
                  styles.noteCard,
                  { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
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
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              2. Сделка
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipsRow}>
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
                      <Text
                        style={{
                          color: active ? '#fff' : theme.text,
                          fontWeight: '900',
                        }}
                      >
                        {dealLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {selectedDeal ? (
              <View
                style={[
                  styles.noteCard,
                  { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.noteStrong, { color: theme.text }]}>
                  {selectedDeal.client_data?.full_name || selectedDeal.client_name || `Сделка #${selectedDeal.id}`}
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
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              3. Поля шаблона
            </Text>

            {fields.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Для этого шаблона нет динамических полей. Можно создать документ сразу.
              </Text>
            ) : (
              fields.map((field: any, index: number) => (
                <View key={`${field.key}-${index}`} style={{ marginBottom: 14 }}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    {field.label || field.key}
                    {field.is_required ? ' *' : ''}
                  </Text>

                  <View
                    style={[
                      styles.inputWrap,
                      {
                        backgroundColor: theme.backgroundSoft,
                        borderColor: theme.border,
                        minHeight: field.field_type === 'textarea' ? 96 : 56,
                      },
                    ]}
                  >
                    <TextInput
                      value={formData[field.key] || ''}
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
                          textAlignVertical:
                            field.field_type === 'textarea' ? 'top' : 'center',
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
              style={[styles.submitBtn, { backgroundColor: theme.blue }]}
            >
              {generating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="document-text" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Сгенерировать документ</Text>
                </>
              )}
            </Pressable>

            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              После генерации документ попадает на проверку. Скачивание доступно только после одобрения администратором.
            </Text>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  title: { fontSize: 22, fontWeight: '900' },
  container: { padding: 20, paddingBottom: 120, gap: 14 },
  card: { borderWidth: 1, borderRadius: 24, padding: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  chipsRow: { flexDirection: 'row', gap: 8, paddingRight: 16 },
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
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  hint: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
});