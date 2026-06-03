import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { getKnowledgeArticle, markKnowledgeArticleRead } from '../../api/knowledge';
import { toApiError } from '../../api/client';
import { Card } from '../../components/cards/Card';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { StatusPill } from '../../components/ui/StatusPill';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { theme } from '../../theme/theme';
import { ApiListItem } from '../../types';
import {
  formatEntityDate,
  getEntityArray,
  getEntityId,
  getEntityNumber,
  getEntityString,
  getEntityTitle,
  stripHtml,
} from '../../utils/entity';

export function KnowledgeArticleDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const [marking, setMarking] = useState(false);

  const loadArticle = useCallback(() => getKnowledgeArticle(id), [id]);
  const { data, loading, error, reload } = useAsyncResource(loadArticle);

  const markRead = async () => {
    setMarking(true);

    try {
      await markKnowledgeArticleRead(id);
      await reload();
    } catch (requestError) {
      Alert.alert('База знаний', toApiError(requestError).message);
    } finally {
      setMarking(false);
    }
  };

  if (loading && !data) {
    return (
      <ScreenContainer>
        <Header title="Статья" showBack />
        <LoadingState title="Открываем статью" />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer>
        <Header title="Статья" showBack />
        <ErrorState message={error} actionTitle="Повторить" onAction={reload} />
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <Header title="Статья" showBack />
        <EmptyState title="Статья не найдена" />
      </ScreenContainer>
    );
  }

  const attachments = getEntityArray<ApiListItem>(data, 'attachments');
  const tests = getEntityArray<ApiListItem>(data, 'tests');
  const content = stripHtml(getEntityString(data, ['content', 'summary']));

  return (
    <ScreenContainer>
      <Header
        title="Статья"
        subtitle={getEntityString(data, ['category_name'])}
        showBack
        parentFallback="/(app)/knowledge"
      />

      <Card glass style={styles.hero}>
        <Text style={styles.heroKicker}>{getEntityString(data, ['category_name'], 'Knowledge')}</Text>
        <Text style={styles.heroTitle}>{getEntityTitle(data, 'Статья')}</Text>
        <View style={styles.pills}>
          <StatusPill label={getEntityString(data, ['status_display', 'status'], 'Статус не указан')} tone="accent" />
          <StatusPill label={`${getEntityNumber(data, ['views_count'], 0)} просмотров`} tone="muted" />
          <StatusPill label={formatEntityDate(data.published_at) || 'Не опубликовано'} tone="primary" />
        </View>
        <Button title="Отметить прочитанной" loading={marking} onPress={markRead} />
      </Card>

      <SectionTitle title="Содержание" />
      <Card style={styles.contentCard}>
        <Text style={styles.contentText}>{content || 'Содержание статьи пока не заполнено.'}</Text>
      </Card>

      {attachments.length ? (
        <>
          <SectionTitle title="Вложения" />
          <View style={styles.stack}>
            {attachments.map((attachment) => (
              <Card key={String(getEntityId(attachment))} style={styles.block}>
                <Text style={styles.rowTitle}>{getEntityTitle(attachment, 'Вложение')}</Text>
                <Text style={styles.rowSubtitle}>
                  {getEntityString(attachment, ['note'], 'Материал готов к открытию')}
                </Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}

      {tests.length ? (
        <>
          <SectionTitle title="Тесты" />
          <View style={styles.stack}>
            {tests.map((test) => (
              <Card key={String(getEntityId(test))} style={styles.block}>
                <Text style={styles.rowTitle}>{getEntityTitle(test, 'Тест')}</Text>
                <Text style={styles.rowSubtitle}>
                  {getEntityString(test, ['description'], 'Тест доступен в базе знаний.')}
                </Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}
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
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  contentCard: {
    gap: theme.spacing.md,
  },
  contentText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 23,
  },
  stack: {
    gap: theme.spacing.md,
  },
  block: {
    gap: theme.spacing.sm,
  },
  rowTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  rowSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});
