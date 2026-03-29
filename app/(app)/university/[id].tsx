import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import ScreenWrapper from '../../../components/ScreenWrapper';
import apiClient from '../../../src/api/apiClient';
import { useTheme } from '../../../src/context/ThemeContext';

const degreeMap: Record<string, string> = {
  bachelor: 'Бакалавриат',
  master: 'Магистратура',
  specialist: 'Специалитет',
  language: 'Языковые курсы',
};

function stripHtml(html?: string) {
  return String(html || '').replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

function currencyText(currency?: any) {
  if (!currency) return 'USD';
  return currency.symbol || currency.code || 'USD';
}

function moneyLocal(value: any, currency?: any) {
  if (value === null || value === undefined || value === '') return '—';
  return `${Number(value).toLocaleString('ru-RU')} ${currencyText(currency)}`;
}

function InfoBlock({ theme, title, content, icon }: any) {
  if (!content) return null;
  const cleanContent = stripHtml(content);
  if (!cleanContent) return null;

  return (
    <View style={[styles.infoBlock, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.smallLabel, { color: theme.textSecondary }]}>{title}</Text>
      <Text style={[styles.smallValue, { color: theme.text }]}>{cleanContent}</Text>
    </View>
  );
}

export default function UniversityDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { theme } = useTheme();

  const [uni, setUni] = useState<any>(null);
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadUni = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`catalog/universities/${id}/`);
      setUni(response.data);
      setPrograms(response.data.programs || []);
    } catch (error) {
      console.error('Ошибка загрузки ВУЗа', error);
      Alert.alert('Ошибка', 'Не удалось загрузить карточку ВУЗа.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUni();
  }, [id]);

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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadUni(); }} tintColor={theme.blue} />
        }
      >
        <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: theme.blueSoft }]}>
            <Ionicons name="school" size={28} color={theme.blue} />
          </View>
          <Text style={[styles.heroName, { color: theme.text }]}>{uni.name}</Text>
          <Text style={[styles.heroLocation, { color: theme.textSecondary }]}>{uni.city}, {uni.country}</Text>
          <View style={styles.heroMetaRow}>
            <View style={[styles.metaPill, { backgroundColor: theme.backgroundSoft }]}>
              <Text style={[styles.metaPillText, { color: theme.textSecondary }]}>{uni.local_currency?.code || 'USD'}</Text>
            </View>
            {!!uni.intake_period && (
              <View style={[styles.metaPill, { backgroundColor: theme.backgroundSoft }]}>
                <Text style={[styles.metaPillText, { color: theme.textSecondary }]}>{uni.intake_period}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Детальная информация</Text>
        <InfoBlock theme={theme} title="Описание" content={uni.description || uni.about} icon="document-text" />
        <InfoBlock theme={theme} title="Требования" content={uni.requirements} icon="checkmark-circle" />
        <InfoBlock theme={theme} title="Документы" content={uni.documents_required} icon="folder-open" />
        <InfoBlock theme={theme} title="Проживание" content={uni.accommodation} icon="home" />
        <InfoBlock theme={theme} title="Виза" content={uni.visa_info} icon="airplane" />

        <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 18 }]}>Программы</Text>
        <FlatList
          data={programs}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const programCurrency = item.currency || uni.local_currency || { code: 'USD' };
            return (
              <View style={[styles.programCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.programTitle, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.programMeta, { color: theme.textSecondary }]}>
                  {degreeMap[item.degree] || item.degree || 'Программа'} · {item.duration || '-'}
                </Text>
                <View style={styles.programRow}>
                  <View style={[styles.programPill, { backgroundColor: theme.backgroundSoft }]}>
                    <Text style={[styles.programPillText, { color: theme.textSecondary }]}>
                      Обучение: {moneyLocal(item.tuition_fee, programCurrency)}
                    </Text>
                  </View>
                  <View style={[styles.programPill, { backgroundColor: theme.backgroundSoft }]}>
                    <Text style={[styles.programPillText, { color: theme.textSecondary }]}>
                      Услуги: {moneyLocal(item.service_fee, programCurrency)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadUni(); }} tintColor={theme.blue} />}
          contentContainerStyle={{ gap: 12, paddingBottom: 50 }}
        />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, textAlign: 'center', fontWeight: '700' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  heroCard: { padding: 24, borderRadius: 28, marginBottom: 20, borderWidth: 1, alignItems: 'center' },
  heroIcon: { width: 76, height: 76, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  heroName: { fontSize: 22, fontWeight: '900', textAlign: 'center', lineHeight: 28 },
  heroLocation: { marginTop: 8, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  heroMetaRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  metaPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  metaPillText: { fontSize: 11, fontWeight: '900' },
  sectionTitle: { fontSize: 12, fontWeight: '900', marginBottom: 6, marginLeft: 4, letterSpacing: 1, textTransform: 'uppercase' },
  programCard: { padding: 16, borderRadius: 22, borderWidth: 1 },
  programTitle: { fontSize: 16, fontWeight: '900' },
  programMeta: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  programRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  programPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  programPillText: { fontSize: 12, fontWeight: '800' },
});