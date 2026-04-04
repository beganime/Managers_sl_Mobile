import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import ScreenWrapper from '../../../components/ScreenWrapper';
import apiClient from '../../../src/api/apiClient';
import { useTheme } from '../../../src/context/ThemeContext';

type Currency = {
  id?: number;
  code?: string;
  name?: string;
  symbol?: string;
  rate?: string | number;
};

type Program = {
  id: number;
  name: string;
  degree?: string;
  tuition_fee?: number | string | null;
  service_fee?: number | string | null;
  duration?: string | null;
  currency?: Currency | null;
};

type University = {
  id: number;
  name: string;
  country?: string | null;
  city?: string | null;
  logo?: string | null;
  local_currency?: Currency | null;
  description?: string | null;
  expenses_info?: string | null;
  invitation_info?: string | null;
  intake_period?: string | null;
  age_limit?: string | null;
  required_docs?: string | null;
  contacts?: string | null;
  programs?: Program[];
};

const degreeMap: Record<string, string> = {
  bachelor: 'Бакалавриат',
  master: 'Магистратура',
  specialist: 'Специалитет',
  language: 'Языковые курсы',
};

function stripHtml(value?: string | null) {
  return String(value || '')
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function currencyText(currency?: Currency | null) {
  if (!currency) return 'USD';
  return currency.symbol || currency.code || 'USD';
}

function formatMoney(value: string | number | null | undefined, currency?: Currency | null) {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return `—`;
  return `${numeric.toLocaleString('ru-RU')} ${currencyText(currency)}`;
}

function Pill({
  label,
  value,
  theme,
  icon,
}: {
  label: string;
  value?: string | null;
  theme: any;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  if (!value) return null;

  return (
    <View
      style={[
        styles.metaPill,
        {
          backgroundColor: theme.backgroundSoft,
          borderColor: theme.border,
        },
      ]}
    >
      <Ionicons name={icon} size={14} color={theme.blue} />
      <Text style={[styles.metaPillLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.metaPillValue, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function InfoBlock({
  title,
  icon,
  content,
  theme,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  content?: string | null;
  theme: any;
}) {
  const clean = useMemo(() => stripHtml(content), [content]);

  if (!clean) return null;

  return (
    <View
      style={[
        styles.infoCard,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <View style={styles.infoHead}>
        <View style={[styles.infoIconWrap, { backgroundColor: theme.blueSoft }]}>
          <Ionicons name={icon} size={18} color={theme.blue} />
        </View>
        <Text style={[styles.infoTitle, { color: theme.text }]}>{title}</Text>
      </View>

      <Text style={[styles.infoText, { color: theme.textSecondary }]}>{clean}</Text>
    </View>
  );
}

function ProgramCard({
  item,
  theme,
  fallbackCurrency,
}: {
  item: Program;
  theme: any;
  fallbackCurrency?: Currency | null;
}) {
  const programCurrency = item.currency || fallbackCurrency || null;
  const degreeText = degreeMap[item.degree || ''] || item.degree || 'Программа';

  return (
    <View
      style={[
        styles.programCard,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <Text style={[styles.programTitle, { color: theme.text }]}>{item.name}</Text>

      <Text style={[styles.programMeta, { color: theme.textSecondary }]}>
        {degreeText}
        {item.duration ? ` · ${item.duration}` : ''}
      </Text>

      <View style={styles.programStats}>
        <View
          style={[
            styles.programStat,
            {
              backgroundColor: theme.backgroundSoft,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.programStatLabel, { color: theme.textSecondary }]}>
            Обучение
          </Text>
          <Text style={[styles.programStatValue, { color: theme.text }]}>
            {formatMoney(item.tuition_fee, programCurrency)}
          </Text>
        </View>

        <View
          style={[
            styles.programStat,
            {
              backgroundColor: theme.backgroundSoft,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.programStatLabel, { color: theme.textSecondary }]}>
            Наши услуги
          </Text>
          <Text style={[styles.programStatValue, { color: theme.text }]}>
            {formatMoney(item.service_fee, { code: 'USD', symbol: '$' })}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function UniversityDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { theme } = useTheme();

  const [uni, setUni] = useState<University | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadUniversity = useCallback(async () => {
    try {
      const response = await apiClient.get(`catalog/universities/${id}/`);
      setUni(response.data);
    } catch (error) {
      console.error('Ошибка загрузки ВУЗа', error);
      Alert.alert('Ошибка', 'Не удалось загрузить карточку вуза.');
      setUni(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    void loadUniversity();
  }, [loadUniversity]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadUniversity();
  }, [loadUniversity]);

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.blue} />
        </View>
      </ScreenWrapper>
    );
  }

  if (!uni) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <Ionicons name="school-outline" size={36} color={theme.textMuted} />
          <Text style={[styles.errorText, { color: theme.text }]}>ВУЗ не найден</Text>
        </View>
      </ScreenWrapper>
    );
  }

  const hasPrograms = Array.isArray(uni.programs) && uni.programs.length > 0;

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.blue} />}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View style={styles.topRow}>
            <View style={styles.backButtonWrap}>
              <Ionicons name="chevron-back" size={18} color={theme.text} onPress={() => router.back()} />
            </View>
          </View>

          {uni.logo ? (
            <Image source={{ uri: uni.logo }} style={styles.logo} resizeMode="cover" />
          ) : (
            <View style={[styles.heroIcon, { backgroundColor: theme.blueSoft }]}>
              <Ionicons name="school" size={34} color={theme.blue} />
            </View>
          )}

          <Text style={[styles.heroName, { color: theme.text }]}>{uni.name}</Text>

          <Text style={[styles.heroLocation, { color: theme.textSecondary }]}>
            {[uni.city, uni.country].filter(Boolean).join(', ') || 'Локация не указана'}
          </Text>

          <View style={styles.heroMetaGrid}>
            <Pill
              label="Валюта"
              value={uni.local_currency?.code || 'USD'}
              icon="cash-outline"
              theme={theme}
            />
            <Pill
              label="Набор"
              value={uni.intake_period || null}
              icon="calendar-outline"
              theme={theme}
            />
            <Pill
              label="Возраст"
              value={uni.age_limit || null}
              icon="person-outline"
              theme={theme}
            />
            <Pill
              label="Программ"
              value={String(uni.programs?.length || 0)}
              icon="book-outline"
              theme={theme}
            />
          </View>
        </View>

        <InfoBlock
          title="Описание"
          icon="information-circle-outline"
          content={uni.description}
          theme={theme}
        />

        <InfoBlock
          title="Расходы и проживание"
          icon="wallet-outline"
          content={uni.expenses_info}
          theme={theme}
        />

        <InfoBlock
          title="Приглашение"
          icon="mail-open-outline"
          content={uni.invitation_info}
          theme={theme}
        />

        <InfoBlock
          title="Нужные документы"
          icon="document-text-outline"
          content={uni.required_docs}
          theme={theme}
        />

        <InfoBlock
          title="Контакты"
          icon="call-outline"
          content={uni.contacts}
          theme={theme}
        />

        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Программы</Text>
          <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
            {hasPrograms ? `${uni.programs!.length} доступно` : 'Пока нет программ'}
          </Text>
        </View>

        {hasPrograms ? (
          <View style={styles.programsList}>
            {uni.programs!.map((program) => (
              <ProgramCard
                key={program.id}
                item={program}
                theme={theme}
                fallbackCurrency={uni.local_currency}
              />
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.emptyPrograms,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons name="albums-outline" size={24} color={theme.textMuted} />
            <Text style={[styles.emptyProgramsText, { color: theme.textSecondary }]}>
              Для этого вуза программы пока не добавлены
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 120,
    gap: 14,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 10,
  },
  backButtonWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 92,
    height: 92,
    borderRadius: 24,
    alignSelf: 'center',
    marginBottom: 14,
  },
  heroIcon: {
    width: 92,
    height: 92,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  heroName: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  heroLocation: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    textAlign: 'center',
  },
  heroMetaGrid: {
    marginTop: 18,
    gap: 10,
  },
  metaPill: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaPillLabel: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '800',
  },
  metaPillValue: {
    marginLeft: 'auto',
    fontSize: 13,
    fontWeight: '900',
    flexShrink: 1,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  infoHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  sectionHead: {
    marginTop: 2,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  sectionSub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
  },
  programsList: {
    gap: 12,
  },
  programCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  programTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  programMeta: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  programStats: {
    marginTop: 14,
    gap: 10,
  },
  programStat: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  programStatLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  programStatValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  emptyPrograms: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyProgramsText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
});