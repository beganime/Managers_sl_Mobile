// app/(app)/knowledge-base.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import { getToken, saveToken } from '../../src/utils/storage';

type Snippet = {
  id: number;
  title: string;
  content: string;
  category: string;
};

type Video = {
  id: number;
  title: string;
  description?: string;
  video_file?: string | null;
  youtube_url?: string | null;
};

type Question = {
  id: number;
  text: string;
  options: string[] | string;
  correct: number;
};

type Test = {
  id: number;
  title: string;
  description?: string;
  questions: Question[];
};

type TabKey = 'snippets' | 'videos' | 'tests';

const TABS: TabKey[] = ['snippets', 'videos', 'tests'];

const TAB_META: Record<TabKey, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  snippets: { label: 'База знаний', icon: 'library' },
  videos: { label: 'Видео', icon: 'play-circle' },
  tests: { label: 'Тесты', icon: 'checkmark-done-circle' },
};

const CATEGORY_LABELS: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  script: { label: 'Скрипты', icon: 'chatbubbles' },
  faq: { label: 'FAQ', icon: 'help-circle' },
  requisites: { label: 'Реквизиты', icon: 'card' },
  links: { label: 'Ссылки', icon: 'link' },
};

function normalizeOptions(options: any): string[] {
  if (Array.isArray(options)) return options.map((x) => String(x));
  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    } catch {}
  }
  return [];
}

function stripHtml(value?: string) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function KnowledgeBaseScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<TabKey>('snippets');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [tests, setTests] = useState<Test[]>([]);

  const [activeTest, setActiveTest] = useState<Test | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const cachedSnippets = await getToken('cache_snippets');
      const cachedVideos = await getToken('cache_videos');
      const cachedTests = await getToken('cache_tests');

      if (cachedSnippets) setSnippets(JSON.parse(cachedSnippets));
      if (cachedVideos) setVideos(JSON.parse(cachedVideos));
      if (cachedTests) setTests(JSON.parse(cachedTests));

      const [snipRes, videoRes, testsRes] = await Promise.allSettled([
        apiClient.get('documents/snippets/'),
        apiClient.get('gamification/tutorials/'),
        apiClient.get('documents/knowledge-tests/'),
      ]);

      if (snipRes.status === 'fulfilled') {
        const data = snipRes.value.data.results ?? snipRes.value.data;
        setSnippets(data);
        await saveToken('cache_snippets', JSON.stringify(data));
      }

      if (videoRes.status === 'fulfilled') {
        const data = videoRes.value.data.results ?? videoRes.value.data;
        setVideos(data);
        await saveToken('cache_videos', JSON.stringify(data));
      } else {
        setVideos((prev) => prev || []);
      }

      if (testsRes.status === 'fulfilled') {
        const data = testsRes.value.data.results ?? testsRes.value.data;
        setTests(data);
        await saveToken('cache_tests', JSON.stringify(data));
      }
    } catch {
      console.log('Офлайн режим: загружаем кэш базы знаний');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(snippets.map((s) => s.category))).filter(Boolean),
    [snippets]
  );

  const filteredSnippets = useMemo(() => {
    let res = snippets;
    if (activeCategory) res = res.filter((s) => s.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          stripHtml(s.content).toLowerCase().includes(q)
      );
    }
    return res;
  }, [snippets, activeCategory, search]);

  const filteredVideos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter(
      (v) =>
        String(v.title || '').toLowerCase().includes(q) ||
        String(v.description || '').toLowerCase().includes(q)
    );
  }, [videos, search]);

  const filteredTests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tests;
    return tests.filter((t) => String(t.title || '').toLowerCase().includes(q));
  }, [tests, search]);

  const copySnippet = async (item: Snippet) => {
    await Clipboard.setStringAsync(stripHtml(item.content));
    Alert.alert('Скопировано', `"${item.title}" скопировано в буфер обмена.`);
  };

  const openVideo = async (video: Video) => {
    const url = video.youtube_url || video.video_file;
    if (!url) {
      Alert.alert('Видео', 'У этого материала нет ссылки.');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Ошибка', 'Не удалось открыть видео.');
    }
  };

  const startTest = (test: Test) => {
    setActiveTest(test);
    setAnswers({});
    setShowResult(false);
  };

  const score = useMemo(() => {
    if (!activeTest) return 0;
    let result = 0;
    for (const question of activeTest.questions || []) {
      if (answers[question.id] === question.correct) result += 1;
    }
    return result;
  }, [activeTest, answers]);

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

        <Text style={[styles.title, { color: theme.text }]}>База знаний</Text>

        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData(true);
            }}
            tintColor={theme.blue}
          />
        }
      >
        <View
          style={[
            styles.searchBox,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Поиск по базе знаний"
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
          <View style={styles.tabRow}>
            {TABS.map((tab) => {
              const active = activeTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[
                    styles.tabBtn,
                    {
                      backgroundColor: active ? theme.blue : theme.surface,
                      borderColor: active ? theme.blue : theme.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={TAB_META[tab].icon}
                    size={16}
                    color={active ? '#fff' : theme.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '900' }}>
                    {TAB_META[tab].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {activeTab === 'snippets' && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 12 }}
            >
              <View style={styles.tabRow}>
                <Pressable
                  onPress={() => setActiveCategory('')}
                  style={[
                    styles.catBtn,
                    {
                      backgroundColor: activeCategory === '' ? theme.blue : theme.surface,
                      borderColor: activeCategory === '' ? theme.blue : theme.border,
                    },
                  ]}
                >
                  <Text style={{ color: activeCategory === '' ? '#fff' : theme.text, fontWeight: '900' }}>
                    Все
                  </Text>
                </Pressable>

                {categories.map((cat) => {
                  const active = activeCategory === cat;
                  const meta = CATEGORY_LABELS[cat] || {
                    label: cat,
                    icon: 'folder' as keyof typeof Ionicons.glyphMap,
                  };

                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setActiveCategory(cat)}
                      style={[
                        styles.catBtn,
                        {
                          backgroundColor: active ? theme.blue : theme.surface,
                          borderColor: active ? theme.blue : theme.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={meta.icon}
                        size={15}
                        color={active ? '#fff' : theme.textSecondary}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '900' }}>
                        {meta.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={{ gap: 12, marginTop: 16 }}>
              {filteredSnippets.length === 0 ? (
                <View
                  style={[
                    styles.card,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Text style={{ color: theme.textSecondary }}>Ничего не найдено.</Text>
                </View>
              ) : (
                filteredSnippets.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => copySnippet(item)}
                    style={[
                      styles.card,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
                    <Text style={[styles.cardText, { color: theme.textSecondary }]}>
                      {stripHtml(item.content)}
                    </Text>

                    <View style={styles.cardFooter}>
                      <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                        {CATEGORY_LABELS[item.category]?.label || item.category}
                      </Text>
                      <Text style={[styles.copyText, { color: theme.blue }]}>Нажми, чтобы скопировать</Text>
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          </>
        )}

        {activeTab === 'videos' && (
          <View style={{ gap: 12, marginTop: 16 }}>
            {filteredVideos.length === 0 ? (
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text style={{ color: theme.textSecondary }}>
                  Видео пока нет или endpoint с уроками недоступен.
                </Text>
              </View>
            ) : (
              filteredVideos.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => openVideo(item)}
                  style={[
                    styles.card,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.videoHead}>
                    <View style={[styles.videoIcon, { backgroundColor: theme.redSoft }]}>
                      <Ionicons name="play" size={18} color={theme.red} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
                      <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                        {item.youtube_url ? 'YouTube' : item.video_file ? 'Video file' : 'Без ссылки'}
                      </Text>
                    </View>
                  </View>

                  {!!item.description && (
                    <Text style={[styles.cardText, { color: theme.textSecondary }]}>
                      {item.description}
                    </Text>
                  )}
                </Pressable>
              ))
            )}
          </View>
        )}

        {activeTab === 'tests' && (
          <View style={{ gap: 12, marginTop: 16 }}>
            {filteredTests.length === 0 ? (
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text style={{ color: theme.textSecondary }}>Тесты пока не найдены.</Text>
              </View>
            ) : (
              filteredTests.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => startTest(item)}
                  style={[
                    styles.card,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
                  {!!item.description && (
                    <Text style={[styles.cardText, { color: theme.textSecondary }]}>
                      {item.description}
                    </Text>
                  )}
                  <Text style={[styles.copyText, { color: theme.blue }]}>
                    Открыть тест
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        <View style={{ height: 50 }} />
      </ScrollView>

      <Modal visible={!!activeTest} animationType="slide" onRequestClose={() => setActiveTest(null)}>
        <ScreenWrapper>
          <View style={styles.header}>
            <Pressable
              onPress={() => {
                setActiveTest(null);
                setShowResult(false);
              }}
              style={[
                styles.backBtn,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>

            <Text style={[styles.title, { color: theme.text }]}>Тест</Text>

            <View style={{ width: 44 }} />
          </View>

          <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            {activeTest && (
              <>
                <View
                  style={[
                    styles.card,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{activeTest.title}</Text>
                  {!!activeTest.description && (
                    <Text style={[styles.cardText, { color: theme.textSecondary }]}>
                      {activeTest.description}
                    </Text>
                  )}
                </View>

                {(activeTest.questions || []).map((q, index) => {
                  const options = normalizeOptions(q.options);

                  return (
                    <View
                      key={q.id}
                      style={[
                        styles.card,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                      ]}
                    >
                      <Text style={[styles.questionIndex, { color: theme.blue }]}>
                        Вопрос {index + 1}
                      </Text>
                      <Text style={[styles.questionText, { color: theme.text }]}>{q.text}</Text>

                      <View style={{ gap: 10, marginTop: 14 }}>
                        {options.map((opt, optIndex) => {
                          const chosen = answers[q.id] === optIndex;
                          const reveal = showResult;
                          const correct = q.correct === optIndex;

                          return (
                            <Pressable
                              key={`${q.id}-${optIndex}`}
                              onPress={() => !showResult && setAnswers((prev) => ({ ...prev, [q.id]: optIndex }))}
                              style={[
                                styles.optionBtn,
                                {
                                  backgroundColor: chosen ? theme.blueSoft : theme.backgroundSoft,
                                  borderColor: chosen ? theme.blue : theme.border,
                                },
                                reveal &&
                                  correct && {
                                    backgroundColor: '#EAF8EF',
                                    borderColor: theme.success,
                                  },
                                reveal &&
                                  chosen &&
                                  !correct && {
                                    backgroundColor: theme.redSoft,
                                    borderColor: theme.red,
                                  },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.optionText,
                                  { color: chosen ? theme.blue : theme.text },
                                  reveal && correct && { color: theme.success },
                                  reveal && chosen && !correct && { color: theme.red },
                                ]}
                              >
                                {opt}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}

                {!showResult ? (
                  <Pressable
                    onPress={() => setShowResult(true)}
                    style={[styles.submitTestBtn, { backgroundColor: theme.blue }]}
                  >
                    <Text style={styles.submitBtnText}>Проверить ответы</Text>
                  </Pressable>
                ) : (
                  <View
                    style={[
                      styles.card,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.cardTitle, { color: theme.text }]}>
                      Результат: {score} / {activeTest.questions?.length || 0}
                    </Text>
                    <Text style={[styles.cardText, { color: theme.textSecondary }]}>
                      {score === (activeTest.questions?.length || 0)
                        ? 'Отлично. Всё правильно.'
                        : 'Проверь ошибки и попробуй ещё раз.'}
                    </Text>
                  </View>
                )}

                <View style={{ height: 60 }} />
              </>
            )}
          </ScrollView>
        </ScreenWrapper>
      </Modal>
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
  container: { padding: 20, paddingBottom: 120 },
  searchBox: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '600' },
  tabRow: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  tabBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  catBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  cardText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  cardMeta: { marginTop: 4, fontSize: 12, fontWeight: '700' },
  copyText: { marginTop: 10, fontSize: 12, fontWeight: '900' },
  cardFooter: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  videoHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  videoIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionIndex: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  questionText: { marginTop: 8, fontSize: 16, lineHeight: 23, fontWeight: '800' },
  optionBtn: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionText: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  submitTestBtn: {
    marginTop: 14,
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});