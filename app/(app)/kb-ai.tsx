// app/(app)/kb-ai.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';

import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';

type Message = {
  id: string;
  role: 'user' | 'ai';
  text: string;
};

export default function KbAiScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);

  const askAi = async () => {
    const text = query.trim();
    if (!text || loading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setQuery('');
    setLoading(true);
    Keyboard.dismiss();

    // Прокрутка вниз к новому сообщению
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await apiClient.post('documents/snippets/ask_ai/', { query: text });
      
      const aiMessage: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'ai', 
        text: res.data.answer 
      };
      
      setMessages((prev) => [...prev, aiMessage]);
    } catch (e: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: '**Ошибка:** Не удалось получить ответ. Проверьте подключение к интернету или попробуйте позже.'
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // Стили Markdown подстроены под тему приложения (выглядят как в ChatGPT)
  const mdStyles = useMemo(
    () =>
      StyleSheet.create({
        body: { color: theme.text, fontSize: 16, lineHeight: 24 },
        heading1: { color: theme.text, fontSize: 20, fontWeight: '900', marginTop: 16, marginBottom: 8 },
        heading2: { color: theme.text, fontSize: 18, fontWeight: '800', marginTop: 14, marginBottom: 6 },
        heading3: { color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 4 },
        strong: { color: theme.text, fontWeight: '800' },
        em: { color: theme.text, fontStyle: 'italic' },
        blockquote: { backgroundColor: theme.backgroundSoft, borderLeftColor: theme.blue, borderLeftWidth: 4, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
        bullet_list: { marginTop: 4, marginBottom: 4 },
        ordered_list: { marginTop: 4, marginBottom: 4 },
        paragraph: { marginTop: 4, marginBottom: 4 },
        list_item: { marginTop: 2, marginBottom: 2 },
        code_inline: { backgroundColor: theme.backgroundSoft, color: theme.red, borderRadius: 4, paddingHorizontal: 6, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
        code_block: { backgroundColor: theme.backgroundSoft, color: theme.text, borderRadius: 8, padding: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 8, marginBottom: 8 },
      }),
    [theme]
  );

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView 
        style={{ flex: 1, backgroundColor: theme.background }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Шапка чата */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>AI Помощник</Text>
            <Text style={[styles.headerSub, { color: theme.textSecondary }]}>Знает всё о компании</Text>
          </View>
          <View style={styles.headerRight}>
            <Ionicons name="sparkles" size={20} color={theme.blue} />
          </View>
        </View>

        {/* История сообщений */}
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.blueSoft }]}>
                <Ionicons name="planet" size={48} color={theme.blue} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Чем могу помочь?</Text>
              <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
                Задайте вопрос о процессах, скриптах или документах. Я найду нужную информацию в базе знаний.
              </Text>
            </View>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <View 
                  key={msg.id} 
                  style={[
                    styles.messageRow, 
                    isUser ? styles.messageRowUser : styles.messageRowAi
                  ]}
                >
                  {!isUser && (
                    <View style={[styles.avatarAi, { backgroundColor: theme.blue }]}>
                      <Ionicons name="sparkles" size={14} color="#fff" />
                    </View>
                  )}
                  
                  <View 
                    style={[
                      styles.bubble, 
                      isUser 
                        ? [styles.bubbleUser, { backgroundColor: theme.blue }] 
                        : [styles.bubbleAi, { backgroundColor: theme.surface, borderColor: theme.border }]
                    ]}
                  >
                    {isUser ? (
                      <Text style={[styles.userText, { color: '#fff' }]}>{msg.text}</Text>
                    ) : (
                      <Markdown style={mdStyles}>{msg.text}</Markdown>
                    )}
                  </View>

                  {isUser && (
                    <View style={[styles.avatarUser, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
                      <Ionicons name="person" size={14} color={theme.textSecondary} />
                    </View>
                  )}
                </View>
              );
            })
          )}

          {loading && (
            <View style={[styles.messageRow, styles.messageRowAi]}>
              <View style={[styles.avatarAi, { backgroundColor: theme.blue }]}>
                <Ionicons name="sparkles" size={14} color="#fff" />
              </View>
              <View style={[styles.bubble, styles.bubbleAi, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.loadingDots}>
                  <ActivityIndicator size="small" color={theme.blue} />
                  <Text style={{ marginLeft: 8, color: theme.textSecondary, fontSize: 15, fontWeight: '600' }}>Анализирую базу...</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Поле ввода */}
        <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Спросите ИИ..."
              placeholderTextColor={theme.textMuted}
              value={query}
              onChangeText={setQuery}
              multiline
              maxLength={500}
            />
            <Pressable 
              onPress={askAi} 
              disabled={loading || !query.trim()}
              style={[
                styles.sendBtn, 
                { 
                  backgroundColor: query.trim() ? theme.blue : 'transparent',
                }
              ]}
            >
              <Ionicons 
                name={query.trim() ? "arrow-up" : "mic-outline"} 
                size={20} 
                color={query.trim() ? '#fff' : theme.textSecondary} 
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 8 },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  headerRight: { padding: 8, opacity: 0.8 },
  
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 24,
  },

  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAi: {
    justifyContent: 'flex-start',
  },
  
  avatarAi: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarUser: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleUser: {
    borderRadius: 20,
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  userText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },

  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 16,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    marginBottom: 0,
  },
});