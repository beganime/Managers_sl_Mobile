import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import { generateDocumentFromTemplate, getDocumentTemplate } from '../../api/documents';
import { toApiError } from '../../api/client';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { theme } from '../../theme/theme';
import { getEntityId, getEntityString, getEntityTitle } from '../../utils/entity';

export function DocumentGenerateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [contextJson, setContextJson] = useState('{}');
  const [saving, setSaving] = useState(false);

  const loader = useCallback(() => getDocumentTemplate(id), [id]);
  const { data, loading, error, reload } = useAsyncResource(loader);

  const submit = async () => {
    let contextData: Record<string, unknown> = {};

    try {
      contextData = contextJson.trim() ? JSON.parse(contextJson) : {};
    } catch {
      Alert.alert('Создание документа', 'context_data должен быть корректным JSON объектом.');
      return;
    }

    if (contextData === null || Array.isArray(contextData) || typeof contextData !== 'object') {
      Alert.alert('Создание документа', 'context_data должен быть JSON объектом.');
      return;
    }

    setSaving(true);

    try {
      const saved = await generateDocumentFromTemplate(id, {
        title: title.trim() || getEntityTitle(data, 'Документ'),
        comment: comment.trim(),
        context_data: contextData,
      });

      router.replace(`/(app)/documents-v2/generated/${getEntityId(saved)}` as any);
    } catch (requestError) {
      Alert.alert('Создание документа', toApiError(requestError).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <ScreenContainer>
        <Header title="Создать документ" showBack />
        <LoadingState title="Открываем шаблон" />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer>
        <Header title="Создать документ" showBack />
        <ErrorState message={error} actionTitle="Повторить" onAction={reload} />
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <Header title="Создать документ" showBack />
        <EmptyState title="Шаблон не найден" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Header
        title="Создать документ"
        subtitle={getEntityTitle(data, 'Шаблон')}
        showBack
        parentFallback="/(app)/documents-v2"
      />

      <Card glass style={styles.hero}>
        <Text style={styles.heroKicker}>Document generator</Text>
        <Text style={styles.heroTitle}>{getEntityTitle(data, 'Шаблон')}</Text>
        <Text style={styles.heroText}>
          Если шаблон требует client/application/deal, backend вернёт понятную ошибку. Мобильное приложение не выдумывает эти связи.
        </Text>
      </Card>

      <Card style={styles.form}>
        <Input
          label="Название документа"
          placeholder={getEntityTitle(data, 'Документ')}
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label="Комментарий"
          placeholder="Комментарий для согласования"
          value={comment}
          onChangeText={setComment}
        />

        <SectionTitle
          title="context_data JSON"
          subtitle={`Код шаблона: ${getEntityString(data, ['code'], 'не указан')}`}
        />
        <Input
          label="Данные"
          value={contextJson}
          onChangeText={setContextJson}
          multiline
          style={styles.textarea}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Button title="Сгенерировать документ" loading={saving} onPress={submit} />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: theme.spacing.md,
  },
  heroKicker: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  heroText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  form: {
    gap: theme.spacing.lg,
  },
  textarea: {
    minHeight: 150,
    paddingTop: theme.spacing.md,
    textAlignVertical: 'top',
  },
});
