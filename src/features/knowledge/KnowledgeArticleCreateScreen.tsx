import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { toApiError } from '../../api/client';
import { createKnowledgeArticle } from '../../api/knowledge';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { Button } from '../../components/ui/Button';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';

const visibilityOptions = [
  { label: 'Все', value: 'all' },
  { label: 'Офис', value: 'office' },
  { label: 'Выбранные', value: 'selected' },
];

export function KnowledgeArticleCreateScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [visibility, setVisibility] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [serverNote, setServerNote] = useState('');

  const canSubmit = Boolean(title.trim() && content.trim());

  const submit = async () => {
    if (!canSubmit) {
      Alert.alert('База знаний', 'Заполните заголовок и текст статьи.');
      return;
    }

    setSaving(true);
    setServerNote('');

    try {
      await createKnowledgeArticle({
        title: title.trim(),
        content: content.trim(),
        body: content.trim(),
        category: category.trim() || undefined,
        category_id: category.trim() || undefined,
        visibility,
        selected_users: selectedUsers
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      });
      Alert.alert('База знаний', 'Статья создана.');
      router.back();
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.status === 404 || apiError.status === 405) {
        setServerNote('Нужно добавить endpoint POST /api/v1/knowledge/articles/ на сервере.');
      }
      Alert.alert('База знаний', apiError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <Header
        title="Новая статья"
        eyebrow="Knowledge"
        subtitle="Материал для сотрудников и офисов."
        showBack
        parentFallback="/(app)/knowledge"
      />

      <Card glass style={styles.hero}>
        <View style={[styles.icon, { backgroundColor: appTheme.colors.primarySoft }]}>
          <Ionicons name="library-outline" size={24} color={appTheme.colors.primary} />
        </View>
        <Text style={[styles.title, { color: appTheme.colors.text }]}>Добавить статью</Text>
        <Text style={[styles.text, { color: appTheme.colors.textMuted }]}>
          Контакты офисов, визовые инструкции, скрипты продаж и FAQ можно хранить прямо в базе знаний.
        </Text>
      </Card>

      {serverNote ? (
        <Card style={[styles.noteCard, { borderColor: appTheme.colors.warningSoft }]}>
          <Text style={[styles.noteText, { color: appTheme.colors.warning }]}>{serverNote}</Text>
        </Card>
      ) : null}

      <Input label="Заголовок" placeholder="Например: Скрипт первого звонка" value={title} onChangeText={setTitle} />
      <Input label="ID категории" placeholder="Если категория уже создана" value={category} onChangeText={setCategory} />
      <SegmentedControl options={visibilityOptions} value={visibility} onChange={setVisibility} />
      {visibility === 'selected' ? (
        <Input
          label="ID сотрудников"
          placeholder="Через запятую: 4, 8, 15"
          value={selectedUsers}
          onChangeText={setSelectedUsers}
        />
      ) : null}
      <Input
        label="Содержание"
        placeholder="Напишите текст статьи"
        value={content}
        onChangeText={setContent}
        multiline
        numberOfLines={8}
      />
      <Button title="Создать статью" loading={saving} disabled={!canSubmit} onPress={submit} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: theme.spacing.md,
  },
  icon: {
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  noteCard: {
    gap: theme.spacing.sm,
  },
  noteText: {
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 19,
  },
});
