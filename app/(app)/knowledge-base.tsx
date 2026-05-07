import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';

import ScreenWrapper from '../../components/ScreenWrapper';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import apiClient, {
  appendPreparedFile,
  buildAbsoluteFileUrl,
  extractList,
  fetchAllPages,
  multipartConfig,
  normalizeUploadFile,
} from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import { safeGoBack } from '../../src/navigation/safeGoBack';
import { getToken, saveToken } from '../../src/utils/storage';

type UserMini = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
};

type KnowledgeAttachment = {
  id: number;
  section: number;
  title?: string;
  attachment_type: 'file' | 'image' | 'link';
  file_url?: string | null;
  url?: string;
  note?: string;
  order?: number;
  created_at?: string;
};

type KnowledgeSection = {
  id: number;
  parent?: number | null;
  title: string;
  slug?: string;
  description?: string;
  icon?: string;
  color?: string;
  cover_image_url?: string | null;
  file_url?: string | null;
  external_url?: string;
  responsible_users?: number[];
  responsible_users_data?: UserMini[];
  attachments?: KnowledgeAttachment[];
  order?: number;
  is_active?: boolean;
  full_path?: string;
  children?: KnowledgeSection[];
  created_at?: string;
  updated_at?: string;
};

type Snippet = {
  id: number;
  section?: number | null;
  section_data?: KnowledgeSection | null;
  section_title?: string;
  title: string;
  content: string;
  content_format?: 'markdown' | 'plain' | 'html';
  category: string;
  order?: number;
  updated_at?: string;
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
  correct?: number;
  order?: number;
};

type TestItem = {
  id: number;
  section?: number | null;
  section_data?: KnowledgeSection | null;
  title: string;
  description?: string;
  questions: Question[];
};

type TabKey = 'knowledge' | 'videos' | 'tests';
type EditorEntity = 'section' | 'snippet' | 'attachment';
type EditorMode = 'create' | 'edit';

const TABS: Array<{ key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'knowledge', label: 'База', icon: 'library-outline' },
  { key: 'videos', label: 'Видео', icon: 'play-circle-outline' },
  { key: 'tests', label: 'Тесты', icon: 'checkmark-done-circle-outline' },
];

const CATEGORIES: Array<{ key: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: '', label: 'Все', icon: 'albums-outline' },
  { key: 'faq', label: 'FAQ', icon: 'help-circle-outline' },
  { key: 'script', label: 'Скрипты', icon: 'chatbubbles-outline' },
  { key: 'requisites', label: 'Реквизиты', icon: 'card-outline' },
  { key: 'links', label: 'Ссылки', icon: 'link-outline' },
];

const SECTION_ICONS: Array<{ key: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'folder', label: 'Папка', icon: 'folder-outline' },
  { key: 'book', label: 'Книга', icon: 'book-outline' },
  { key: 'school', label: 'Обучение', icon: 'school-outline' },
  { key: 'chatbubbles', label: 'Скрипты', icon: 'chatbubbles-outline' },
  { key: 'airplane', label: 'Авиабилеты', icon: 'airplane-outline' },
  { key: 'document-text', label: 'Документы', icon: 'document-text-outline' },
  { key: 'card', label: 'Оплаты', icon: 'card-outline' },
  { key: 'globe', label: 'Международное', icon: 'globe-outline' },
];

function iconOf(key?: string): keyof typeof Ionicons.glyphMap {
  return SECTION_ICONS.find((item) => item.key === key)?.icon || 'folder-outline';
}

function userName(user?: UserMini | null) {
  if (!user) return '—';
  return user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email;
}

function initials(user?: UserMini | null) {
  const name = userName(user);
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function normalizeOptions(options: any): string[] {
  if (Array.isArray(options)) return options.map(String);
  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options);
      if (Array.isArray(parsed)) return parsed.map(String);
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

function buildSectionPath(sectionId: number | null, sections: KnowledgeSection[]) {
  if (!sectionId) return [];
  const byId = new Map<number, KnowledgeSection>();
  sections.forEach((section) => byId.set(section.id, section));

  const path: KnowledgeSection[] = [];
  let current = byId.get(sectionId);
  let guard = 0;

  while (current && guard < 30) {
    path.unshift(current);
    current = current.parent ? byId.get(current.parent) : undefined;
    guard += 1;
  }

  return path;
}

function getYoutubeUrl(url?: string | null) {
  if (!url) return null;
  const clean = String(url).trim();
  const shorts = clean.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/i)?.[1];
  const watch = clean.match(/[?&]v=([a-zA-Z0-9_-]{6,})/i)?.[1];
  const shortLink = clean.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/i)?.[1];
  const embed = clean.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/i)?.[1];
  const id = shorts || watch || shortLink || embed;
  return id ? `https://www.youtube.com/watch?v=${id}` : clean;
}

function markdownStyles(theme: any) {
  return {
    body: { color: theme.textSecondary, fontSize: 14, lineHeight: 21, fontWeight: '600' },
    paragraph: { marginTop: 0, marginBottom: 8 },
    strong: { color: theme.text, fontWeight: '900' },
    heading1: { color: theme.text, fontSize: 22, fontWeight: '900', marginBottom: 8 },
    heading2: { color: theme.text, fontSize: 19, fontWeight: '900', marginBottom: 6 },
    heading3: { color: theme.text, fontSize: 17, fontWeight: '900', marginBottom: 6 },
    bullet_list: { marginBottom: 8 },
    ordered_list: { marginBottom: 8 },
    code_inline: { color: theme.blue, fontWeight: '900' },
    link: { color: theme.blue, fontWeight: '900' },
  };
}

function fileNameFromPicker(asset: any) {
  return asset?.name || asset?.fileName || asset?.uri?.split('/').pop() || 'file';
}

function fileTypeFromPicker(asset: any, fallback = 'application/octet-stream') {
  return asset?.mimeType || asset?.type || fallback;
}

function MiniAvatarStack({ users, theme }: { users?: UserMini[]; theme: any }) {
  const visible = (users || []).slice(0, 4);
  const extra = Math.max((users || []).length - visible.length, 0);

  if (!visible.length) return null;

  return (
    <View style={styles.avatarStack}>
      {visible.map((item, index) => (
        <View
          key={item.id}
          style={[
            styles.avatarMini,
            {
              backgroundColor: index % 2 === 0 ? theme.blue : '#1AAE6F',
              borderColor: theme.surface,
              marginLeft: index === 0 ? 0 : -8,
            },
          ]}
        >
          <Text style={styles.avatarMiniText}>{initials(item)}</Text>
        </View>
      ))}
      {extra > 0 && (
        <View style={[styles.avatarMini, { backgroundColor: theme.backgroundSoft, borderColor: theme.surface, marginLeft: -8 }]}>
          <Text style={[styles.avatarExtraText, { color: theme.text }]}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

export default function KnowledgeBaseScreen() {
  const router = useRouter();
  const { theme, themeMode } = useTheme();
  const { user } = useCurrentUser();

  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');
  const canEdit = Boolean(user);
  const dark = themeMode === 'dark';

  const [tab, setTab] = useState<TabKey>('knowledge');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sections, setSections] = useState<KnowledgeSection[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [users, setUsers] = useState<UserMini[]>([]);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorEntity, setEditorEntity] = useState<EditorEntity>('snippet');
  const [editorMode, setEditorMode] = useState<EditorMode>('create');
  const [editingId, setEditingId] = useState<number | null>(null);

  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionDescription, setSectionDescription] = useState('');
  const [sectionIcon, setSectionIcon] = useState('folder');
  const [sectionParent, setSectionParent] = useState<number | null>(null);
  const [sectionUrl, setSectionUrl] = useState('');
  const [sectionResponsibles, setSectionResponsibles] = useState<number[]>([]);
  const [sectionCover, setSectionCover] = useState<any>(null);
  const [sectionFile, setSectionFile] = useState<any>(null);

  const [snippetTitle, setSnippetTitle] = useState('');
  const [snippetContent, setSnippetContent] = useState('');
  const [snippetCategory, setSnippetCategory] = useState('faq');
  const [snippetSection, setSnippetSection] = useState<number | null>(null);

  const [attachmentType, setAttachmentType] = useState<'link' | 'image' | 'file'>('link');
  const [attachmentTitle, setAttachmentTitle] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentNote, setAttachmentNote] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<any>(null);

  const [activeTest, setActiveTest] = useState<TestItem | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [testResult, setTestResult] = useState<{ score: number; total: number } | null>(null);
  const [submittingTest, setSubmittingTest] = useState(false);

  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeSectionId) || null,
    [sections, activeSectionId]
  );

  const sectionPath = useMemo(() => buildSectionPath(activeSectionId, sections), [activeSectionId, sections]);

  const childSections = useMemo(() => {
    const list = sections.filter((section) => (section.parent ?? null) === activeSectionId && section.is_active !== false);
    return list.sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || a.title.localeCompare(b.title));
  }, [sections, activeSectionId]);

  const filteredSnippets = useMemo(() => {
    let list = snippets;

    if (activeSectionId) {
      list = list.filter((item) => (item.section ?? item.section_data?.id ?? null) === activeSectionId);
    } else if (sections.length > 0) {
      list = list.filter((item) => !(item.section ?? item.section_data?.id));
    }

    if (category) list = list.filter((item) => item.category === category);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = snippets.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          stripHtml(item.content).toLowerCase().includes(q) ||
          String(item.section_title || item.section_data?.title || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [snippets, activeSectionId, category, search, sections.length]);

  const filteredVideos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter((item) => item.title.toLowerCase().includes(q) || String(item.description || '').toLowerCase().includes(q));
  }, [videos, search]);

  const filteredTests = useMemo(() => {
    let list = tests;

    if (activeSectionId) {
      list = list.filter((item) => (item.section ?? item.section_data?.id ?? null) === activeSectionId);
    } else if (sections.length > 0) {
      list = list.filter((item) => !(item.section ?? item.section_data?.id));
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = tests.filter(
        (item) => item.title.toLowerCase().includes(q) || String(item.description || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [tests, activeSectionId, search, sections.length]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const [cachedSections, cachedSnippets, cachedVideos, cachedTests] = await Promise.all([
        getToken('cache_knowledge_sections_v2'),
        getToken('cache_snippets_v2'),
        getToken('cache_videos_v2'),
        getToken('cache_tests_v2'),
      ]);

      if (cachedSections) setSections(JSON.parse(cachedSections));
      if (cachedSnippets) setSnippets(JSON.parse(cachedSnippets));
      if (cachedVideos) setVideos(JSON.parse(cachedVideos));
      if (cachedTests) setTests(JSON.parse(cachedTests));

      const [sectionsRes, snippetsRes, videosRes, testsRes, usersRes] = await Promise.allSettled([
        apiClient.get('documents/knowledge-sections/?limit=300&offset=0'),
        apiClient.get('documents/snippets/?limit=300&offset=0'),
        apiClient.get('gamification/tutorials/?limit=100&offset=0'),
        apiClient.get('documents/knowledge-tests/?limit=100&offset=0'),
        fetchAllPages('users/users/?limit=100&offset=0'),
      ]);

      if (sectionsRes.status === 'fulfilled') {
        const data = extractList(sectionsRes.value.data);
        setSections(data);
        await saveToken('cache_knowledge_sections_v2', JSON.stringify(data));
      }

      if (snippetsRes.status === 'fulfilled') {
        const data = extractList(snippetsRes.value.data);
        setSnippets(data);
        await saveToken('cache_snippets_v2', JSON.stringify(data));
      }

      if (videosRes.status === 'fulfilled') {
        const data = extractList(videosRes.value.data);
        setVideos(data);
        await saveToken('cache_videos_v2', JSON.stringify(data));
      }

      if (testsRes.status === 'fulfilled') {
        const data = extractList(testsRes.value.data);
        setTests(data);
        await saveToken('cache_tests_v2', JSON.stringify(data));
      }

      if (usersRes.status === 'fulfilled') {
        setUsers(usersRes.value as UserMini[]);
      }
    } catch (error) {
      console.log('Knowledge base load error', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetEditor = () => {
    setEditorMode('create');
    setEditingId(null);
    setSectionTitle('');
    setSectionDescription('');
    setSectionIcon('folder');
    setSectionParent(activeSectionId);
    setSectionUrl('');
    setSectionResponsibles([]);
    setSectionCover(null);
    setSectionFile(null);
    setSnippetTitle('');
    setSnippetContent('');
    setSnippetCategory('faq');
    setSnippetSection(activeSectionId);
    setAttachmentType('link');
    setAttachmentTitle('');
    setAttachmentUrl('');
    setAttachmentNote('');
    setAttachmentFile(null);
  };

  const openCreate = (entity: EditorEntity) => {
    resetEditor();
    setEditorEntity(entity);
    setEditorMode('create');
    setEditorOpen(true);
  };

  const openEditSection = (section: KnowledgeSection) => {
    resetEditor();
    setEditorEntity('section');
    setEditorMode('edit');
    setEditingId(section.id);
    setSectionTitle(section.title || '');
    setSectionDescription(section.description || '');
    setSectionIcon(section.icon || 'folder');
    setSectionParent(section.parent ?? null);
    setSectionUrl(section.external_url || '');
    setSectionResponsibles(section.responsible_users || section.responsible_users_data?.map((u) => u.id) || []);
    setEditorOpen(true);
  };

  const openEditSnippet = (snippet: Snippet) => {
    resetEditor();
    setEditorEntity('snippet');
    setEditorMode('edit');
    setEditingId(snippet.id);
    setSnippetTitle(snippet.title || '');
    setSnippetContent(snippet.content || '');
    setSnippetCategory(snippet.category || 'faq');
    setSnippetSection(snippet.section ?? snippet.section_data?.id ?? null);
    setEditorOpen(true);
  };

  const pickSectionCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Нет доступа', 'Разреши доступ к галерее.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
      selectionLimit: 1,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setSectionCover(
      normalizeUploadFile(
        {
          uri: asset.uri,
          name: asset.fileName || asset.uri.split('/').pop() || 'cover.jpg',
          type: asset.mimeType || 'image/jpeg',
        },
        'cover.jpg'
      )
    );
  };

  const pickSectionFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setSectionFile(
      normalizeUploadFile(
        {
          uri: asset.uri,
          name: fileNameFromPicker(asset),
          type: fileTypeFromPicker(asset),
        },
        fileNameFromPicker(asset)
      )
    );
  };

  const pickAttachmentImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Нет доступа', 'Разреши доступ к галерее.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, selectionLimit: 1 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setAttachmentFile(
      normalizeUploadFile(
        {
          uri: asset.uri,
          name: asset.fileName || asset.uri.split('/').pop() || 'image.jpg',
          type: asset.mimeType || 'image/jpeg',
        },
        'image.jpg'
      )
    );
    setAttachmentType('image');
  };

  const pickAttachmentFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setAttachmentFile(
      normalizeUploadFile(
        {
          uri: asset.uri,
          name: fileNameFromPicker(asset),
          type: fileTypeFromPicker(asset),
        },
        fileNameFromPicker(asset)
      )
    );
    setAttachmentType('file');
  };

  const toggleResponsible = (id: number) => {
    setSectionResponsibles((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submitEditor = async () => {
    if (!canEdit) return;
    setSaving(true);

    try {
      if (editorEntity === 'section') {
        if (!sectionTitle.trim()) {
          Alert.alert('Ошибка', 'Напиши название раздела.');
          return;
        }

        const hasSectionFiles = Boolean(sectionCover?.uri || sectionFile?.uri);

        if (hasSectionFiles) {
          const fd = new FormData();

          fd.append('title', sectionTitle.trim());
          fd.append('description', sectionDescription.trim());
          fd.append('icon', sectionIcon || 'folder');
          fd.append('parent', sectionParent ? String(sectionParent) : '');
          fd.append('external_url', sectionUrl.trim());
          fd.append('is_active', 'true');

          sectionResponsibles.forEach((id) => {
            fd.append('responsible_users', String(id));
          });

          if (sectionCover?.uri) {
            await appendPreparedFile(fd, 'cover_image', sectionCover, 'cover.jpg');
          }

          if (sectionFile?.uri) {
            await appendPreparedFile(fd, 'file', sectionFile, sectionFile.name || 'file');
          }

          if (editorMode === 'create') {
            await apiClient.post('documents/knowledge-sections/', fd, multipartConfig);
          } else {
            await apiClient.patch(`documents/knowledge-sections/${editingId}/`, fd, multipartConfig);
          }
        } else {
          const payload = {
            title: sectionTitle.trim(),
            description: sectionDescription.trim(),
            icon: sectionIcon || 'folder',
            parent: sectionParent || null,
            external_url: sectionUrl.trim(),
            is_active: true,
            responsible_users: sectionResponsibles,
          };

          if (editorMode === 'create') {
            await apiClient.post('documents/knowledge-sections/', payload);
          } else {
            await apiClient.patch(`documents/knowledge-sections/${editingId}/`, payload);
          }
        }
      }

      if (editorEntity === 'snippet') {
        if (!snippetTitle.trim() || !snippetContent.trim()) {
          Alert.alert('Ошибка', 'Заполни название и текст.');
          return;
        }

        const payload = {
          title: snippetTitle.trim(),
          content: snippetContent.trim(),
          content_format: 'markdown',
          category: snippetCategory || 'faq',
          section: snippetSection || null,
          order: 0,
        };

        if (editorMode === 'create') {
          await apiClient.post('documents/snippets/', payload);
        } else {
          await apiClient.patch(`documents/snippets/${editingId}/`, payload);
        }
      }

      if (editorEntity === 'attachment') {
        if (!activeSectionId) {
          Alert.alert('Ошибка', 'Сначала открой раздел.');
          return;
        }

        if (attachmentType === 'link' && !attachmentUrl.trim()) {
          Alert.alert('Ошибка', 'Укажи ссылку.');
          return;
        }

        if ((attachmentType === 'image' || attachmentType === 'file') && !attachmentFile?.uri) {
          Alert.alert('Ошибка', 'Выбери файл или фото.');
          return;
        }

        const fd = new FormData();
        fd.append('section', String(activeSectionId));
        fd.append('attachment_type', attachmentType);
        fd.append('title', attachmentTitle.trim());
        fd.append('note', attachmentNote.trim());

        if (attachmentType === 'link') {
          fd.append('url', attachmentUrl.trim());
        } else {
          await appendPreparedFile(fd, 'file', attachmentFile, attachmentFile.name || 'file');
        }

        await apiClient.post('documents/knowledge-section-attachments/', fd, multipartConfig);
      }

      setEditorOpen(false);
      resetEditor();
      await loadData(true);
      Alert.alert('Готово', editorMode === 'create' ? 'Добавлено.' : 'Обновлено.');
    } catch (error: any) {
      const data = error?.response?.data;
      const detail =
        data?.detail ||
        data?.title?.[0] ||
        data?.file?.[0] ||
        data?.url?.[0] ||
        data?.parent?.[0] ||
        data?.external_url?.[0] ||
        data?.responsible_users?.[0] ||
        'Не удалось сохранить.';

      Alert.alert('Ошибка', String(detail));
    } finally {
      setSaving(false);
    }
  };

  const deleteSection = (section: KnowledgeSection) => {
    if (!canEdit) {
      Alert.alert('Нет доступа', 'Удалять разделы могут только авторизованные пользователи.');
      return;
    }

    Alert.alert(
      'Удалить раздел?',
      `Раздел "${section.title}" будет удалён. Если внутри есть подразделы или файлы, они тоже могут удалиться.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`documents/knowledge-sections/${section.id}/`);

              if (activeSectionId === section.id) {
                setActiveSectionId(section.parent ?? null);
              }

              setSections((prev) => prev.filter((item) => item.id !== section.id));
              await loadData(true);

              Alert.alert('Готово', 'Раздел удалён.');
            } catch (error: any) {
              const detail =
                error?.response?.data?.detail ||
                error?.response?.data?.non_field_errors?.[0] ||
                'Не удалось удалить раздел. Проверь права доступа.';

              Alert.alert('Ошибка', String(detail));
            }
          },
        },
      ]
    );
  };

  const deleteSnippet = (snippet: Snippet) => {
    if (!isAdmin) return;
    Alert.alert('Удалить запись?', snippet.title, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`documents/snippets/${snippet.id}/`);
            await loadData(true);
          } catch (error: any) {
            Alert.alert('Ошибка', error?.response?.data?.detail || 'Удалять может только администратор.');
          }
        },
      },
    ]);
  };

  const copySnippet = async (snippet: Snippet) => {
    await Clipboard.setStringAsync(stripHtml(snippet.content));
    Alert.alert('Скопировано', snippet.title);
  };

  const openUrl = async (url?: string | null) => {
  const absoluteUrl = buildAbsoluteFileUrl(url);
  if (!absoluteUrl) return;

  try {
    await WebBrowser.openBrowserAsync(absoluteUrl);
  } catch {
      Alert.alert('Ошибка', 'Не удалось открыть ссылку.');
    }
  };

  const startTest = (test: TestItem) => {
    setActiveTest(test);
    setAnswers({});
    setTestResult(null);
  };

  const submitTest = async () => {
    if (!activeTest) return;
    setSubmittingTest(true);

    try {
      const payloadAnswers: Record<string, number> = {};
      activeTest.questions.forEach((q, index) => {
        const key = q.id ?? index + 100000;
        if (q.id && typeof answers[key] === 'number') payloadAnswers[String(q.id)] = answers[key];
      });

      const response = await apiClient.post(`documents/knowledge-tests/${activeTest.id}/submit/`, { answers: payloadAnswers });
      setTestResult({ score: response.data?.score ?? 0, total: response.data?.total ?? activeTest.questions.length });
    } catch (error: any) {
      Alert.alert('Ошибка', error?.response?.data?.detail || 'Не удалось отправить тест.');
    } finally {
      setSubmittingTest(false);
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
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
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
        <LinearGradient
          colors={dark ? ['#111827', '#1E3A8A'] : ['#2563EB', '#60A5FA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <Pressable onPress={() => safeGoBack(router, '/(app)/profile')} style={styles.heroBackBtn}>
              <Ionicons name="arrow-back" size={21} color="#fff" />
            </Pressable>
            {canEdit && (
              <Pressable onPress={() => openCreate('section')} style={styles.heroAddBtn}>
                <Ionicons name="folder-open-outline" size={17} color="#fff" />
                <Text style={styles.heroAddText}>Раздел</Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.heroKicker}>Students Life</Text>
          <Text style={styles.heroTitle}>База знаний</Text>
          <Text style={styles.heroSubtitle}>Разделы, markdown-инструкции, файлы, фото, ссылки и ответственные сотрудники.</Text>

          <View style={styles.heroStats}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{sections.length}</Text>
              <Text style={styles.heroStatLabel}>Разделов</Text>
            </View>
            <View style={styles.heroLine} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{snippets.length}</Text>
              <Text style={styles.heroStatLabel}>Материалов</Text>
            </View>
            <View style={styles.heroLine} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{tests.length}</Text>
              <Text style={styles.heroStatLabel}>Тестов</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.tabsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {TABS.map((item) => {
            const active = tab === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setTab(item.key)}
                style={[styles.tabBtn, { backgroundColor: active ? theme.blue : 'transparent' }]}
              >
                <Ionicons name={item.icon} size={17} color={active ? '#fff' : theme.blue} />
                <Text style={[styles.tabText, { color: active ? '#fff' : theme.text }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.searchCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.searchBox, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
            <Ionicons name="search" size={18} color={theme.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Поиск по базе знаний"
              placeholderTextColor={theme.textMuted}
              style={[styles.searchInput, { color: theme.text }]}
            />
            {!!search && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={theme.textMuted} />
              </Pressable>
            )}
          </View>

          {tab === 'knowledge' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {CATEGORIES.map((item) => {
                const active = category === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setCategory(item.key)}
                    style={[styles.filterPill, { backgroundColor: active ? theme.blue : theme.backgroundSoft, borderColor: active ? theme.blue : theme.border }]}
                  >
                    <Ionicons name={item.icon} size={15} color={active ? '#fff' : theme.blue} />
                    <Text style={[styles.filterText, { color: active ? '#fff' : theme.text }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {sectionPath.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.breadcrumbRow}>
            <Pressable onPress={() => setActiveSectionId(null)} style={[styles.breadcrumbPill, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
              <Text style={[styles.breadcrumbText, { color: theme.textSecondary }]}>Главная</Text>
            </Pressable>
            {sectionPath.map((section) => (
              <Pressable key={section.id} onPress={() => setActiveSectionId(section.id)} style={[styles.breadcrumbPill, { backgroundColor: theme.blueSoft, borderColor: theme.border }]}>
                <Text style={[styles.breadcrumbText, { color: theme.blue }]}>{section.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {tab === 'knowledge' && activeSection && (
          <View style={[styles.sectionInfoCard, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
            {activeSection.cover_image_url ? <Image source={{ uri: activeSection.cover_image_url }} style={styles.sectionCover} contentFit="cover" /> : null}
            <View style={styles.sectionInfoTop}>
              <View style={[styles.sectionInfoIcon, { backgroundColor: theme.blueSoft }]}>
                <Ionicons name={iconOf(activeSection.icon)} size={22} color={theme.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionInfoTitle, { color: theme.text }]}>{activeSection.title}</Text>
                {!!activeSection.full_path && <Text style={[styles.sectionInfoSub, { color: theme.textSecondary }]}>{activeSection.full_path}</Text>}
              </View>
              {canEdit && (
                <Pressable onPress={() => openEditSection(activeSection)} style={[styles.smallIconBtn, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                  <Ionicons name="create-outline" size={17} color={theme.blue} />
                </Pressable>
              )}
            </View>

            {!!activeSection.description && <Markdown style={markdownStyles(theme) as any}>{activeSection.description}</Markdown>}

            {(activeSection.responsible_users_data || []).length > 0 && (
              <View style={styles.responsibleRow}>
                <MiniAvatarStack users={activeSection.responsible_users_data} theme={theme} />
                <Text style={[styles.responsibleText, { color: theme.textSecondary }]} numberOfLines={1}>
                  Ответственные: {(activeSection.responsible_users_data || []).map(userName).join(', ')}
                </Text>
              </View>
            )}

            <View style={styles.sectionLinkRow}>
              {!!activeSection.file_url && (
                <Pressable onPress={() => openUrl(activeSection.file_url)} style={[styles.resourcePill, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                  <Ionicons name="document-outline" size={15} color={theme.blue} />
                  <Text style={[styles.resourceText, { color: theme.text }]}>Файл раздела</Text>
                </Pressable>
              )}
              {!!activeSection.external_url && (
                <Pressable onPress={() => openUrl(activeSection.external_url)} style={[styles.resourcePill, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                  <Ionicons name="link-outline" size={15} color={theme.blue} />
                  <Text style={[styles.resourceText, { color: theme.text }]}>Ссылка</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {tab === 'knowledge' && (
          <View style={styles.actionRow}>
            {canEdit && (
              <>
                <Pressable onPress={() => openCreate('section')} style={[styles.actionBtn, { backgroundColor: theme.blue }]}>
                  <Ionicons name="folder-open-outline" size={18} color="#fff" />
                  <Text style={styles.actionText}>Раздел</Text>
                </Pressable>
                <Pressable onPress={() => openCreate('snippet')} style={[styles.actionBtn, { backgroundColor: '#1AAE6F' }]}>
                  <Ionicons name="document-text-outline" size={18} color="#fff" />
                  <Text style={styles.actionText}>Материал</Text>
                </Pressable>
                {activeSectionId && (
                  <Pressable onPress={() => openCreate('attachment')} style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}>
                    <Ionicons name="attach-outline" size={18} color="#fff" />
                    <Text style={styles.actionText}>Файл</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}

        {tab === 'knowledge' && childSections.length > 0 && (
          <>
            <Text style={[styles.bigTitle, { color: theme.text }]}>Разделы</Text>
            {childSections.map((section) => (
              <Pressable key={section.id} onPress={() => setActiveSectionId(section.id)} style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
                {section.cover_image_url ? <Image source={{ uri: section.cover_image_url }} style={styles.sectionCardImage} contentFit="cover" /> : null}
                <View style={styles.sectionCardBody}>
                  <View style={[styles.sectionIcon, { backgroundColor: theme.blueSoft }]}>
                    <Ionicons name={iconOf(section.icon)} size={21} color={theme.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
                    {!!section.description && <Text style={[styles.sectionDescription, { color: theme.textSecondary }]} numberOfLines={2}>{stripHtml(section.description)}</Text>}
                    {(section.responsible_users_data || []).length > 0 && <MiniAvatarStack users={section.responsible_users_data} theme={theme} />}
                  </View>
                  <View style={styles.cardRightActions}>
                    {canEdit && (
                      <Pressable onPress={() => openEditSection(section)} style={[styles.smallIconBtn, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                        <Ionicons name="create-outline" size={16} color={theme.blue} />
                      </Pressable>
                    )}
                    {canEdit && (
                      <Pressable onPress={() => deleteSection(section)} style={[styles.smallIconBtn, { backgroundColor: theme.redSoft, borderColor: theme.border }]}>
                        <Ionicons name="trash-outline" size={16} color={theme.red} />
                      </Pressable>
                    )}
                    <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
                  </View>
                </View>
              </Pressable>
            ))}
          </>
        )}

        {tab === 'knowledge' && activeSection && (activeSection.attachments || []).length > 0 && (
          <>
            <Text style={[styles.bigTitle, { color: theme.text }]}>Файлы, фото и ссылки</Text>
            {(activeSection.attachments || []).map((item) => (
              <Pressable key={item.id} onPress={() => openUrl(item.file_url || item.url)} style={[styles.attachmentCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[styles.attachmentIcon, { backgroundColor: theme.blueSoft }]}>
                  <Ionicons name={item.attachment_type === 'image' ? 'image-outline' : item.attachment_type === 'link' ? 'link-outline' : 'document-outline'} size={19} color={theme.blue} />
                </View>
                {item.attachment_type === 'image' && item.file_url ? <Image source={{ uri: item.file_url }} style={styles.attachmentImage} contentFit="cover" /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.attachmentTitle, { color: theme.text }]}>{item.title || item.url || 'Материал'}</Text>
                  {!!item.note && <Text style={[styles.attachmentNote, { color: theme.textSecondary }]} numberOfLines={2}>{item.note}</Text>}
                </View>
                <Ionicons name="open-outline" size={18} color={theme.textMuted} />
              </Pressable>
            ))}
          </>
        )}

        {tab === 'knowledge' && (
          <>
            <Text style={[styles.bigTitle, { color: theme.text }]}>Материалы</Text>
            {filteredSnippets.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="document-text-outline" size={34} color={theme.textMuted} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Материалов в этом разделе пока нет.</Text>
              </View>
            ) : (
              filteredSnippets.map((snippet) => (
                <View key={snippet.id} style={[styles.snippetCard, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>
                  <View style={styles.snippetTop}>
                    <View style={[styles.snippetIcon, { backgroundColor: theme.blueSoft }]}>
                      <Ionicons name="document-text-outline" size={19} color={theme.blue} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.snippetTitle, { color: theme.text }]}>{snippet.title}</Text>
                      <Text style={[styles.snippetMeta, { color: theme.textSecondary }]}>{snippet.section_title || snippet.section_data?.title || 'Без раздела'} · {snippet.category}</Text>
                    </View>
                    <Pressable onPress={() => copySnippet(snippet)} style={[styles.smallIconBtn, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                      <Ionicons name="copy-outline" size={16} color={theme.blue} />
                    </Pressable>
                    {canEdit && (
                      <Pressable onPress={() => openEditSnippet(snippet)} style={[styles.smallIconBtn, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                        <Ionicons name="create-outline" size={16} color={theme.blue} />
                      </Pressable>
                    )}
                    {isAdmin && (
                      <Pressable onPress={() => deleteSnippet(snippet)} style={[styles.smallIconBtn, { backgroundColor: theme.redSoft, borderColor: theme.border }]}>
                        <Ionicons name="trash-outline" size={16} color={theme.red} />
                      </Pressable>
                    )}
                  </View>
                  <Markdown style={markdownStyles(theme) as any}>{snippet.content || ''}</Markdown>
                </View>
              ))
            )}
          </>
        )}

        {tab === 'videos' && (
          <>
            {filteredVideos.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="play-circle-outline" size={34} color={theme.textMuted} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Видео пока нет.</Text>
              </View>
            ) : (
              filteredVideos.map((video) => (
                <Pressable key={video.id} onPress={() => openUrl(getYoutubeUrl(video.youtube_url) || video.video_file)} style={[styles.videoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={[styles.videoIcon, { backgroundColor: theme.blueSoft }]}>
                    <Ionicons name="play" size={22} color={theme.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.videoTitle, { color: theme.text }]}>{video.title}</Text>
                    {!!video.description && <Text style={[styles.videoDescription, { color: theme.textSecondary }]} numberOfLines={2}>{video.description}</Text>}
                  </View>
                  <Ionicons name="open-outline" size={18} color={theme.textMuted} />
                </Pressable>
              ))
            )}
          </>
        )}

        {tab === 'tests' && (
          <>
            {filteredTests.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="checkmark-done-circle-outline" size={34} color={theme.textMuted} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Тестов пока нет.</Text>
              </View>
            ) : (
              filteredTests.map((test) => (
                <Pressable key={test.id} onPress={() => startTest(test)} style={[styles.testCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={[styles.testIcon, { backgroundColor: theme.blueSoft }]}>
                    <Ionicons name="checkmark-done-circle-outline" size={21} color={theme.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.testTitle, { color: theme.text }]}>{test.title}</Text>
                    {!!test.description && <Text style={[styles.testDescription, { color: theme.textSecondary }]} numberOfLines={2}>{test.description}</Text>}
                    <Text style={[styles.testMeta, { color: theme.textMuted }]}>{test.questions?.length || 0} вопросов</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={editorOpen} animationType="slide" transparent onRequestClose={() => setEditorOpen(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, { backgroundColor: theme.card || theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {editorMode === 'create' ? 'Добавить' : 'Редактировать'} {editorEntity === 'section' ? 'раздел' : editorEntity === 'snippet' ? 'материал' : 'файл/ссылку'}
                </Text>
                <Text style={[styles.modalSub, { color: theme.textSecondary }]}>Markdown поддерживается в описаниях и материалах</Text>
              </View>
              <Pressable onPress={() => setEditorOpen(false)} style={[styles.modalClose, { backgroundColor: theme.backgroundSoft }]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              {editorEntity === 'section' && (
                <>
                  <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Название раздела</Text>
                    <TextInput value={sectionTitle} onChangeText={setSectionTitle} placeholder="Например: Визы" placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} />
                  </View>
                  <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Описание Markdown</Text>
                    <TextInput value={sectionDescription} onChangeText={setSectionDescription} placeholder={'## Описание\n- правила\n- ссылки\n**важное**'} placeholderTextColor={theme.textMuted} style={[styles.input, styles.textarea, { color: theme.text }]} multiline textAlignVertical="top" />
                  </View>

                  <Text style={[styles.modalBlockTitle, { color: theme.text }]}>Иконка</Text>
                  <View style={styles.wrapRow}>
                    {SECTION_ICONS.map((item) => {
                      const active = sectionIcon === item.key;
                      return (
                        <Pressable key={item.key} onPress={() => setSectionIcon(item.key)} style={[styles.choicePill, { backgroundColor: active ? theme.blue : theme.backgroundSoft, borderColor: active ? theme.blue : theme.border }]}>
                          <Ionicons name={item.icon} size={15} color={active ? '#fff' : theme.blue} />
                          <Text style={[styles.choiceText, { color: active ? '#fff' : theme.text }]}>{item.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={[styles.modalBlockTitle, { color: theme.text }]}>Родительский раздел</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                    <Pressable onPress={() => setSectionParent(null)} style={[styles.choicePill, { backgroundColor: sectionParent === null ? theme.blue : theme.backgroundSoft, borderColor: sectionParent === null ? theme.blue : theme.border }]}>
                      <Text style={[styles.choiceText, { color: sectionParent === null ? '#fff' : theme.text }]}>Главная</Text>
                    </Pressable>
                    {sections.filter((s) => s.id !== editingId).map((section) => (
                      <Pressable key={section.id} onPress={() => setSectionParent(section.id)} style={[styles.choicePill, { backgroundColor: sectionParent === section.id ? theme.blue : theme.backgroundSoft, borderColor: sectionParent === section.id ? theme.blue : theme.border }]}>
                        <Text style={[styles.choiceText, { color: sectionParent === section.id ? '#fff' : theme.text }]}>{section.title}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Ссылка раздела</Text>
                    <TextInput value={sectionUrl} onChangeText={setSectionUrl} placeholder="https://..." placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} autoCapitalize="none" keyboardType="url" />
                  </View>

                  <View style={styles.actionRow}>
                    <Pressable onPress={pickSectionCover} style={[styles.modalActionBtn, { backgroundColor: theme.blueSoft }]}>
                      <Ionicons name="image-outline" size={17} color={theme.blue} />
                      <Text style={[styles.modalActionText, { color: theme.blue }]}>{sectionCover?.name || 'Фото'}</Text>
                    </Pressable>
                    <Pressable onPress={pickSectionFile} style={[styles.modalActionBtn, { backgroundColor: theme.blueSoft }]}>
                      <Ionicons name="document-outline" size={17} color={theme.blue} />
                      <Text style={[styles.modalActionText, { color: theme.blue }]}>{sectionFile?.name || 'Файл'}</Text>
                    </Pressable>
                  </View>

                  <Text style={[styles.modalBlockTitle, { color: theme.text }]}>Ответственные сотрудники</Text>
                  <View style={styles.wrapRow}>
                    {users.map((item) => {
                      const active = sectionResponsibles.includes(item.id);
                      return (
                        <Pressable key={item.id} onPress={() => toggleResponsible(item.id)} style={[styles.choicePill, { backgroundColor: active ? theme.blue : theme.backgroundSoft, borderColor: active ? theme.blue : theme.border }]}>
                          <Text style={[styles.choiceText, { color: active ? '#fff' : theme.text }]}>{userName(item)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              {editorEntity === 'snippet' && (
                <>
                  <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Название</Text>
                    <TextInput value={snippetTitle} onChangeText={setSnippetTitle} placeholder="Название материала" placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} />
                  </View>
                  <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Текст Markdown</Text>
                    <TextInput value={snippetContent} onChangeText={setSnippetContent} placeholder={'## Инструкция\n- пункт 1\n- пункт 2\n**важно**'} placeholderTextColor={theme.textMuted} style={[styles.input, styles.textareaBig, { color: theme.text }]} multiline textAlignVertical="top" />
                  </View>

                  <Text style={[styles.modalBlockTitle, { color: theme.text }]}>Категория</Text>
                  <View style={styles.wrapRow}>
                    {CATEGORIES.filter((item) => item.key).map((item) => {
                      const active = snippetCategory === item.key;
                      return (
                        <Pressable key={item.key} onPress={() => setSnippetCategory(item.key)} style={[styles.choicePill, { backgroundColor: active ? theme.blue : theme.backgroundSoft, borderColor: active ? theme.blue : theme.border }]}>
                          <Ionicons name={item.icon} size={15} color={active ? '#fff' : theme.blue} />
                          <Text style={[styles.choiceText, { color: active ? '#fff' : theme.text }]}>{item.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={[styles.modalBlockTitle, { color: theme.text }]}>Раздел</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                    <Pressable onPress={() => setSnippetSection(null)} style={[styles.choicePill, { backgroundColor: snippetSection === null ? theme.blue : theme.backgroundSoft, borderColor: snippetSection === null ? theme.blue : theme.border }]}>
                      <Text style={[styles.choiceText, { color: snippetSection === null ? '#fff' : theme.text }]}>Без раздела</Text>
                    </Pressable>
                    {sections.map((section) => (
                      <Pressable key={section.id} onPress={() => setSnippetSection(section.id)} style={[styles.choicePill, { backgroundColor: snippetSection === section.id ? theme.blue : theme.backgroundSoft, borderColor: snippetSection === section.id ? theme.blue : theme.border }]}>
                        <Text style={[styles.choiceText, { color: snippetSection === section.id ? '#fff' : theme.text }]}>{section.title}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              )}

              {editorEntity === 'attachment' && (
                <>
                  <View style={styles.actionRow}>
                    <Pressable onPress={() => setAttachmentType('link')} style={[styles.modalActionBtn, { backgroundColor: attachmentType === 'link' ? theme.blue : theme.blueSoft }]}>
                      <Ionicons name="link-outline" size={17} color={attachmentType === 'link' ? '#fff' : theme.blue} />
                      <Text style={[styles.modalActionText, { color: attachmentType === 'link' ? '#fff' : theme.blue }]}>Ссылка</Text>
                    </Pressable>
                    <Pressable onPress={pickAttachmentImage} style={[styles.modalActionBtn, { backgroundColor: attachmentType === 'image' ? theme.blue : theme.blueSoft }]}>
                      <Ionicons name="image-outline" size={17} color={attachmentType === 'image' ? '#fff' : theme.blue} />
                      <Text style={[styles.modalActionText, { color: attachmentType === 'image' ? '#fff' : theme.blue }]}>Фото</Text>
                    </Pressable>
                    <Pressable onPress={pickAttachmentFile} style={[styles.modalActionBtn, { backgroundColor: attachmentType === 'file' ? theme.blue : theme.blueSoft }]}>
                      <Ionicons name="document-outline" size={17} color={attachmentType === 'file' ? '#fff' : theme.blue} />
                      <Text style={[styles.modalActionText, { color: attachmentType === 'file' ? '#fff' : theme.blue }]}>Файл</Text>
                    </Pressable>
                  </View>
                  <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Название</Text>
                    <TextInput value={attachmentTitle} onChangeText={setAttachmentTitle} placeholder="Название материала" placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} />
                  </View>
                  {attachmentType === 'link' ? (
                    <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>URL</Text>
                      <TextInput value={attachmentUrl} onChangeText={setAttachmentUrl} placeholder="https://..." placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} autoCapitalize="none" keyboardType="url" />
                    </View>
                  ) : (
                    <View style={[styles.selectedFileBox, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                      <Ionicons name={attachmentType === 'image' ? 'image-outline' : 'document-outline'} size={20} color={theme.blue} />
                      <Text style={[styles.selectedFileText, { color: theme.text }]}>{attachmentFile?.name || 'Файл не выбран'}</Text>
                    </View>
                  )}
                  <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Комментарий</Text>
                    <TextInput value={attachmentNote} onChangeText={setAttachmentNote} placeholder="Описание файла или ссылки" placeholderTextColor={theme.textMuted} style={[styles.input, styles.textarea, { color: theme.text }]} multiline textAlignVertical="top" />
                  </View>
                </>
              )}

              <Pressable onPress={submitEditor} disabled={saving} style={[styles.saveBtn, { backgroundColor: theme.blue, opacity: saving ? 0.65 : 1 }]}>
                {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={18} color="#fff" />}
                <Text style={styles.saveText}>{saving ? 'Сохранение...' : 'Сохранить'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!activeTest} animationType="slide" transparent onRequestClose={() => setActiveTest(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card || theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{activeTest?.title}</Text>
              <Pressable onPress={() => setActiveTest(null)} style={[styles.modalClose, { backgroundColor: theme.backgroundSoft }]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              {!!activeTest?.description && <Text style={[styles.testDescription, { color: theme.textSecondary }]}>{activeTest.description}</Text>}
              {(activeTest?.questions || []).map((question, index) => {
                const key = question.id ?? index + 100000;
                const options = normalizeOptions(question.options);
                return (
                  <View key={key} style={[styles.questionCard, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                    <Text style={[styles.questionText, { color: theme.text }]}>{index + 1}. {question.text}</Text>
                    {options.map((option, optionIndex) => {
                      const active = answers[key] === optionIndex;
                      return (
                        <Pressable key={optionIndex} onPress={() => setAnswers((prev) => ({ ...prev, [key]: optionIndex }))} style={[styles.answerBtn, { backgroundColor: active ? theme.blue : theme.surface, borderColor: active ? theme.blue : theme.border }]}>
                          <Text style={[styles.answerText, { color: active ? '#fff' : theme.text }]}>{option}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
              {testResult ? (
                <View style={[styles.resultBox, { backgroundColor: theme.blueSoft }]}>
                  <Text style={[styles.resultText, { color: theme.blue }]}>Результат: {testResult.score}/{testResult.total}</Text>
                </View>
              ) : (
                <Pressable onPress={submitTest} disabled={submittingTest} style={[styles.saveBtn, { backgroundColor: theme.blue, opacity: submittingTest ? 0.65 : 1 }]}>
                  {submittingTest ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-done-outline" size={18} color="#fff" />}
                  <Text style={styles.saveText}>Завершить тест</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 128, gap: 14 },
  hero: { borderRadius: 32, padding: 18, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  heroBackBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  heroAddBtn: { minHeight: 42, borderRadius: 16, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.18)', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  heroAddText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  heroKicker: { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  heroTitle: { marginTop: 8, color: '#fff', fontSize: 31, fontWeight: '900', letterSpacing: -0.4 },
  heroSubtitle: { marginTop: 8, color: 'rgba(255,255,255,0.84)', fontSize: 14, fontWeight: '700', lineHeight: 20, maxWidth: 330 },
  heroStats: { marginTop: 20, minHeight: 76, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatValue: { color: '#fff', fontSize: 24, fontWeight: '900' },
  heroStatLabel: { marginTop: 3, color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '800' },
  heroLine: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.18)' },
  tabsCard: { borderWidth: 1, borderRadius: 24, padding: 6, flexDirection: 'row', gap: 6 },
  tabBtn: { flex: 1, minHeight: 46, borderRadius: 18, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 12, fontWeight: '900' },
  searchCard: { borderWidth: 1, borderRadius: 24, padding: 14, gap: 10 },
  searchBox: { borderWidth: 1, borderRadius: 18, minHeight: 50, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '700' },
  filterRow: { gap: 8, paddingVertical: 2 },
  filterPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', gap: 6, alignItems: 'center' },
  filterText: { fontSize: 12, fontWeight: '900' },
  breadcrumbRow: { gap: 8 },
  breadcrumbPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  breadcrumbText: { fontSize: 12, fontWeight: '900' },
  sectionInfoCard: { borderWidth: 1, borderRadius: 28, padding: 16, gap: 12, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.07, shadowRadius: 15, elevation: 2 },
  sectionCover: { width: '100%', height: 150, borderRadius: 22 },
  sectionInfoTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionInfoIcon: { width: 46, height: 46, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sectionInfoTitle: { fontSize: 19, fontWeight: '900' },
  sectionInfoSub: { marginTop: 3, fontSize: 12, fontWeight: '700' },
  responsibleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  responsibleText: { flex: 1, fontSize: 12, fontWeight: '700' },
  sectionLinkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  resourcePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', gap: 6, alignItems: 'center' },
  resourceText: { fontSize: 12, fontWeight: '900' },
  actionRow: { flexDirection: 'row', gap: 9 },
  actionBtn: { flex: 1, minHeight: 50, borderRadius: 18, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  bigTitle: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  sectionCard: { borderWidth: 1, borderRadius: 26, overflow: 'hidden', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.07, shadowRadius: 15, elevation: 2 },
  sectionCardImage: { width: '100%', height: 128 },
  sectionCardBody: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionIcon: { width: 46, height: 46, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  sectionDescription: { marginTop: 5, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  cardRightActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  smallIconBtn: { width: 34, height: 34, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarStack: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  avatarMini: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarMiniText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  avatarExtraText: { fontSize: 10, fontWeight: '900' },
  attachmentCard: { borderWidth: 1, borderRadius: 22, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  attachmentIcon: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  attachmentImage: { width: 48, height: 48, borderRadius: 15 },
  attachmentTitle: { fontSize: 14, fontWeight: '900' },
  attachmentNote: { marginTop: 3, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  emptyCard: { borderWidth: 1, borderRadius: 24, padding: 24, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  snippetCard: { borderWidth: 1, borderRadius: 26, padding: 15, gap: 10, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.07, shadowRadius: 15, elevation: 2 },
  snippetTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  snippetIcon: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  snippetTitle: { fontSize: 16, fontWeight: '900' },
  snippetMeta: { marginTop: 3, fontSize: 11.5, fontWeight: '700' },
  videoCard: { borderWidth: 1, borderRadius: 24, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  videoIcon: { width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  videoTitle: { fontSize: 16, fontWeight: '900' },
  videoDescription: { marginTop: 5, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  testCard: { borderWidth: 1, borderRadius: 24, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  testIcon: { width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  testTitle: { fontSize: 16, fontWeight: '900' },
  testDescription: { marginTop: 5, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  testMeta: { marginTop: 6, fontSize: 12, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '90%', borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, padding: 16 },
  modalHandle: { alignSelf: 'center', width: 48, height: 5, borderRadius: 999, backgroundColor: 'rgba(148,163,184,0.45)', marginBottom: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  modalTitle: { flex: 1, fontSize: 21, fontWeight: '900' },
  modalSub: { marginTop: 4, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  modalClose: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalScroll: { gap: 12, paddingBottom: 20 },
  inputWrap: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12 },
  inputLabel: { fontSize: 12, fontWeight: '900', marginBottom: 8 },
  input: { minHeight: 26, fontSize: 15, fontWeight: '700' },
  textarea: { minHeight: 108, lineHeight: 21 },
  textareaBig: { minHeight: 180, lineHeight: 21 },
  modalBlockTitle: { fontSize: 14, fontWeight: '900', marginTop: 2 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choicePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  choiceText: { fontSize: 12, fontWeight: '900' },
  modalActionBtn: { flex: 1, minHeight: 48, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  modalActionText: { fontSize: 12, fontWeight: '900' },
  selectedFileBox: { borderWidth: 1, borderRadius: 20, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' },
  selectedFileText: { flex: 1, fontSize: 13, fontWeight: '800' },
  saveBtn: { minHeight: 56, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  questionCard: { borderWidth: 1, borderRadius: 20, padding: 12, gap: 8 },
  questionText: { fontSize: 15, fontWeight: '900', lineHeight: 21 },
  answerBtn: { borderWidth: 1, borderRadius: 16, padding: 12 },
  answerText: { fontSize: 13, fontWeight: '800' },
  resultBox: { borderRadius: 18, padding: 16, alignItems: 'center' },
  resultText: { fontSize: 17, fontWeight: '900' },
});