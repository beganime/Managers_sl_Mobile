// app/(app)/knowledge-base.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Linking,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';
import { getToken, saveToken } from '../../src/utils/storage';

// ─── Типы ───────────────────────────────────────────────────────────────────

type Snippet = {
    id: number;
    title: string;
    content: string;
    category: string;
};

type Video = {
    id: number;
    title: string;
    description: string;
    video_file: string | null;
    youtube_url: string | null;
};

type Question = {
    id: number;
    text: string;
    options: string[];   // JSON-строка или уже массив
    correct: number;     // индекс правильного ответа
};

type Test = {
    id: number;
    title: string;
    description: string;
    questions: Question[];
};

// ─── Категории сниппетов ────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    script:     { label: 'Скрипты продаж',        icon: 'chatbubbles',       color: '#3b82f6' },
    faq:        { label: 'Частые вопросы',         icon: 'help-circle',       color: '#8b5cf6' },
    requisites: { label: 'Реквизиты и счета',      icon: 'card',              color: '#10b981' },
    links:      { label: 'Полезные ссылки',        icon: 'link',              color: '#f59e0b' },
};

// ─── Вспомогательные компоненты ─────────────────────────────────────────────

function CategoryChip({
    cat,
    active,
    onPress,
}: {
    cat: string;
    active: boolean;
    onPress: () => void;
}) {
    const meta = CATEGORY_LABELS[cat] ?? { label: cat, icon: 'folder', color: '#64748B' };
    return (
        <TouchableOpacity
            style={[styles.chip, active && { backgroundColor: meta.color, borderColor: meta.color }]}
            onPress={onPress}
            activeOpacity={0.75}
        >
            <Ionicons
                name={meta.icon as any}
                size={14}
                color={active ? '#fff' : meta.color}
                style={{ marginRight: 5 }}
            />
            <Text style={[styles.chipText, active && { color: '#fff' }]}>{meta.label}</Text>
        </TouchableOpacity>
    );
}

function SnippetCard({ item }: { item: Snippet }) {
    const [expanded, setExpanded] = useState(false);
    const anim = useRef(new Animated.Value(0)).current;
    const meta = CATEGORY_LABELS[item.category] ?? { color: '#64748B', icon: 'document-text' };

    const toggle = () => {
        Animated.spring(anim, {
            toValue: expanded ? 0 : 1,
            useNativeDriver: false,
            friction: 8,
        }).start();
        setExpanded(v => !v);
    };

    const handleCopy = async () => {
        await Clipboard.setStringAsync(item.content);
        Alert.alert('Скопировано ✓', `«${item.title}» скопировано в буфер`);
    };

    return (
        <BlurView intensity={55} tint="light" style={styles.snippetCard}>
            <TouchableOpacity onPress={toggle} activeOpacity={0.8} style={styles.snippetHeader}>
                <View style={[styles.snippetIconBox, { backgroundColor: meta.color + '20' }]}>
                    <Ionicons name={meta.icon as any} size={20} color={meta.color} />
                </View>
                <Text style={styles.snippetTitle} numberOfLines={expanded ? undefined : 1}>
                    {item.title}
                </Text>
                <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#94A3B8"
                />
            </TouchableOpacity>

            {expanded && (
                <View style={styles.snippetBody}>
                    <Text style={styles.snippetContent}>{item.content}</Text>
                    <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
                        <Ionicons name="copy-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.copyBtnText}>Копировать</Text>
                    </TouchableOpacity>
                </View>
            )}
        </BlurView>
    );
}

function VideoCard({ item }: { item: Video }) {
    const [playerVisible, setPlayerVisible] = useState(false);

    const openVideo = () => {
        if (item.youtube_url) {
            Linking.openURL(item.youtube_url);
        } else if (item.video_file) {
            setPlayerVisible(true);
        }
    };

    return (
        <>
            <BlurView intensity={55} tint="light" style={styles.videoCard}>
                <View style={styles.videoThumb}>
                    <Ionicons name="play-circle" size={44} color="#0D416D" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
                    {item.description ? (
                        <Text style={styles.videoDesc} numberOfLines={2}>{item.description}</Text>
                    ) : null}
                    <TouchableOpacity style={styles.watchBtn} onPress={openVideo}>
                        <Ionicons
                            name={item.youtube_url ? 'logo-youtube' : 'play'}
                            size={15}
                            color="#fff"
                            style={{ marginRight: 5 }}
                        />
                        <Text style={styles.watchBtnText}>
                            {item.youtube_url ? 'YouTube' : 'Смотреть'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </BlurView>

            {/* Встроенный плеер для файлов */}
            {item.video_file && (
                <NativeVideoModal
                    uri={item.video_file}
                    visible={playerVisible}
                    onClose={() => setPlayerVisible(false)}
                />
            )}
        </>
    );
}

// Плеер на expo-video
function NativeVideoModal({
    uri,
    visible,
    onClose,
}: {
    uri: string;
    visible: boolean;
    onClose: () => void;
}) {
    const player = useVideoPlayer(uri, p => {
        p.loop = false;
    });

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.videoModalOverlay}>
                <View style={styles.videoModalContent}>
                    <TouchableOpacity style={styles.videoCloseBtn} onPress={onClose}>
                        <Ionicons name="close" size={26} color="#fff" />
                    </TouchableOpacity>
                    <VideoView
                        player={player}
                        style={styles.videoPlayer}
                        allowsFullscreen
                        allowsPictureInPicture
                    />
                </View>
            </View>
        </Modal>
    );
}

// ─── Тест ───────────────────────────────────────────────────────────────────

function TestModal({
    test,
    onClose,
}: {
    test: Test;
    onClose: () => void;
}) {
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [finished, setFinished] = useState(false);

    const q = test.questions[step];
    const options: string[] =
        typeof q?.options === 'string' ? JSON.parse(q.options) : q?.options ?? [];

    const select = (idx: number) => {
        setAnswers(prev => ({ ...prev, [step]: idx }));
    };

    const next = () => {
        if (step < test.questions.length - 1) setStep(s => s + 1);
        else setFinished(true);
    };

    const score = test.questions.filter((q, i) => answers[i] === q.correct).length;
    const total = test.questions.length;

    return (
        <Modal visible animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.testOverlay}>
                <BlurView intensity={90} tint="light" style={styles.testModal}>
                    {/* Заголовок */}
                    <View style={styles.testHeader}>
                        <Text style={styles.testTitle}>{test.title}</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close-circle" size={28} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    {finished ? (
                        <View style={styles.testResult}>
                            <Text style={styles.resultEmoji}>
                                {score === total ? '🏆' : score >= total / 2 ? '👍' : '📚'}
                            </Text>
                            <Text style={styles.resultScore}>
                                {score} / {total}
                            </Text>
                            <Text style={styles.resultText}>
                                {score === total
                                    ? 'Отлично! Все ответы верны!'
                                    : score >= total / 2
                                    ? 'Хороший результат!'
                                    : 'Нужно повторить материал.'}
                            </Text>
                            <TouchableOpacity style={styles.testCloseBtn} onPress={onClose}>
                                <Text style={styles.testCloseBtnText}>Закрыть</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.testProgress}>
                                Вопрос {step + 1} из {total}
                            </Text>
                            <Text style={styles.testQuestion}>{q?.text}</Text>

                            <View style={styles.optionsList}>
                                {options.map((opt, i) => {
                                    const selected = answers[step] === i;
                                    return (
                                        <TouchableOpacity
                                            key={i}
                                            style={[styles.option, selected && styles.optionSelected]}
                                            onPress={() => select(i)}
                                            activeOpacity={0.8}
                                        >
                                            <View
                                                style={[
                                                    styles.optionDot,
                                                    selected && styles.optionDotSelected,
                                                ]}
                                            />
                                            <Text
                                                style={[
                                                    styles.optionText,
                                                    selected && styles.optionTextSelected,
                                                ]}
                                            >
                                                {opt}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <TouchableOpacity
                                style={[
                                    styles.nextBtn,
                                    answers[step] === undefined && styles.nextBtnDisabled,
                                ]}
                                onPress={next}
                                disabled={answers[step] === undefined}
                            >
                                <Text style={styles.nextBtnText}>
                                    {step < total - 1 ? 'Следующий вопрос' : 'Завершить тест'}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    )}
                </BlurView>
            </View>
        </Modal>
    );
}

// ─── Главный экран ──────────────────────────────────────────────────────────

const TABS = ['snippets', 'videos', 'tests'] as const;
type TabKey = (typeof TABS)[number];

const TAB_LABELS: Record<TabKey, { label: string; icon: string }> = {
    snippets: { label: 'База знаний', icon: 'library' },
    videos:   { label: 'Видеоуроки', icon: 'play-circle' },
    tests:    { label: 'Тесты',       icon: 'checkmark-done-circle' },
};

export default function KnowledgeBaseScreen() {
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<TabKey>('snippets');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');

    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [videos, setVideos] = useState<Video[]>([]);
    const [tests, setTests] = useState<Test[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>('');
    const [activeTest, setActiveTest] = useState<Test | null>(null);

    // ── Загрузка ──────────────────────────────────────────────────────────
    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            // Пробуем из кэша сначала
            const cachedSnippets = await getToken('cache_snippets');
            const cachedVideos   = await getToken('cache_videos');
            if (cachedSnippets) setSnippets(JSON.parse(cachedSnippets));
            if (cachedVideos)   setVideos(JSON.parse(cachedVideos));

            const [snipRes, vidRes] = await Promise.allSettled([
                apiClient.get('documents/snippets/'),
                apiClient.get('gamification/tutorials/'),
            ]);

            if (snipRes.status === 'fulfilled') {
                const data = snipRes.value.data.results ?? snipRes.value.data;
                setSnippets(data);
                await saveToken('cache_snippets', JSON.stringify(data));
            }
            if (vidRes.status === 'fulfilled') {
                const data = vidRes.value.data.results ?? vidRes.value.data;
                setVideos(data);
                await saveToken('cache_videos', JSON.stringify(data));
            }

            // Тесты — если API ещё нет, используем мок
            const cachedTests = await getToken('cache_tests');
            if (cachedTests) {
                setTests(JSON.parse(cachedTests));
            } else {
                // Мок-тест пока API не готово
                setTests([MOCK_TEST]);
            }
        } catch {
            console.log('Офлайн режим: загружаем кэш базы знаний');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // ── Фильтрация ────────────────────────────────────────────────────────
    const categories = useMemo(
        () => Array.from(new Set(snippets.map(s => s.category))).filter(Boolean),
        [snippets]
    );

    const filteredSnippets = useMemo(() => {
        let res = snippets;
        if (activeCategory) res = res.filter(s => s.category === activeCategory);
        if (search)
            res = res.filter(
                s =>
                    s.title.toLowerCase().includes(search.toLowerCase()) ||
                    s.content.toLowerCase().includes(search.toLowerCase())
            );
        return res;
    }, [snippets, activeCategory, search]);

    const filteredVideos = useMemo(() => {
        if (!search) return videos;
        return videos.filter(
            v =>
                v.title.toLowerCase().includes(search.toLowerCase()) ||
                (v.description ?? '').toLowerCase().includes(search.toLowerCase())
        );
    }, [videos, search]);

    const filteredTests = useMemo(() => {
        if (!search) return tests;
        return tests.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));
    }, [tests, search]);

    // ── Рендер ────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#0D416D" />
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient
                    colors={['#F1F5F9', '#E2E8F0']}
                    style={StyleSheet.absoluteFillObject}
                />
            </View>

            {/* Шапка */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>База знаний</Text>
                <View style={{ width: 44 }} />
            </View>

            {/* Поиск */}
            <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Поиск..."
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={setSearch}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Табы */}
            <BlurView intensity={50} tint="light" style={styles.tabsBar}>
                {TABS.map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Ionicons
                            name={TAB_LABELS[tab].icon as any}
                            size={16}
                            color={activeTab === tab ? '#fff' : '#64748B'}
                        />
                        <Text
                            style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}
                        >
                            {TAB_LABELS[tab].label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </BlurView>

            {/* Контент */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); loadData(true); }}
                        tintColor="#0D416D"
                    />
                }
            >
                {/* ─── СНИППЕТЫ ─── */}
                {activeTab === 'snippets' && (
                    <>
                        {/* Фильтр по категориям */}
                        {categories.length > 0 && (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.categoryScroll}
                            >
                                <CategoryChip
                                    cat="all"
                                    active={activeCategory === ''}
                                    onPress={() => setActiveCategory('')}
                                />
                                {categories.map(cat => (
                                    <CategoryChip
                                        key={cat}
                                        cat={cat}
                                        active={activeCategory === cat}
                                        onPress={() =>
                                            setActiveCategory(activeCategory === cat ? '' : cat)
                                        }
                                    />
                                ))}
                            </ScrollView>
                        )}

                        {filteredSnippets.length === 0 ? (
                            <EmptyState text="Ничего не найдено" />
                        ) : (
                            filteredSnippets.map(s => <SnippetCard key={s.id} item={s} />)
                        )}
                    </>
                )}

                {/* ─── ВИДЕО ─── */}
                {activeTab === 'videos' && (
                    <>
                        {filteredVideos.length === 0 ? (
                            <EmptyState text="Видеоуроки не найдены" />
                        ) : (
                            filteredVideos.map(v => <VideoCard key={v.id} item={v} />)
                        )}
                    </>
                )}

                {/* ─── ТЕСТЫ ─── */}
                {activeTab === 'tests' && (
                    <>
                        {filteredTests.length === 0 ? (
                            <EmptyState text="Тестов пока нет" />
                        ) : (
                            filteredTests.map(t => (
                                <BlurView key={t.id} intensity={55} tint="light" style={styles.testCard}>
                                    <View style={styles.testCardLeft}>
                                        <View style={styles.testIconBox}>
                                            <Ionicons name="help-circle" size={28} color="#8b5cf6" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.testCardTitle}>{t.title}</Text>
                                            <Text style={styles.testCardDesc} numberOfLines={2}>
                                                {t.description || `${t.questions.length} вопросов`}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.startTestBtn}
                                        onPress={() => setActiveTest(t)}
                                    >
                                        <Text style={styles.startTestBtnText}>Пройти</Text>
                                        <Ionicons name="arrow-forward" size={14} color="#fff" />
                                    </TouchableOpacity>
                                </BlurView>
                            ))
                        )}
                    </>
                )}

                <View style={{ height: 30 }} />
            </ScrollView>

            {/* Модалка теста */}
            {activeTest && (
                <TestModal test={activeTest} onClose={() => setActiveTest(null)} />
            )}
        </ScreenWrapper>
    );
}

// ─── Пустой стейт ───────────────────────────────────────────────────────────

function EmptyState({ text }: { text: string }) {
    return (
        <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>{text}</Text>
        </View>
    );
}

// ─── Мок-тест (пока нет API) ─────────────────────────────────────────────────

const MOCK_TEST: Test = {
    id: 1,
    title: 'Основы продаж',
    description: 'Проверьте знание базовых техник продаж',
    questions: [
        {
            id: 1,
            text: 'Какой первый шаг при работе с новой заявкой?',
            options: ['Сразу предложить ВУЗ', 'Выявить потребность клиента', 'Отправить прайс', 'Попросить паспорт'],
            correct: 1,
        },
        {
            id: 2,
            text: 'Что делать если клиент говорит «Дорого»?',
            options: ['Предложить скидку', 'Завершить разговор', 'Выяснить с чем сравнивает', 'Согласиться'],
            correct: 2,
        },
        {
            id: 3,
            text: 'Когда нужно отправлять ежедневный отчёт?',
            options: ['Утром', 'До 22:00', 'Раз в неделю', 'Только если есть сделки'],
            correct: 1,
        },
    ],
};

// ─── Стили ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.9)',
    },
    headerTitle: { color: '#0F172A', fontSize: 20, fontWeight: '900' },

    // Search
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.8)',
        marginHorizontal: 20,
        marginBottom: 12,
        paddingHorizontal: 14,
        height: 46,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchInput: {
        flex: 1,
        color: '#1E293B',
        fontSize: 15,
        fontWeight: '600',
    },

    // Tabs
    tabsBar: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginBottom: 16,
        borderRadius: 16,
        padding: 4,
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.7)',
        overflow: 'hidden',
    },
    tabItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        gap: 4,
    },
    tabItemActive: { backgroundColor: '#0D416D' },
    tabLabel: { fontSize: 11, fontWeight: '800', color: '#64748B' },
    tabLabelActive: { color: '#fff' },

    // Scroll
    scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },

    // Category chips
    categoryScroll: { marginBottom: 14 },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.8)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    chipText: { fontSize: 12, fontWeight: '700', color: '#475569' },

    // Snippet Card
    snippetCard: {
        borderRadius: 20,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.8)',
        backgroundColor: 'rgba(255,255,255,0.5)',
    },
    snippetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    snippetIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    snippetTitle: {
        flex: 1,
        color: '#0F172A',
        fontSize: 15,
        fontWeight: '800',
    },
    snippetBody: { paddingHorizontal: 16, paddingBottom: 16 },
    snippetContent: {
        color: '#475569',
        fontSize: 14,
        lineHeight: 22,
        fontWeight: '500',
        marginBottom: 12,
    },
    copyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0D416D',
        paddingVertical: 10,
        borderRadius: 12,
    },
    copyBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

    // Video Card
    videoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.8)',
        backgroundColor: 'rgba(255,255,255,0.5)',
        gap: 14,
    },
    videoThumb: {
        width: 72,
        height: 72,
        borderRadius: 16,
        backgroundColor: 'rgba(13,65,109,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoTitle: { color: '#0F172A', fontSize: 15, fontWeight: '800', marginBottom: 4 },
    videoDesc: { color: '#64748B', fontSize: 12, fontWeight: '500', marginBottom: 8 },
    watchBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ef4444',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    watchBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },

    // Video modal/player
    videoModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.92)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoModalContent: { width: '100%', position: 'relative' },
    videoCloseBtn: {
        position: 'absolute',
        top: -44,
        right: 16,
        zIndex: 10,
        padding: 4,
    },
    videoPlayer: { width: '100%', height: 260 },

    // Test Card (список)
    testCard: {
        borderRadius: 20,
        marginBottom: 12,
        padding: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.8)',
        backgroundColor: 'rgba(255,255,255,0.5)',
    },
    testCardLeft: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
    testIconBox: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(139,92,246,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    testCardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900', marginBottom: 4 },
    testCardDesc: { color: '#64748B', fontSize: 12, fontWeight: '500' },
    startTestBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8b5cf6',
        paddingVertical: 12,
        borderRadius: 14,
        gap: 6,
    },
    startTestBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },

    // Test modal
    testOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15,23,42,0.5)',
    },
    testModal: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 28,
        maxHeight: '90%',
        backgroundColor: 'rgba(248,250,252,0.98)',
        overflow: 'hidden',
    },
    testHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    testTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', flex: 1, marginRight: 10 },
    testProgress: {
        fontSize: 12,
        fontWeight: '800',
        color: '#8b5cf6',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 10,
    },
    testQuestion: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0F172A',
        lineHeight: 24,
        marginBottom: 20,
    },
    optionsList: { gap: 10, marginBottom: 24 },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.8)',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        gap: 12,
    },
    optionSelected: { borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.08)' },
    optionDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#CBD5E1',
    },
    optionDotSelected: { borderColor: '#8b5cf6', backgroundColor: '#8b5cf6' },
    optionText: { flex: 1, color: '#334155', fontSize: 15, fontWeight: '600' },
    optionTextSelected: { color: '#6d28d9', fontWeight: '800' },
    nextBtn: {
        backgroundColor: '#8b5cf6',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 20,
    },
    nextBtnDisabled: { opacity: 0.45 },
    nextBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },

    // Test result
    testResult: { alignItems: 'center', paddingVertical: 30 },
    resultEmoji: { fontSize: 60, marginBottom: 16 },
    resultScore: { fontSize: 48, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
    resultText: {
        fontSize: 16,
        color: '#475569',
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 28,
    },
    testCloseBtn: {
        backgroundColor: '#0D416D',
        paddingVertical: 16,
        paddingHorizontal: 40,
        borderRadius: 16,
    },
    testCloseBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },

    // Empty
    emptyState: { alignItems: 'center', paddingTop: 60 },
    emptyText: {
        color: '#94A3B8',
        fontSize: 15,
        fontWeight: '600',
        marginTop: 12,
        fontStyle: 'italic',
    },
});