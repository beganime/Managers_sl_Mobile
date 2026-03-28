import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { WebView } from 'react-native-webview';

import ScreenWrapper from '../../components/ScreenWrapper';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import apiClient from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import { getToken, saveToken } from '../../src/utils/storage';

type Snippet = {
  id: number;
  title: string;
  content: string;
  category: string;
  order?: number;
};

type VideoItem = {
  id: number;
  title: string;
  description?: string;
  video_file?: string | null;
  youtube_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

type Question = {
  id?: number;
  text: string;
  options: string[] | string;
  correct: number;
  order?: number;
};

type TestItem = {
  id: number;
  title: string;
  description?: string;
  questions: Question[];
};

type TestAttempt = {
  id: number;
  test: number;
  test_title: string;
  user: number;
  user_name: string;
  score: number;
  total: number;
  percent: number;
  answers: Record<string, number>;
  started_at: string;
  completed_at: string;
};

type TabKey = 'snippets' | 'videos' | 'tests';
type EditorMode = 'create' | 'edit';
type EditorEntity = 'snippet' | 'video' | 'test';

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

function getYoutubeMeta(url?: string | null) {
  if (!url) return null;

  const cleanUrl = String(url).trim();

  const shortsMatch = cleanUrl.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/i);
  if (shortsMatch?.[1]) {
    return {
      videoId: shortsMatch[1],
      isShort: true,
      embedUrl: `https://www.youtube.com/embed/${shortsMatch[1]}?playsinline=1&modestbranding=1&rel=0`,
    };
  }

  const watchMatch = cleanUrl.match(/[?&]v=([a-zA-Z0-9_-]{6,})/i);
  if (watchMatch?.[1]) {
    return {
      videoId: watchMatch[1],
      isShort: false,
      embedUrl: `https://www.youtube.com/embed/${watchMatch[1]}?playsinline=1&modestbranding=1&rel=0`,
    };
  }

  const shortLinkMatch = cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/i);
  if (shortLinkMatch?.[1]) {
    return {
      videoId: shortLinkMatch[1],
      isShort: false,
      embedUrl: `https://www.youtube.com/embed/${shortLinkMatch[1]}?playsinline=1&modestbranding=1&rel=0`,
    };
  }

  const embedMatch = cleanUrl.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/i);
  if (embedMatch?.[1]) {
    return {
      videoId: embedMatch[1],
      isShort: false,
      embedUrl: `https://www.youtube.com/embed/${embedMatch[1]}?playsinline=1&modestbranding=1&rel=0`,
    };
  }

  return null;
}

function AdminActions({
  theme,
  onEdit,
  onDelete,
}: {
  theme: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.adminActions}>
      <Pressable
        onPress={onEdit}
        style={[styles.adminIconBtn, { backgroundColor: theme.blueSoft, borderColor: theme.border }]}
      >
        <Ionicons name="create-outline" size={17} color={theme.blue} />
      </Pressable>

      <Pressable
        onPress={onDelete}
        style={[styles.adminIconBtn, { backgroundColor: theme.redSoft, borderColor: theme.border }]}
      >
        <Ionicons name="trash-outline" size={17} color={theme.red} />
      </Pressable>
    </View>
  );
}

export default function KnowledgeBaseScreen() {
  const router = useRouter();
  const { theme, themeMode } = useTheme();
  const { user } = useCurrentUser();

  const isAdmin = !!user && (user.is_superuser || user.is_staff || user.role === 'admin');
  const dark = themeMode === 'dark';

  const [activeTab, setActiveTab] = useState<TabKey>('snippets');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [tests, setTests] = useState<TestItem[]>([]);

  const [activeTest, setActiveTest] = useState<TestItem | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [submittingTest, setSubmittingTest] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<TestAttempt | null>(null);

  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('create');
  const [editorEntity, setEditorEntity] = useState<EditorEntity>('snippet');
  const [editingId, setEditingId] = useState<number | null>(null);

  const [snippetTitle, setSnippetTitle] = useState('');
  const [snippetCategory, setSnippetCategory] = useState('script');
  const [snippetContent, setSnippetContent] = useState('');

  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const [testTitle, setTestTitle] = useState('');
  const [testDescription, setTestDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([
    { text: '', options: ['', '', '', ''], correct: 0, order: 0 },
  ]);

  const activeVideoMeta = useMemo(
    () => getYoutubeMeta(activeVideo?.youtube_url),
    [activeVideo?.youtube_url]
  );

  const resetEditor = () => {
    setEditorMode('create');
    setEditorEntity('snippet');
    setEditingId(null);

    setSnippetTitle('');
    setSnippetCategory('script');
    setSnippetContent('');

    setVideoTitle('');
    setVideoDescription('');
    setYoutubeUrl('');

    setTestTitle('');
    setTestDescription('');
    setQuestions([{ text: '', options: ['', '', '', ''], correct: 0, order: 0 }]);
  };

  const openCreate = () => {
    resetEditor();

    if (activeTab === 'snippets') setEditorEntity('snippet');
    if (activeTab === 'videos') setEditorEntity('video');
    if (activeTab === 'tests') setEditorEntity('test');

    setEditorMode('create');
    setEditorOpen(true);
  };

  const openEditSnippet = (item: Snippet) => {
    resetEditor();
    setEditorMode('edit');
    setEditorEntity('snippet');
    setEditingId(item.id);
    setSnippetTitle(item.title || '');
    setSnippetCategory(item.category || 'script');
    setSnippetContent(item.content || '');
    setEditorOpen(true);
  };

  const openEditVideo = (item: VideoItem) => {
    resetEditor();
    setEditorMode('edit');
    setEditorEntity('video');
    setEditingId(item.id);
    setVideoTitle(item.title || '');
    setVideoDescription(item.description || '');
    setYoutubeUrl(item.youtube_url || '');
    setEditorOpen(true);
  };

  const openEditTest = (item: TestItem) => {
    resetEditor();
    setEditorMode('edit');
    setEditorEntity('test');
    setEditingId(item.id);
    setTestTitle(item.title || '');
    setTestDescription(item.description || '');
    setQuestions(
      (item.questions || []).length
        ? item.questions.map((q, index) => ({
            id: q.id,
            text: q.text || '',
            options: normalizeOptions(q.options).length
              ? normalizeOptions(q.options)
              : ['', '', '', ''],
            correct: typeof q.correct === 'number' ? q.correct : 0,
            order: typeof q.order === 'number' ? q.order : index,
          }))
        : [{ text: '', options: ['', '', '', ''], correct: 0, order: 0 }]
    );
    setEditorOpen(true);
  };

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
        const data = snipRes.value.data.results ?? snipRes.value.data ?? [];
        setSnippets(data);
        await saveToken('cache_snippets', JSON.stringify(data));
      }

      if (videoRes.status === 'fulfilled') {
        const data = videoRes.value.data.results ?? videoRes.value.data ?? [];
        setVideos(data);
        await saveToken('cache_videos', JSON.stringify(data));
      } else {
        setVideos([]);
      }

      if (testsRes.status === 'fulfilled') {
        const data = testsRes.value.data.results ?? testsRes.value.data ?? [];
        setTests(data);
        await saveToken('cache_tests', JSON.stringify(data));
      }
    } catch (e) {
      console.log('Knowledge base load error', e);
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
    return tests.filter(
      (t) =>
        String(t.title || '').toLowerCase().includes(q) ||
        String(t.description || '').toLowerCase().includes(q)
    );
  }, [tests, search]);

  const copySnippet = async (item: Snippet) => {
    await Clipboard.setStringAsync(stripHtml(item.content));
    Alert.alert('Скопировано', `"${item.title}" скопировано в буфер обмена.`);
  };

  const openVideo = (video: VideoItem) => {
    if (!video.youtube_url && !video.video_file) {
      Alert.alert('Видео', 'У этого материала нет источника.');
      return;
    }

    const yt = getYoutubeMeta(video.youtube_url);
    if (!yt && !video.video_file) {
      Alert.alert('Видео', 'У этого материала нет источника.');
      return;
    }

    setActiveVideo(video);
  };

  const startTest = (test: TestItem) => {
    setActiveTest(test);
    setAnswers({});
    setShowResult(false);
    setLastAttempt(null);
  };

  const score = useMemo(() => {
    if (!activeTest) return 0;
    let result = 0;
    for (const [index, question] of (activeTest.questions || []).entries()) {
      const key = question.id ?? index + 100000;
      if (answers[key] === question.correct) result += 1;
    }
    return result;
  }, [activeTest, answers]);

  const submitTestAttempt = async () => {
    if (!activeTest) return;

    try {
      setSubmittingTest(true);

      const payloadAnswers: Record<string, number> = {};
      (activeTest.questions || []).forEach((q, index) => {
        const key = q.id ?? index + 100000;
        if (typeof answers[key] === 'number' && q.id) {
          payloadAnswers[String(q.id)] = answers[key];
        }
      });

      const response = await apiClient.post(
        `documents/knowledge-tests/${activeTest.id}/submit/`,
        { answers: payloadAnswers }
      );

      setShowResult(true);
      setLastAttempt(response.data?.attempt || null);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.detail || 'Не удалось отправить результат теста.');
    } finally {
      setSubmittingTest(false);
    }
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      { text: '', options: ['', '', '', ''], correct: 0, order: prev.length },
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [{ text: '', options: ['', '', '', ''], correct: 0, order: 0 }];
    });
  };

  const updateQuestionText = (index: number, value: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], text: value };
      return next;
    });
  };

  const updateQuestionOption = (qIndex: number, oIndex: number, value: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      const currentOptions = normalizeOptions(next[qIndex].options);
      while (currentOptions.length < 4) currentOptions.push('');
      currentOptions[oIndex] = value;
      next[qIndex] = { ...next[qIndex], options: currentOptions };
      return next;
    });
  };

  const updateQuestionCorrect = (qIndex: number, correctIndex: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex] = { ...next[qIndex], correct: correctIndex };
      return next;
    });
  };

  const submitEditor = async () => {
    if (!isAdmin) return;

    setSaving(true);
    try {
      if (editorEntity === 'snippet') {
        if (!snippetTitle.trim() || !snippetContent.trim()) {
          Alert.alert('Ошибка', 'Заполни название и текст.');
          return;
        }

        const payload = {
          title: snippetTitle.trim(),
          category: snippetCategory,
          content: snippetContent.trim(),
          order: 0,
        };

        if (editorMode === 'create') {
          await apiClient.post('documents/snippets/', payload);
        } else {
          await apiClient.patch(`documents/snippets/${editingId}/`, payload);
        }
      }

      if (editorEntity === 'video') {
        if (!videoTitle.trim() || !youtubeUrl.trim()) {
          Alert.alert('Ошибка', 'Заполни название и ссылку YouTube.');
          return;
        }

        const yt = getYoutubeMeta(youtubeUrl.trim());
        if (!yt) {
          Alert.alert('Ошибка', 'Ссылка YouTube или Shorts некорректна.');
          return;
        }

        const payload = {
          title: videoTitle.trim(),
          description: videoDescription.trim(),
          youtube_url: youtubeUrl.trim(),
        };

        if (editorMode === 'create') {
          await apiClient.post('gamification/tutorials/', payload);
        } else {
          await apiClient.patch(`gamification/tutorials/${editingId}/`, payload);
        }
      }

      if (editorEntity === 'test') {
        if (!testTitle.trim()) {
          Alert.alert('Ошибка', 'Укажи название теста.');
          return;
        }

        const preparedQuestions = questions.map((q, index) => ({
          text: q.text.trim(),
          options: normalizeOptions(q.options),
          correct: q.correct,
          order: index,
        }));

        const hasInvalid = preparedQuestions.some(
          (q) => !q.text || q.options.length < 2 || q.options.some((o) => !String(o).trim())
        );

        if (hasInvalid) {
          Alert.alert('Ошибка', 'Заполни вопросы и варианты ответов полностью.');
          return;
        }

        const payload = {
          title: testTitle.trim(),
          description: testDescription.trim(),
          questions: preparedQuestions,
        };

        if (editorMode === 'create') {
          await apiClient.post('documents/knowledge-tests/', payload);
        } else {
          await apiClient.patch(`documents/knowledge-tests/${editingId}/`, payload);
        }
      }

      setEditorOpen(false);
      resetEditor();
      await loadData(true);
      Alert.alert('Готово', editorMode === 'create' ? 'Материал добавлен.' : 'Материал обновлён.');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.detail || 'Не удалось сохранить материал.');
    } finally {
      setSaving(false);
    }
  };

  const deleteSnippet = async (item: Snippet) => {
    Alert.alert('Удаление', `Удалить "${item.title}"?`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`documents/snippets/${item.id}/`);
            setSnippets((prev) => prev.filter((x) => x.id !== item.id));
          } catch (e: any) {
            Alert.alert('Ошибка', e?.response?.data?.detail || 'Не удалось удалить запись.');
          }
        },
      },
    ]);
  };

  const deleteVideo = async (item: VideoItem) => {
    Alert.alert('Удаление', `Удалить "${item.title}"?`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`gamification/tutorials/${item.id}/`);
            setVideos((prev) => prev.filter((x) => x.id !== item.id));
          } catch (e: any) {
            Alert.alert('Ошибка', e?.response?.data?.detail || 'Не удалось удалить видео.');
          }
        },
      },
    ]);
  };

  const deleteTest = async (item: TestItem) => {
    Alert.alert('Удаление', `Удалить "${item.title}"?`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`documents/knowledge-tests/${item.id}/`);
            setTests((prev) => prev.filter((x) => x.id !== item.id));
          } catch (e: any) {
            Alert.alert('Ошибка', e?.response?.data?.detail || 'Не удалось удалить тест.');
          }
        },
      },
    ]);
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

        <Text style={[styles.title, { color: theme.text }]}>База знаний</Text>

        {isAdmin ? (
          <Pressable
            onPress={openCreate}
            style={[styles.addBtn, { backgroundColor: theme.blue }]}
          >
            <Ionicons name="add" size={18} color="#fff" />
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
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
            styles.heroCard,
            {
              backgroundColor: dark ? 'rgba(18,24,36,0.92)' : '#FFFFFF',
              borderColor: theme.border,
              shadowColor: '#000',
            },
          ]}
        >
          <Text style={[styles.heroTitle, { color: theme.text }]}>Материалы для команды</Text>
          <Text style={[styles.heroSub, { color: theme.textSecondary }]}>
            Видео, тесты и быстрые тексты для копирования в одном месте
          </Text>

          <View style={styles.heroStats}>
            <View style={[styles.heroStat, { backgroundColor: theme.backgroundSoft }]}>
              <Text style={[styles.heroStatValue, { color: theme.text }]}>{snippets.length}</Text>
              <Text style={[styles.heroStatLabel, { color: theme.textSecondary }]}>Записей</Text>
            </View>
            <View style={[styles.heroStat, { backgroundColor: theme.backgroundSoft }]}>
              <Text style={[styles.heroStatValue, { color: theme.text }]}>{videos.length}</Text>
              <Text style={[styles.heroStatLabel, { color: theme.textSecondary }]}>Видео</Text>
            </View>
            <View style={[styles.heroStat, { backgroundColor: theme.backgroundSoft }]}>
              <Text style={[styles.heroStatValue, { color: theme.text }]}>{tests.length}</Text>
              <Text style={[styles.heroStatLabel, { color: theme.textSecondary }]}>Тестов</Text>
            </View>
          </View>
        </View>

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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
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
                <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={{ color: theme.textSecondary }}>Ничего не найдено.</Text>
                </View>
              ) : (
                filteredSnippets.map((item) => (
                  <View
                    key={item.id}
                    style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  >
                    <View style={styles.cardTopRow}>
                      <Text style={[styles.cardTitle, { color: theme.text, flex: 1 }]}>{item.title}</Text>
                      {isAdmin ? (
                        <AdminActions
                          theme={theme}
                          onEdit={() => openEditSnippet(item)}
                          onDelete={() => deleteSnippet(item)}
                        />
                      ) : null}
                    </View>

                    <Pressable onPress={() => copySnippet(item)}>
                      <Text style={[styles.cardText, { color: theme.textSecondary }]}>
                        {stripHtml(item.content)}
                      </Text>

                      <View style={styles.cardFooter}>
                        <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                          {CATEGORY_LABELS[item.category]?.label || item.category}
                        </Text>
                        <Text style={[styles.copyText, { color: theme.blue }]}>
                          Нажми, чтобы скопировать
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {activeTab === 'videos' && (
          <View style={{ gap: 12, marginTop: 16 }}>
            {filteredVideos.length === 0 ? (
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={{ color: theme.textSecondary }}>Видео пока нет.</Text>
              </View>
            ) : (
              filteredVideos.map((item) => {
                const yt = getYoutubeMeta(item.youtube_url);
                const isShort = !!yt?.isShort;

                return (
                  <View
                    key={item.id}
                    style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  >
                    <View style={styles.cardTopRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <View style={styles.videoHead}>
                          <View style={[styles.videoIcon, { backgroundColor: theme.redSoft }]}>
                            <Ionicons name="play" size={18} color={theme.red} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
                            <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                              {item.youtube_url
                                ? isShort
                                  ? 'YouTube Shorts'
                                  : 'YouTube'
                                : item.video_file
                                ? 'Встроенное видео'
                                : 'Без ссылки'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {isAdmin ? (
                        <AdminActions
                          theme={theme}
                          onEdit={() => openEditVideo(item)}
                          onDelete={() => deleteVideo(item)}
                        />
                      ) : null}
                    </View>

                    <Pressable onPress={() => openVideo(item)}>
                      {!!item.description && (
                        <Text style={[styles.cardText, { color: theme.textSecondary }]}>
                          {item.description}
                        </Text>
                      )}
                      <Text style={[styles.copyText, { color: theme.blue }]}>Открыть видео</Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'tests' && (
          <View style={{ gap: 12, marginTop: 16 }}>
            {filteredTests.length === 0 ? (
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={{ color: theme.textSecondary }}>Тесты пока не найдены.</Text>
              </View>
            ) : (
              filteredTests.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => startTest(item)}
                  style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
                      {!!item.description && (
                        <Text style={[styles.cardText, { color: theme.textSecondary }]}>
                          {item.description}
                        </Text>
                      )}
                      <Text style={[styles.copyText, { color: theme.blue }]}>Открыть тест</Text>
                    </View>

                    {isAdmin ? (
                      <AdminActions
                        theme={theme}
                        onEdit={() => openEditTest(item)}
                        onDelete={() => deleteTest(item)}
                      />
                    ) : null}
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        <View style={{ height: 50 }} />
      </ScrollView>

      <Modal visible={!!activeVideo} animationType="slide" onRequestClose={() => setActiveVideo(null)}>
        <ScreenWrapper>
          <View style={styles.header}>
            <Pressable
              onPress={() => setActiveVideo(null)}
              style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>

            <Text style={[styles.title, { color: theme.text }]}>Видео</Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView contentContainerStyle={styles.videoModalContent} showsVerticalScrollIndicator={false}>
            {!!activeVideo?.title && (
              <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 12 }]}>
                {activeVideo.title}
              </Text>
            )}

            {activeVideoMeta ? (
              <View
                style={[
                  activeVideoMeta.isShort ? styles.shortPlayerWrap : styles.widePlayerWrap,
                  { backgroundColor: '#000' },
                ]}
              >
                <WebView
                  source={{ uri: activeVideoMeta.embedUrl }}
                  allowsFullscreenVideo
                  mediaPlaybackRequiresUserAction={false}
                  javaScriptEnabled
                  style={{ flex: 1, backgroundColor: '#000' }}
                />
              </View>
            ) : activeVideo?.video_file ? (
              <Video
                source={{ uri: activeVideo.video_file }}
                style={styles.nativeVideo}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={false}
              />
            ) : (
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={{ color: theme.textSecondary }}>У видео нет источника.</Text>
              </View>
            )}

            {!!activeVideo?.description && (
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 16 }]}>
                <Text style={[styles.cardText, { color: theme.textSecondary }]}>
                  {activeVideo.description}
                </Text>
              </View>
            )}
          </ScrollView>
        </ScreenWrapper>
      </Modal>

      <Modal visible={!!activeTest} animationType="slide" onRequestClose={() => setActiveTest(null)}>
        <ScreenWrapper>
          <View style={styles.header}>
            <Pressable
              onPress={() => {
                setActiveTest(null);
                setShowResult(false);
                setLastAttempt(null);
              }}
              style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>

            <Text style={[styles.title, { color: theme.text }]}>Тест</Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            {activeTest && (
              <>
                <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{activeTest.title}</Text>
                  {!!activeTest.description && (
                    <Text style={[styles.cardText, { color: theme.textSecondary }]}>
                      {activeTest.description}
                    </Text>
                  )}
                </View>

                {(activeTest.questions || []).map((q, index) => {
                  const options = normalizeOptions(q.options);
                  const questionKey = q.id ?? index + 100000;

                  return (
                    <View
                      key={questionKey}
                      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    >
                      <Text style={[styles.questionIndex, { color: theme.blue }]}>
                        Вопрос {index + 1}
                      </Text>
                      <Text style={[styles.questionText, { color: theme.text }]}>{q.text}</Text>

                      <View style={{ gap: 10, marginTop: 14 }}>
                        {options.map((opt, optIndex) => {
                          const chosen = answers[questionKey] === optIndex;
                          const reveal = showResult;
                          const correct = q.correct === optIndex;

                          return (
                            <Pressable
                              key={`${questionKey}-${optIndex}`}
                              onPress={() =>
                                !showResult &&
                                setAnswers((prev) => ({ ...prev, [questionKey]: optIndex }))
                              }
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
                    onPress={submitTestAttempt}
                    style={[styles.submitBtn, { backgroundColor: theme.blue }]}
                  >
                    <Text style={styles.submitBtnText}>
                      {submittingTest ? 'Отправка...' : 'Проверить ответы'}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>
                      Результат: {lastAttempt?.score ?? score} / {lastAttempt?.total ?? (activeTest.questions?.length || 0)}
                    </Text>
                    <Text style={[styles.cardText, { color: theme.textSecondary }]}>
                      {(lastAttempt?.score ?? score) ===
                      (lastAttempt?.total ?? (activeTest.questions?.length || 0))
                        ? 'Отлично. Всё правильно.'
                        : 'Проверь ошибки и попробуй ещё раз.'}
                    </Text>

                    {lastAttempt ? (
                      <Text style={[styles.cardMeta, { color: theme.textSecondary, marginTop: 10 }]}>
                        Сохранено: {lastAttempt.percent}% ·{' '}
                        {new Date(lastAttempt.completed_at).toLocaleString('ru-RU')}
                      </Text>
                    ) : null}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </ScreenWrapper>
      </Modal>

      <Modal visible={editorOpen} animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <ScreenWrapper>
          <View style={styles.header}>
            <Pressable
              onPress={() => {
                setEditorOpen(false);
                resetEditor();
              }}
              style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>

            <Text style={[styles.title, { color: theme.text }]}>
              {editorMode === 'create' ? 'Создать' : 'Редактировать'}
            </Text>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.tabRow}>
              {[
                { key: 'snippet', label: 'Инфа' },
                { key: 'video', label: 'Видео' },
                { key: 'test', label: 'Тест' },
              ].map((item) => {
                const active = editorEntity === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() =>
                      editorMode === 'create' && setEditorEntity(item.key as EditorEntity)
                    }
                    style={[
                      styles.tabBtn,
                      {
                        backgroundColor: active ? theme.blue : theme.surface,
                        borderColor: active ? theme.blue : theme.border,
                        opacity: editorMode === 'edit' && !active ? 0.45 : 1,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '900' }}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {editorEntity === 'snippet' && (
              <View style={{ marginTop: 16, gap: 12 }}>
                <TextInput
                  value={snippetTitle}
                  onChangeText={setSnippetTitle}
                  placeholder="Название"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
                  ]}
                />

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.tabRow}>
                    {['script', 'faq', 'requisites', 'links'].map((cat) => {
                      const active = snippetCategory === cat;
                      return (
                        <Pressable
                          key={cat}
                          onPress={() => setSnippetCategory(cat)}
                          style={[
                            styles.catBtn,
                            {
                              backgroundColor: active ? theme.blue : theme.surface,
                              borderColor: active ? theme.blue : theme.border,
                            },
                          ]}
                        >
                          <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '900' }}>
                            {CATEGORY_LABELS[cat]?.label || cat}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>

                <TextInput
                  value={snippetContent}
                  onChangeText={setSnippetContent}
                  placeholder="Текст для быстрого копирования"
                  placeholderTextColor={theme.textMuted}
                  multiline
                  style={[
                    styles.input,
                    styles.textarea,
                    { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
                  ]}
                />
              </View>
            )}

            {editorEntity === 'video' && (
              <View style={{ marginTop: 16, gap: 12 }}>
                <TextInput
                  value={videoTitle}
                  onChangeText={setVideoTitle}
                  placeholder="Название видео"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
                  ]}
                />

                <TextInput
                  value={videoDescription}
                  onChangeText={setVideoDescription}
                  placeholder="Описание"
                  placeholderTextColor={theme.textMuted}
                  multiline
                  style={[
                    styles.input,
                    styles.textareaSmall,
                    { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
                  ]}
                />

                <TextInput
                  value={youtubeUrl}
                  onChangeText={setYoutubeUrl}
                  placeholder="Ссылка YouTube или Shorts"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
                  ]}
                />

                {!!youtubeUrl.trim() && (
                  <View
                    style={[
                      styles.previewCard,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.previewTitle, { color: theme.text }]}>Предпросмотр ссылки</Text>
                    <Text style={[styles.previewText, { color: theme.textSecondary }]}>
                      {getYoutubeMeta(youtubeUrl)?.isShort
                        ? 'Определено как Shorts (вертикально)'
                        : getYoutubeMeta(youtubeUrl)
                        ? 'Определено как обычное видео (горизонтально)'
                        : 'Ссылка пока не распознана'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {editorEntity === 'test' && (
              <View style={{ marginTop: 16, gap: 12 }}>
                <TextInput
                  value={testTitle}
                  onChangeText={setTestTitle}
                  placeholder="Название теста"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
                  ]}
                />

                <TextInput
                  value={testDescription}
                  onChangeText={setTestDescription}
                  placeholder="Описание теста"
                  placeholderTextColor={theme.textMuted}
                  multiline
                  style={[
                    styles.input,
                    styles.textareaSmall,
                    { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
                  ]}
                />

                {questions.map((question, qIndex) => {
                  const options = normalizeOptions(question.options).length
                    ? normalizeOptions(question.options)
                    : ['', '', '', ''];

                  while (options.length < 4) options.push('');

                  return (
                    <View
                      key={qIndex}
                      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    >
                      <View style={styles.cardTopRow}>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>Вопрос {qIndex + 1}</Text>

                        <Pressable
                          onPress={() => removeQuestion(qIndex)}
                          style={[
                            styles.adminIconBtn,
                            { backgroundColor: theme.redSoft, borderColor: theme.border },
                          ]}
                        >
                          <Ionicons name="trash-outline" size={17} color={theme.red} />
                        </Pressable>
                      </View>

                      <TextInput
                        value={question.text}
                        onChangeText={(v) => updateQuestionText(qIndex, v)}
                        placeholder="Текст вопроса"
                        placeholderTextColor={theme.textMuted}
                        style={[
                          styles.input,
                          {
                            color: theme.text,
                            borderColor: theme.border,
                            backgroundColor: theme.backgroundSoft,
                          },
                        ]}
                      />

                      {options.map((opt, oIndex) => {
                        const active = question.correct === oIndex;
                        return (
                          <Pressable
                            key={oIndex}
                            onPress={() => updateQuestionCorrect(qIndex, oIndex)}
                            style={{ marginTop: 10 }}
                          >
                            <TextInput
                              value={opt}
                              onChangeText={(v) => updateQuestionOption(qIndex, oIndex, v)}
                              placeholder={`Вариант ${oIndex + 1}${active ? ' (правильный)' : ''}`}
                              placeholderTextColor={theme.textMuted}
                              style={[
                                styles.input,
                                {
                                  color: theme.text,
                                  borderColor: active ? theme.blue : theme.border,
                                  backgroundColor: active ? theme.blueSoft : theme.backgroundSoft,
                                },
                              ]}
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })}

                <Pressable
                  onPress={addQuestion}
                  style={[
                    styles.secondaryActionBtn,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.secondaryActionText, { color: theme.text }]}>
                    Добавить вопрос
                  </Text>
                </Pressable>
              </View>
            )}

            <Pressable
              onPress={submitEditor}
              style={[styles.submitBtn, { backgroundColor: theme.blue, marginTop: 20 }]}
            >
              <Text style={styles.submitBtnText}>
                {saving
                  ? 'Сохранение...'
                  : editorMode === 'create'
                  ? 'Создать'
                  : 'Сохранить изменения'}
              </Text>
            </Pressable>
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
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '900' },

  container: { padding: 20, paddingBottom: 120 },
  videoModalContent: { padding: 20, paddingBottom: 80 },

  heroCard: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 18,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 3,
  },
  heroTitle: { fontSize: 21, fontWeight: '900' },
  heroSub: { marginTop: 6, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  heroStats: { flexDirection: 'row', gap: 10, marginTop: 16 },
  heroStat: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  heroStatValue: { fontSize: 20, fontWeight: '900' },
  heroStatLabel: { marginTop: 4, fontSize: 11, fontWeight: '700' },

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
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
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

  adminActions: {
    flexDirection: 'row',
    gap: 8,
  },
  adminIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
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

  submitBtn: {
    marginTop: 14,
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },

  widePlayerWrap: {
    width: '100%',
    height: 240,
    borderRadius: 22,
    overflow: 'hidden',
  },
  shortPlayerWrap: {
    width: '72%',
    alignSelf: 'center',
    height: 520,
    borderRadius: 26,
    overflow: 'hidden',
  },
  nativeVideo: {
    width: '100%',
    height: 240,
    borderRadius: 20,
    backgroundColor: '#000',
  },

  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  textarea: {
    minHeight: 160,
    textAlignVertical: 'top',
  },
  textareaSmall: {
    minHeight: 100,
    textAlignVertical: 'top',
  },

  secondaryActionBtn: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '800',
  },

  previewCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  previewText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
});