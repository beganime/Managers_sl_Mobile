import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  approveDocumentApproval,
  approveGeneratedDocument,
  getDocumentApproval,
  getDocumentTemplate,
  getGeneratedDocument,
  regenerateDocument,
  rejectDocumentApproval,
  rejectGeneratedDocument,
  submitDocumentForApproval,
} from '../../api/documents';
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
import { StatusPill } from '../../components/ui/StatusPill';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { theme } from '../../theme/theme';
import { ApiListItem } from '../../types';
import {
  formatEntityDate,
  getEntityArray,
  getEntityId,
  getEntityString,
  getEntityTitle,
  stripHtml,
} from '../../utils/entity';
import { displayDocumentStatus, documentStatusTone } from './documentHelpers';

function sectionTitle(section: string) {
  if (section === 'templates') return 'Шаблон';
  if (section === 'approvals') return 'Согласование';
  return 'Документ';
}

function loadDocument(section: string, id: string) {
  if (section === 'templates') return getDocumentTemplate(id);
  if (section === 'approvals') return getDocumentApproval(id);
  return getGeneratedDocument(id);
}

export function DocumentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section: string; id: string }>();
  const section = params.section || 'generated';
  const id = params.id;
  const [saving, setSaving] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');

  const loader = useCallback(() => loadDocument(section, id), [id, section]);
  const { data, loading, error, reload } = useAsyncResource(loader);

  const runAction = async (action: 'regenerate' | 'submit' | 'approve' | 'reject') => {
    setSaving(action);

    try {
      if (action === 'regenerate') {
        await regenerateDocument(id);
      } else if (action === 'submit') {
        await submitDocumentForApproval(id, comment.trim());
      } else if (action === 'approve') {
        if (section === 'approvals') {
          await approveDocumentApproval(id, { comment: comment.trim() });
        } else {
          await approveGeneratedDocument(id, { comment: comment.trim() });
        }
      } else if (section === 'approvals') {
        await rejectDocumentApproval(id, reason.trim());
      } else {
        await rejectGeneratedDocument(id, reason.trim());
      }

      await reload();
    } catch (requestError) {
      Alert.alert(sectionTitle(section), toApiError(requestError).message);
    } finally {
      setSaving(null);
    }
  };

  if (loading && !data) {
    return (
      <ScreenContainer>
        <Header title={sectionTitle(section)} showBack />
        <LoadingState title="Открываем документ" />
      </ScreenContainer>
    );
  }

  if (error && !data) {
    return (
      <ScreenContainer>
        <Header title={sectionTitle(section)} showBack />
        <ErrorState message={error} actionTitle="Повторить" onAction={reload} />
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <Header title={sectionTitle(section)} showBack />
        <EmptyState title="Документ не найден" />
      </ScreenContainer>
    );
  }

  const item = data as ApiListItem;
  const status = getEntityString(item, ['status'], section === 'templates' ? 'active' : 'draft');
  const fields = getEntityArray<ApiListItem>(item, 'fields_config');
  const generatedUrl = getEntityString(item, ['generated_file_url', 'file_url']);
  const approvedUrl = getEntityString(item, ['approved_file_url']);
  const displayTitle = section === 'approvals'
    ? getEntityString(item, ['document_title'], 'Согласование документа')
    : getEntityTitle(item, sectionTitle(section));

  return (
    <ScreenContainer>
      <Header
        title={sectionTitle(section)}
        subtitle={formatEntityDate(item.created_at)}
        showBack
        parentFallback="/(app)/documents-v2"
      />

      <Card glass style={styles.hero}>
        <Text style={styles.heroKicker}>ERP documents</Text>
        <Text style={styles.heroTitle}>{displayTitle}</Text>
        <Text style={styles.heroText}>
          {stripHtml(getEntityString(item, ['description', 'generation_error'])) || 'Данные документа загружены из backend.'}
        </Text>
        <View style={styles.pills}>
          <StatusPill
            label={displayDocumentStatus(status, getEntityString(item, ['status_display']))}
            tone={documentStatusTone(status)}
          />
          {getEntityString(item, ['requires_approval']) === 'true' ? (
            <StatusPill label="Нужно согласование" tone="warning" />
          ) : null}
        </View>

        {section === 'templates' ? (
          <Button
            title="Создать документ"
            onPress={() => router.push(`/(app)/documents-v2/templates/${id}/generate` as any)}
          />
        ) : null}

        {section !== 'templates' ? (
          <View style={styles.actions}>
            <Button
              title="Перегенерировать"
              variant="secondary"
              loading={saving === 'regenerate'}
              onPress={() => runAction('regenerate')}
            />
            <Button
              title="На согласование"
              variant="secondary"
              loading={saving === 'submit'}
              onPress={() => runAction('submit')}
            />
          </View>
        ) : null}
      </Card>

      {section !== 'templates' ? (
        <Card style={styles.block}>
          <Input
            label="Комментарий к действию"
            placeholder="Комментарий для согласования"
            value={comment}
            onChangeText={setComment}
          />
          <Input
            label="Причина отказа"
            placeholder="Заполните перед отказом"
            value={reason}
            onChangeText={setReason}
          />
          <View style={styles.actions}>
            <Button
              title="Одобрить"
              loading={saving === 'approve'}
              onPress={() => runAction('approve')}
            />
            <Button
              title="Отклонить"
              variant="danger"
              loading={saving === 'reject'}
              onPress={() => runAction('reject')}
            />
          </View>
        </Card>
      ) : null}

      <SectionTitle title="Файлы" />
      <View style={styles.stack}>
        <FileAction title="Исходный файл" url={generatedUrl} />
        <FileAction title="Одобренный файл" url={approvedUrl} />
      </View>

      <SectionTitle title="Детали" />
      <View style={styles.metaGrid}>
        <Meta label="Шаблон" value={getEntityString(item, ['template_name'], 'Не указан')} />
        <Meta label="Клиент" value={getEntityString(item, ['client_name'], 'Не указан')} />
        <Meta label="Сделка" value={getEntityString(item, ['deal_title'], 'Не указана')} />
        <Meta label="Менеджер" value={getEntityString(item, ['manager_name'], 'Не указан')} />
        <Meta label="Компания" value={getEntityString(item, ['company_name'], 'Не указана')} />
        <Meta label="Офис" value={getEntityString(item, ['office_name'], 'Не указан')} />
      </View>

      {fields.length ? (
        <>
          <SectionTitle title="Поля шаблона" />
          <View style={styles.stack}>
            {fields.map((field) => (
              <Card key={String(getEntityId(field))} style={styles.block}>
                <Text style={styles.rowTitle}>{getEntityString(field, ['label', 'key'], 'Поле')}</Text>
                <Text style={styles.rowSubtitle}>
                  {[getEntityString(field, ['key']), getEntityString(field, ['field_type', 'type'])]
                    .filter(Boolean)
                    .join(' - ')}
                </Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}
    </ScreenContainer>
  );
}

function FileAction({ title, url }: { title: string; url: string }) {
  return (
    <Pressable
      disabled={!url}
      onPress={() => Linking.openURL(url)}
      style={({ pressed }) => [pressed && styles.pressed, !url && styles.disabled]}
    >
      <Card style={styles.file}>
        <View style={styles.fileIcon}>
          <Ionicons name="document-attach-outline" size={20} color={theme.colors.primary} />
        </View>
        <View style={styles.fileText}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSubtitle}>{url ? 'Файл готов к открытию' : 'Файл пока недоступен'}</Text>
        </View>
        {url ? <Ionicons name="open-outline" size={19} color={theme.colors.textMuted} /> : null}
      </Card>
    </Pressable>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </Card>
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  block: {
    gap: theme.spacing.md,
  },
  stack: {
    gap: theme.spacing.md,
  },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  fileIcon: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  fileText: {
    flex: 1,
    gap: 4,
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
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  meta: {
    flex: 1,
    minWidth: 145,
    gap: 5,
    paddingVertical: theme.spacing.md,
  },
  metaLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metaValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 19,
  },
  disabled: {
    opacity: 0.56,
  },
  pressed: {
    opacity: 0.72,
  },
});
