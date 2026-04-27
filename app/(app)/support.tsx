import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
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
import apiClient, { extractList } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

type CategoryValue = 'support' | 'admin' | 'bug' | 'idea' | 'feedback';

type SupportMessage = {
  id: number;
  category: CategoryValue;
  subject: string;
  message: string;
  status: 'new' | 'in_progress' | 'closed';
  admin_note?: string;
  created_at?: string;
  updated_at?: string;
};

const CATEGORIES: Array<{ value: CategoryValue; label: string; icon: keyof typeof Ionicons.glyphMap; hint: string }> = [
  { value: 'support', label: 'Поддержка', icon: 'help-buoy-outline', hint: 'Вопрос по работе приложения' },
  { value: 'admin', label: 'Админу', icon: 'shield-checkmark-outline', hint: 'Напрямую администратору' },
  { value: 'bug', label: 'Ошибка', icon: 'bug-outline', hint: 'Что-то не работает' },
  { value: 'idea', label: 'Идея', icon: 'bulb-outline', hint: 'Предложение улучшения' },
  { value: 'feedback', label: 'Отзыв', icon: 'chatbubble-ellipses-outline', hint: 'Обратная связь' },
];

function statusLabel(status: string) {
  if (status === 'new') return 'Новое';
  if (status === 'in_progress') return 'В работе';
  if (status === 'closed') return 'Закрыто';
  return status || '—';
}

function statusColor(status: string, theme: any) {
  if (status === 'closed') return '#1AAE6F';
  if (status === 'in_progress') return '#F59E0B';
  return theme.blue;
}

function categoryLabel(category: string) {
  return CATEGORIES.find((x) => x.value === category)?.label || category || 'Поддержка';
}

function formatDate(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function flattenError(error: any) {
  const data = error?.response?.data;
  return (
    data?.detail ||
    data?.subject?.[0] ||
    data?.message?.[0] ||
    data?.category?.[0] ||
    'Не удалось выполнить действие.'
  );
}

export default function SupportScreen() {
  const router = useRouter();
  const { theme, themeMode } = useTheme();
  const dark = themeMode === 'dark';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);

  const [category, setCategory] = useState<CategoryValue>('support');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const canSubmit = useMemo(() => {
    return subject.trim().length >= 3 && message.trim().length >= 5 && !saving;
  }, [message, saving, subject]);

  const openCount = useMemo(() => messages.filter((item) => item.status !== 'closed').length, [messages]);

  const loadMessages = async () => {
    try {
      const response = await apiClient.get('support/messages/?limit=50&offset=0');
      setMessages(extractList(response.data));
    } catch (error) {
      console.log('Support load error', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const submit = async () => {
    if (!canSubmit) return;

    setSaving(true);

    try {
      await apiClient.post('support/messages/', {
        category,
        subject: subject.trim(),
        message: message.trim(),
      });

      setSubject('');
      setMessage('');
      setCategory('support');
      await loadMessages();
      Alert.alert('Готово', 'Обращение отправлено администратору.');
    } catch (error: any) {
      Alert.alert('Ошибка', String(flattenError(error)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadMessages();
              }}
              tintColor={theme.blue}
            />
          }
        >
          <LinearGradient
            colors={dark ? ['#111827', '#1E3A8A'] : ['#2563EB', '#60A5FA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroTop}>
              <Pressable onPress={() => router.back()} style={styles.heroBackBtn}>
                <Ionicons name="arrow-back" size={21} color="#fff" />
              </Pressable>
              <View style={styles.heroBadge}>
                <Ionicons name="chatbox-ellipses-outline" size={15} color="#fff" />
                <Text style={styles.heroBadgeText}>{openCount} открыто</Text>
              </View>
            </View>

            <Text style={styles.heroKicker}>ManagerSL Support</Text>
            <Text style={styles.heroTitle}>Поддержка</Text>
            <Text style={styles.heroSubtitle}>Напиши администратору, сообщи об ошибке или оставь идею. Сообщение появится в админке сайта.</Text>
          </LinearGradient>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Новое обращение</Text>
            <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>Выбери тип и опиши ситуацию нормально, чтобы админ быстро понял проблему.</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {CATEGORIES.map((item) => {
                const active = category === item.value;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setCategory(item.value)}
                    style={[
                      styles.categoryPill,
                      {
                        backgroundColor: active ? theme.blue : theme.backgroundSoft,
                        borderColor: active ? theme.blue : theme.border,
                      },
                    ]}
                  >
                    <Ionicons name={item.icon} size={17} color={active ? '#fff' : theme.blue} />
                    <View>
                      <Text style={[styles.categoryText, { color: active ? '#fff' : theme.text }]}>{item.label}</Text>
                      <Text style={[styles.categoryHint, { color: active ? 'rgba(255,255,255,0.78)' : theme.textSecondary }]}>{item.hint}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Тема</Text>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="Например: Не открывается проект"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text }]}
                returnKeyType="next"
              />
            </View>

            <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Сообщение</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Напиши подробно: где нажал, что ожидал, какая ошибка появилась..."
                placeholderTextColor={theme.textMuted}
                style={[styles.input, styles.textarea, { color: theme.text }]}
                multiline
                textAlignVertical="top"
              />
            </View>

            <Pressable
              onPress={submit}
              disabled={!canSubmit}
              style={[styles.submitBtn, { backgroundColor: theme.blue, opacity: canSubmit ? 1 : 0.55 }]}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="send-outline" size={18} color="#fff" />}
              <Text style={styles.submitText}>{saving ? 'Отправка...' : 'Отправить администратору'}</Text>
            </Pressable>
          </View>

          <View style={styles.historyHeader}>
            <Text style={[styles.historyTitle, { color: theme.text }]}>История обращений</Text>
            <Pressable onPress={loadMessages} style={[styles.refreshBtn, { backgroundColor: theme.blueSoft }]}>
              <Ionicons name="refresh" size={17} color={theme.blue} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={theme.blue} />
            </View>
          ) : messages.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="chatbubbles-outline" size={38} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Пока обращений нет.</Text>
            </View>
          ) : (
            messages.map((item) => {
              const color = statusColor(item.status, theme);
              return (
                <View key={item.id} style={[styles.messageCard, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
                  <View style={styles.messageTop}>
                    <View style={[styles.messageIcon, { backgroundColor: `${color}18` }]}>
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.messageTitle, { color: theme.text }]}>{item.subject}</Text>
                      <Text style={[styles.messageMeta, { color: theme.textSecondary }]}>{categoryLabel(item.category)} · {formatDate(item.created_at)}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: `${color}18` }]}>
                      <Text style={[styles.statusText, { color }]}>{statusLabel(item.status)}</Text>
                    </View>
                  </View>
                  <Text style={[styles.messageBody, { color: theme.textSecondary }]}>{item.message}</Text>
                  {!!item.admin_note && (
                    <View style={[styles.adminNote, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                      <Text style={[styles.adminNoteTitle, { color: theme.text }]}>Ответ администратора</Text>
                      <Text style={[styles.adminNoteText, { color: theme.textSecondary }]}>{item.admin_note}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 128, gap: 14 },
  hero: { borderRadius: 32, padding: 18, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 },
  heroBackBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  heroBadge: { minHeight: 38, borderRadius: 999, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.16)', flexDirection: 'row', gap: 7, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  heroBadgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  heroKicker: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  heroTitle: { marginTop: 8, color: '#fff', fontSize: 31, fontWeight: '900', letterSpacing: -0.4 },
  heroSubtitle: { marginTop: 8, color: 'rgba(255,255,255,0.84)', fontSize: 14, fontWeight: '700', lineHeight: 20, maxWidth: 330 },
  card: { borderWidth: 1, borderRadius: 28, padding: 16, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  sectionSub: { marginTop: 6, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  categoryRow: { gap: 8, paddingVertical: 14 },
  categoryPill: { minWidth: 155, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 9, alignItems: 'center' },
  categoryText: { fontSize: 12.5, fontWeight: '900' },
  categoryHint: { marginTop: 2, fontSize: 10.5, fontWeight: '700' },
  inputWrap: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, marginTop: 10 },
  inputLabel: { fontSize: 12, fontWeight: '900', marginBottom: 8 },
  input: { minHeight: 26, fontSize: 15, fontWeight: '700' },
  textarea: { minHeight: 130, lineHeight: 21 },
  submitBtn: { marginTop: 14, borderRadius: 20, minHeight: 56, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyTitle: { fontSize: 19, fontWeight: '900' },
  refreshBtn: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  centerBox: { paddingVertical: 30 },
  emptyBox: { borderWidth: 1, borderRadius: 24, padding: 26, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 14, fontWeight: '700' },
  messageCard: { borderWidth: 1, borderRadius: 24, padding: 15, gap: 11, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 2 },
  messageTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  messageIcon: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  messageTitle: { fontSize: 15, fontWeight: '900' },
  messageMeta: { marginTop: 4, fontSize: 12, fontWeight: '700' },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  statusText: { fontSize: 11, fontWeight: '900' },
  messageBody: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  adminNote: { borderWidth: 1, borderRadius: 18, padding: 12 },
  adminNoteTitle: { fontSize: 13, fontWeight: '900' },
  adminNoteText: { marginTop: 6, fontSize: 13, fontWeight: '600', lineHeight: 19 },
});