import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { getUniversity } from '../../api/education';
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
  getEntityArray,
  getEntityId,
  getEntityNumber,
  getEntityString,
  getEntityTitle,
  stripHtml,
} from '../../utils/entity';

export function UniversityDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const loadUniversity = useCallback(() => getUniversity(id), [id]);
  const { data, loading, error, reload } = useAsyncResource(loadUniversity);

  if (loading && !data) {
    return (
      <ScreenContainer>
        <Header title="Вуз" showBack />
        <LoadingState title="Открываем вуз" />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer>
        <Header title="Вуз" showBack />
        <ErrorState message={error} actionTitle="Повторить" onAction={reload} />
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <Header title="Вуз" showBack />
        <EmptyState title="Вуз не найден" />
      </ScreenContainer>
    );
  }

  const programs = getEntityArray<ApiListItem>(data, 'programs');
  const contacts = getEntityArray<ApiListItem>(data, 'contacts');
  const docs = getEntityArray<ApiListItem>(data, 'required_documents');
  const website = getEntityString(data, ['website', 'site']);

  return (
    <ScreenContainer>
      <Header
        title="Вуз"
        subtitle={[getEntityString(data, ['city_name']), getEntityString(data, ['country_name'])].filter(Boolean).join(', ')}
        showBack
        parentFallback="/(app)/education"
      />

      <Card glass style={styles.hero}>
        <Text style={styles.heroKicker}>University</Text>
        <Text style={styles.heroTitle}>{getEntityTitle(data, 'Университет')}</Text>
        <Text style={styles.heroText}>
          {stripHtml(getEntityString(data, ['description'])) || 'Описание пока не заполнено.'}
        </Text>
        <View style={styles.pills}>
          <StatusPill label={`${getEntityNumber(data, ['programs_count'], programs.length)} программ`} tone="accent" />
          <StatusPill label={getEntityString(data, ['currency_code'], 'валюта не указана')} tone="primary" />
        </View>
        {website ? (
          <Button
            title="Открыть сайт"
            variant="secondary"
            onPress={() => Linking.openURL(website)}
          />
        ) : null}
      </Card>

      <SectionTitle title="Программы" />
      {programs.length ? (
        <View style={styles.stack}>
          {programs.map((program) => (
            <Pressable
              key={String(getEntityId(program))}
              onPress={() => router.push(`/(app)/education/programs/${getEntityId(program)}` as any)}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Card style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{getEntityTitle(program, 'Программа')}</Text>
                  <Text style={styles.rowSubtitle}>
                    {getEntityString(program, ['degree_display', 'degree'], 'Degree не указан')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </Card>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState title="Программы пока не добавлены" />
      )}

      {contacts.length ? (
        <>
          <SectionTitle title="Контакты" />
          <View style={styles.stack}>
            {contacts.map((contact) => (
              <Card key={String(getEntityId(contact))} style={styles.block}>
                <Text style={styles.rowTitle}>{getEntityTitle(contact, 'Контакт')}</Text>
                <Text style={styles.rowSubtitle}>
                  {[getEntityString(contact, ['position']), getEntityString(contact, ['phone']), getEntityString(contact, ['email'])]
                    .filter(Boolean)
                    .join(' - ')}
                </Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}

      {docs.length ? (
        <>
          <SectionTitle title="Документы" />
          <View style={styles.stack}>
            {docs.map((doc) => (
              <Card key={String(getEntityId(doc))} style={styles.block}>
                <Text style={styles.rowTitle}>{getEntityTitle(doc, 'Документ')}</Text>
                <Text style={styles.rowSubtitle}>{stripHtml(getEntityString(doc, ['description']))}</Text>
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
  heroText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  stack: {
    gap: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 5,
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
  block: {
    gap: theme.spacing.sm,
  },
  pressed: {
    opacity: 0.72,
  },
});
