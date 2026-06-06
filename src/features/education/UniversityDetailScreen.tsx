import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

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
import { getEntityMediaUrl } from '../../utils/media';

function getUniversityImageUrl(item: ApiListItem) {
  return getEntityMediaUrl(item, ['cover_image_url', 'cover_image', 'image_url', 'image', 'logo_url', 'logo']);
}

function getUniversityLogoUrl(item: ApiListItem) {
  return getEntityMediaUrl(item, ['logo_url', 'logo', 'image_url', 'image']);
}

function buildUniversityCopyText(item: ApiListItem, programs: ApiListItem[]) {
  const lines = [
    `ВУЗ: ${getEntityTitle(item, 'Университет')}`,
    `Страна: ${getEntityString(item, ['country_name'], 'не указана')}`,
    `Город: ${getEntityString(item, ['city_name'], 'не указан')}`,
    `Описание: ${stripHtml(getEntityString(item, ['description'])) || 'не заполнено'}`,
    `Сайт: ${getEntityString(item, ['website', 'site'], 'не указан')}`,
    `Условия поступления: ${stripHtml(getEntityString(item, ['admission_requirements', 'requirements'])) || 'не заполнено'}`,
    `Общежитие: ${stripHtml(getEntityString(item, ['dormitory', 'hostel'])) || 'не заполнено'}`,
    `Расходы: ${stripHtml(getEntityString(item, ['expenses', 'costs', 'living_costs'])) || 'не заполнено'}`,
  ];

  if (programs.length) {
    lines.push('Программы:');
    programs.forEach((program) => {
      lines.push(`- ${getEntityTitle(program, 'Программа')}`);
    });
  }

  return lines.join('\n');
}

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
  const imageUrl = getUniversityImageUrl(data);
  const logoUrl = getUniversityLogoUrl(data);

  const copyUniversityData = async () => {
    await Clipboard.setStringAsync(buildUniversityCopyText(data, programs));
    Alert.alert('Вуз', 'Данные ВУЗа скопированы.');
  };

  return (
    <ScreenContainer>
      <Header
        title="Вуз"
        subtitle={[getEntityString(data, ['city_name']), getEntityString(data, ['country_name'])].filter(Boolean).join(', ')}
        showBack
        parentFallback="/(app)/education"
      />

      <Card glass style={styles.hero}>
        <View style={styles.heroMedia}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.heroImage} contentFit="cover" />
          ) : (
            <LinearGradient colors={['#071A33', '#0B2545', '#7A1020']} style={styles.heroPlaceholder}>
              <Ionicons name="school-outline" size={42} color="#FFFFFF" />
            </LinearGradient>
          )}
          <LinearGradient colors={['rgba(7,26,51,0.02)', 'rgba(7,26,51,0.58)']} style={StyleSheet.absoluteFillObject} />
          <View style={styles.logoWrap}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logoImage} contentFit="cover" />
            ) : (
              <Ionicons name="school-outline" size={28} color={theme.colors.accent} />
            )}
          </View>
        </View>
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
        <Button title="Скопировать данные" variant="secondary" onPress={copyUniversityData} />
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
  heroMedia: {
    alignSelf: 'stretch',
    height: 178,
    marginHorizontal: -theme.spacing.lg,
    marginTop: -theme.spacing.lg,
    overflow: 'hidden',
  },
  heroImage: {
    height: '100%',
    width: '100%',
  },
  heroPlaceholder: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  logoWrap: {
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    bottom: theme.spacing.md,
    height: 58,
    justifyContent: 'center',
    left: theme.spacing.md,
    overflow: 'hidden',
    position: 'absolute',
    width: 58,
  },
  logoImage: {
    height: '100%',
    width: '100%',
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
