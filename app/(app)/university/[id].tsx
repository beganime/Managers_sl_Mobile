import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import ScreenWrapper from '../../../components/ScreenWrapper';
import apiClient, { fetchAllPages } from '../../../src/api/apiClient';
import { useTheme } from '../../../src/context/ThemeContext';
import { getToken, saveToken } from '../../../src/utils/storage';

const degreeMap: Record<string, string> = {
  bachelor: 'Бакалавриат',
  master: 'Магистратура',
  specialist: 'Специалитет',
  language: 'Языковые курсы',
};

function stripHtml(html?: string) {
  return String(html || '')
    .replace(/<[^>]*>?/gm, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

function currencyText(currency?: any) {
  if (!currency) return 'USD';
  return currency.symbol || currency.code || 'USD';
}

function moneyLocal(value: any, currency?: any) {
  if (value === null || value === undefined || value === '') return '—';
  const suffix = currencyText(currency);
  return `${Number(value).toLocaleString('ru-RU')} ${suffix}`.trim();
}

function InfoBlock({
  theme,
  title,
  content,
  icon,
}: {
  theme: any;
  title: string;
  content?: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  if (!content) return null;
  const cleanContent = stripHtml(content);
  if (!cleanContent) return null;

  return (
    <Pressable
      onPress={async () => {
        await Clipboard.setStringAsync(cleanContent);
        Alert.alert('Скопировано', `${title} скопировано в буфер обмена`);
      }}
      style={[
        styles.infoBlock,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={styles.infoHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
            ]}
          >
            <Ionicons name={icon} size={18} color={theme.blue} />
          </View>
          <Text style={[styles.infoTitle, { color: theme.text }]}>{title}</Text>
        </View>

        <Ionicons name="copy-outline" size={18} color={theme.textSecondary} />
      </View>

      <Text style={[styles.infoContent, { color: theme.textSecondary }]}>
        {cleanContent}
      </Text>
    </Pressable>
  );
}

export default function UniversityDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { theme } = useTheme();

  const [uni, setUni] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadUni = async () => {
    try {
      const cached = await getToken('cache_universities_full');
      if (cached) {
        const unis = JSON.parse(cached);
        const found = unis.find((u: any) => String(u.id) === String(id));
        if (found) {
          setUni(found);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      const fetched = await fetchAllPages('catalog/universities/');
      await saveToken('cache_universities_full', JSON.stringify(fetched || []));
      const found = (fetched || []).find((u: any) => String(u.id) === String(id));
      setUni(found || null);
    } catch (error) {
      console.error('Ошибка загрузки ВУЗа', error);
      try {
        const response = await apiClient.get(`catalog/universities/${id}/`);
        setUni(response.data);
      } catch {
        Alert.alert('Ошибка', 'Не удалось загрузить карточку ВУЗа.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUni();
  }, [id]);

  const programs = useMemo(() => uni?.programs || [], [uni]);

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
          <Text style={[styles.errorText, { color: theme.red }]}>ВУЗ не найден</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace('/(app)/catalog' as any)}
          style={[
            styles.backBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: theme.text }]}>Справочник ВУЗов</Text>

        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadUni();
            }}
            tintColor={theme.blue}
          />
        }
      >
        <View
          style={[
            styles.heroCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={[styles.heroIcon, { backgroundColor: theme.blueSoft }]}>
            <Ionicons name="school" size={28} color={theme.blue} />
          </View>

          <Text style={[styles.heroName, { color: theme.text }]}>{uni.name}</Text>
          <Text style={[styles.heroLocation, { color: theme.textSecondary }]}>
            {uni.city}, {uni.country}
          </Text>

          <View style={styles.heroMetaRow}>
            <View style={[styles.metaPill, { backgroundColor: theme.backgroundSoft }]}>
              <Text style={[styles.metaPillText, { color: theme.textSecondary }]}>
                {uni.local_currency?.code || 'USD'}
              </Text>
            </View>
            {!!uni.intake_period && (
              <View style={[styles.metaPill, { backgroundColor: theme.backgroundSoft }]}>
                <Text style={[styles.metaPillText, { color: theme.textSecondary }]}>
                  {uni.intake_period}
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Детальная информация
        </Text>
        <Text style={[styles.hintText, { color: theme.textSecondary }]}>
          Нажмите на блок, чтобы скопировать чистый текст.
        </Text>

        <InfoBlock
          theme={theme}
          title="Описание"
          content={uni.description || uni.about}
          icon="document-text"
        />
        <InfoBlock
          theme={theme}
          title="Требования к поступлению"
          content={uni.requirements}
          icon="checkmark-circle"
        />
        <InfoBlock
          theme={theme}
          title="Документы"
          content={uni.documents_required}
          icon="folder-open"
        />
        <InfoBlock
          theme={theme}
          title="Проживание"
          content={uni.accommodation}
          icon="home"
        />
        <InfoBlock
          theme={theme}
          title="Виза"
          content={uni.visa_info}
          icon="airplane"
        />

        <View
          style={[
            styles.infoBlock,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.smallLabel, { color: theme.textSecondary }]}>Период приёма</Text>
          <Text style={[styles.smallValue, { color: theme.text }]}>
            {uni.intake_period || 'Не указан'}
          </Text>

          <View style={[styles.divider, { backgroundColor: theme.divider }]} />

          <Text style={[styles.smallLabel, { color: theme.textSecondary }]}>Возраст</Text>
          <Text style={[styles.smallValue, { color: theme.text }]}>
            {uni.age_limit || 'Нет ограничений'}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 18 }]}>
          Программы
        </Text>

        <View style={{ gap: 12 }}>
          {programs.length === 0 ? (
            <View
              style={[
                styles.infoBlock,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={{ color: theme.textSecondary }}>Программы пока не указаны.</Text>
            </View>
          ) : (
            programs.map((program: any) => {
              const programCurrency =
                program.currency || uni.local_currency || { code: 'USD', symbol: '$' };

              return (
                <View
                  key={program.id}
                  style={[
                    styles.programCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.programTitle, { color: theme.text }]}>{program.name}</Text>
                  <Text style={[styles.programMeta, { color: theme.textSecondary }]}>
                    {degreeMap[program.degree] || program.degree || 'Программа'} ·{' '}
                    {program.duration || '-'}
                  </Text>

                  <View style={styles.programRow}>
                    <View style={[styles.programPill, { backgroundColor: theme.backgroundSoft }]}>
                      <Text style={[styles.programPillText, { color: theme.textSecondary }]}>
                        Обучение: {moneyLocal(program.tuition_fee, programCurrency)}
                      </Text>
                    </View>

                    <View style={[styles.programPill, { backgroundColor: theme.backgroundSoft }]}>
                      <Text style={[styles.programPillText, { color: theme.textSecondary }]}>
                        Услуги: {moneyLocal(program.service_fee, programCurrency)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
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
    paddingBottom: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  errorText: { fontSize: 16, textAlign: 'center', fontWeight: '700' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  heroCard: {
    padding: 24,
    borderRadius: 28,
    marginBottom: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  heroIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 28,
  },
  heroLocation: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  metaPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  metaPillText: { fontSize: 11, fontWeight: '900' },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 6,
    marginLeft: 4,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  hintText: {
    fontSize: 12,
    marginBottom: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  infoBlock: {
    padding: 18,
    borderRadius: 22,
    marginBottom: 12,
    borderWidth: 1,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: { fontSize: 16, fontWeight: '900', flex: 1 },
  infoContent: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  smallLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontWeight: '800',
  },
  smallValue: { fontSize: 15, fontWeight: '800' },
  divider: { height: 1, marginVertical: 14 },
  programCard: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
  },
  programTitle: { fontSize: 16, fontWeight: '900' },
  programMeta: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  programRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  programPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  programPillText: { fontSize: 12, fontWeight: '800' },
});