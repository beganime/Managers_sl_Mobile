import { Ionicons } from '@expo/vector-icons';
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
import { useTheme } from '../../src/context/themeContext';
import { safeGoBack } from '../../src/navigation/safeGoBack';

type CategoryValue = 'support' | 'admin' | 'bug' | 'idea' | 'feedback';

type SupportMessage = {
  id: number;
  category: CategoryValue;
  subject: string;
  message: string;
  status: 'new' | 'in_progress' | 'closed';
  admin_note?: string;
  photo_url?: string | null;
  file_url?: string | null;
  created_at?: string;
};

type UploadFile = { uri: string; name: string; type: string };

const CATEGORIES: Array<{ value: CategoryValue; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'support', label: 'Поддержка', icon: 'help-buoy-outline' },
  { value: 'admin', label: 'Админу', icon: 'shield-checkmark-outline' },
  { value: 'bug', label: 'Ошибка', icon: 'bug-outline' },
  { value: 'idea', label: 'Идея', icon: 'bulb-outline' },
  { value: 'feedback', label: 'Отзыв', icon: 'chatbubble-ellipses-outline' },
];

function statusLabel(status: string) {
  if (status === 'new') return 'Новое';
  if (status === 'in_progress') return 'В работе';
  if (status === 'closed') return 'Закрыто';
  return status || '—';
}

function statusColor(status: string, theme: any) {
  if (status === 'closed') return theme.success;
  if (status === 'in_progress') return theme.warning;
  return theme.blue;
}

function categoryLabel(category: string) {
  return CATEGORIES.find((x) => x.value === category)?.label || category || 'Поддержка';
}

function formatDate(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return value;
  }
}

function flattenError(error: any) {
  const data = error?.response?.data;
  return data?.detail || data?.subject?.[0] || data?.message?.[0] || data?.photo?.[0] || data?.file?.[0] || 'Не удалось выполнить действие.';
}

function imageAssetToFile(asset: ImagePicker.ImagePickerAsset): UploadFile {
  return {
    uri: asset.uri,
    name: asset.fileName || asset.uri.split('/').pop() || 'photo.jpg',
    type: asset.mimeType || 'image/jpeg',
  };
}

function docAssetToFile(asset: DocumentPicker.DocumentPickerAsset): UploadFile {
  return {
    uri: asset.uri,
    name: asset.name || 'file',
    type: asset.mimeType || 'application/octet-stream',
  };
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
  const [photo, setPhoto] = useState<UploadFile | null>(null);
  const [file, setFile] = useState<UploadFile | null>(null);

  const canSubmit = useMemo(() => subject.trim().length >= 3 && message.trim().length >= 5 && !saving, [message, saving, subject]);
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

  useEffect(() => { void loadMessages(); }, []);

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Нет доступа', 'Разреши доступ к галерее.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, selectionLimit: 1 });
    if (!result.canceled && result.assets?.[0]) setPhoto(imageAssetToFile(result.assets[0]));
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (!result.canceled && result.assets?.[0]) setFile(docAssetToFile(result.assets[0]));
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);

    try {
      if (photo || file) {
        const fd = new FormData();
        fd.append('category', category);
        fd.append('subject', subject.trim());
        fd.append('message', message.trim());
        if (photo) fd.append('photo', photo as any);
        if (file) fd.append('file', file as any);
        await apiClient.post('support/messages/', fd, { headers: { Accept: 'application/json' }, transformRequest: (data) => data });
      } else {
        await apiClient.post('support/messages/', { category, subject: subject.trim(), message: message.trim() });
      }

      setSubject('');
      setMessage('');
      setCategory('support');
      setPhoto(null);
      setFile(null);
      await loadMessages();
      Alert.alert('Готово', 'Обращение отправлено администратору.');
    } catch (error: any) {
      Alert.alert('Ошибка', String(flattenError(error)));
    } finally {
      setSaving(false);
    }
  };

  const openUrl = async (url?: string | null) => {
    if (!url) return;
    await WebBrowser.openBrowserAsync(url);
  };

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMessages(); }} tintColor={theme.blue} />}
        >
          <LinearGradient colors={dark ? ['#111827', '#1E3A8A'] : ['#2563EB', '#60A5FA']} style={styles.hero}> 
            <View style={styles.heroTop}> 
              <Pressable onPress={() => safeGoBack(router)} style={styles.heroBackBtn}> 
                <Ionicons name="arrow-back" size={21} color="#fff" />
              </Pressable>
              <View style={styles.heroBadge}> 
                <Ionicons name="chatbox-ellipses-outline" size={15} color="#fff" />
                <Text style={styles.heroBadgeText}>{openCount} открыто</Text>
              </View>
            </View>
            <Text style={styles.heroKicker}>ManagerSL Support</Text>
            <Text style={styles.heroTitle}>Поддержка</Text>
            <Text style={styles.heroSubtitle}>Сообщение, фото и файл попадут администратору в админку сайта.</Text>
          </LinearGradient>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}> 
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Новое обращение</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}> 
              {CATEGORIES.map((item) => {
                const active = category === item.value;
                return (
                  <Pressable key={item.value} onPress={() => setCategory(item.value)} style={[styles.categoryPill, { backgroundColor: active ? theme.blue : theme.backgroundSoft, borderColor: active ? theme.blue : theme.border }]}> 
                    <Ionicons name={item.icon} size={17} color={active ? '#fff' : theme.blue} />
                    <Text style={[styles.categoryText, { color: active ? '#fff' : theme.text }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}> 
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Тема</Text>
              <TextInput value={subject} onChangeText={setSubject} placeholder="Например: Не открывается проект" placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} />
            </View>

            <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}> 
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Сообщение</Text>
              <TextInput value={message} onChangeText={setMessage} placeholder="Опиши проблему подробно..." placeholderTextColor={theme.textMuted} style={[styles.input, styles.textarea, { color: theme.text }]} multiline textAlignVertical="top" />
            </View>

            <View style={styles.attachRow}> 
              <Pressable onPress={pickPhoto} style={[styles.attachBtn, { backgroundColor: theme.blueSoft }]}> 
                <Ionicons name="image-outline" size={18} color={theme.blue} />
                <Text style={[styles.attachText, { color: theme.blue }]}>{photo ? 'Фото выбрано' : 'Фото'}</Text>
              </Pressable>
              <Pressable onPress={pickFile} style={[styles.attachBtn, { backgroundColor: theme.blueSoft }]}> 
                <Ionicons name="document-outline" size={18} color={theme.blue} />
                <Text style={[styles.attachText, { color: theme.blue }]}>{file ? 'Файл выбран' : 'Файл'}</Text>
              </Pressable>
            </View>

            {photo && <Image source={{ uri: photo.uri }} style={styles.previewImage} contentFit="cover" />}
            {file && <Text style={[styles.fileName, { color: theme.textSecondary }]}>📎 {file.name}</Text>}

            <Pressable onPress={submit} disabled={!canSubmit} style={[styles.submitBtn, { backgroundColor: theme.blue, opacity: canSubmit ? 1 : 0.55 }]}> 
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

          {loading ? <ActivityIndicator color={theme.blue} /> : messages.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
              <Ionicons name="chatbubbles-outline" size={38} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Пока обращений нет.</Text>
            </View>
          ) : messages.map((item) => {
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
                {item.photo_url ? <Pressable onPress={() => openUrl(item.photo_url)}><Image source={{ uri: item.photo_url }} style={styles.serverPhoto} contentFit="cover" /></Pressable> : null}
                {item.file_url ? <Pressable onPress={() => openUrl(item.file_url)} style={[styles.filePill, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}><Ionicons name="attach-outline" size={16} color={theme.blue} /><Text style={[styles.filePillText, { color: theme.text }]}>Открыть файл</Text></Pressable> : null}
                {!!item.admin_note && <View style={[styles.adminNote, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}><Text style={[styles.adminNoteTitle, { color: theme.text }]}>Ответ администратора</Text><Text style={[styles.adminNoteText, { color: theme.textSecondary }]}>{item.admin_note}</Text></View>}
              </View>
            );
          })}
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
  heroTitle: { marginTop: 8, color: '#fff', fontSize: 31, fontWeight: '900' },
  heroSubtitle: { marginTop: 8, color: 'rgba(255,255,255,0.84)', fontSize: 14, fontWeight: '700', lineHeight: 20, maxWidth: 330 },
  card: { borderWidth: 1, borderRadius: 28, padding: 16, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  categoryRow: { gap: 8, paddingVertical: 14 },
  categoryPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 7, alignItems: 'center' },
  categoryText: { fontSize: 12.5, fontWeight: '900' },
  inputWrap: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, marginTop: 10 },
  inputLabel: { fontSize: 12, fontWeight: '900', marginBottom: 8 },
  input: { minHeight: 26, fontSize: 15, fontWeight: '700' },
  textarea: { minHeight: 130, lineHeight: 21 },
  attachRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  attachBtn: { flex: 1, minHeight: 48, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  attachText: { fontSize: 13, fontWeight: '900' },
  previewImage: { marginTop: 12, width: '100%', height: 170, borderRadius: 20 },
  fileName: { marginTop: 10, fontSize: 13, fontWeight: '800' },
  submitBtn: { marginTop: 14, borderRadius: 20, minHeight: 56, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyTitle: { fontSize: 19, fontWeight: '900' },
  refreshBtn: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
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
  serverPhoto: { width: '100%', height: 170, borderRadius: 18 },
  filePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  filePillText: { fontSize: 12, fontWeight: '900' },
  adminNote: { borderWidth: 1, borderRadius: 18, padding: 12 },
  adminNoteTitle: { fontSize: 13, fontWeight: '900' },
  adminNoteText: { marginTop: 6, fontSize: 13, fontWeight: '600', lineHeight: 19 },
});