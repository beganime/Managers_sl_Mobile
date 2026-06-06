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
  getGeneratedDocumentApprovedDownloadUrl,
  getGeneratedDocumentDocxDownloadUrl,
  getGeneratedDocumentOriginalDownloadUrl,
  getGeneratedDocumentPdfDownloadUrl,
  getGeneratedDocumentPreviewUrl,
  getGeneratedDocumentStampPreviewUrl,
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
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { StatusPill } from '../../components/ui/StatusPill';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { useAuth } from '../../store/auth';
import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { ApiListItem } from '../../types';
import { resolveMediaUrl } from '../../utils/media';
import {
  formatEntityDate,
  getEntityArray,
  getEntityId,
  getEntityString,
  getEntityTitle,
  getEntityValue,
  stripHtml,
} from '../../utils/entity';
import { displayDocumentStatus, documentStatusTone } from './documentHelpers';

function sectionTitle(section: string) {
  if (section === 'templates') return 'Шаблон';
  if (section === 'approvals') return 'Согласование';
  return 'Документ';
}

const stampPositionOptions = [
  { label: 'Снизу слева', value: 'bottom_left' },
  { label: 'Снизу справа', value: 'bottom_right' },
  { label: 'Сверху слева', value: 'top_left' },
  { label: 'Сверху справа', value: 'top_right' },
  { label: 'Центр', value: 'center' },
  { label: 'Своя', value: 'custom' },
];

const stampUnitOptions = [
  { label: 'мм', value: 'mm' },
  { label: 'см', value: 'cm' },
];

function loadDocument(section: string, id: string) {
  if (section === 'templates') return getDocumentTemplate(id);
  if (section === 'approvals') return getDocumentApproval(id);
  return getGeneratedDocument(id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getNestedValue(entity: unknown, path: string) {
  if (!isRecord(entity)) return undefined;
  let current: unknown = entity;
  for (const part of path.split('.')) {
    if (!isRecord(current)) return undefined;
    current = current[part];
    if (current === null || current === undefined) return undefined;
  }
  return current;
}

function getNestedString(entity: unknown, paths: string[]) {
  for (const path of paths) {
    const value = path.includes('.') ? getNestedValue(entity, path) : getNestedValue(entity, path);
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return '';
}

function getDocumentUrl(item: ApiListItem, keys: string[]) {
  const nested = getNestedString(item, keys);
  const flat = getEntityString(item, keys);
  const value = nested || flat;
  return resolveMediaUrl(value) || '';
}

function firstAvailableUrl(...urls: (string | null | undefined)[]) {
  return urls.find((url) => typeof url === 'string' && url.trim()) || '';
}

function getEntityBoolean(item: ApiListItem, keys: string[], fallback = false) {
  const value = getEntityValue(item, keys);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function getPreviewText(item: ApiListItem) {
  return stripHtml(getEntityString(item, ['preview_text', 'text_preview', 'document_text', 'rendered_text', 'content', 'body']));
}

function toMillimeters(value: string, unit: string) {
  const normalized = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(normalized) || normalized <= 0) return undefined;
  return unit === 'cm' ? Math.round(normalized * 10 * 10) / 10 : normalized;
}

function getStampPreviewStyle(position: string) {
  const base = {
    bottom_left: { left: 22, bottom: 22 },
    bottom_right: { right: 22, bottom: 22 },
    top_left: { left: 22, top: 22 },
    top_right: { right: 22, top: 22 },
    center: { left: '50%' as const, top: '50%' as const, transform: [{ translateX: -34 }, { translateY: -22 }] },
  };

  return base[position as keyof typeof base] || { left: 28, bottom: 28 };
}

async function openExternalUrl(title: string, url: string) {
  if (!url) {
    Alert.alert(title, 'Ссылка пока недоступна.');
    return;
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert(title, 'Устройство не может открыть эту ссылку.');
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert(title, 'Не удалось открыть ссылку.');
  }
}

export function DocumentDetailScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ section: string; id: string }>();
  const section = params.section || 'generated';
  const id = params.id;
  const [saving, setSaving] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [stampPosition, setStampPosition] = useState('bottom_right');
  const [stampWidth, setStampWidth] = useState('38');
  const [stampHeight, setStampHeight] = useState('38');
  const [stampUnit, setStampUnit] = useState('mm');
  const [stampX, setStampX] = useState('');
  const [stampY, setStampY] = useState('');
  const [previewOpened, setPreviewOpened] = useState(false);
  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');

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
        if (!previewOpened) {
          Alert.alert('Предпросмотр', 'Сначала откройте предпросмотр документа и проверьте данные.');
          return;
        }

        const widthMm = toMillimeters(stampWidth, stampUnit);
        const heightMm = toMillimeters(stampHeight, stampUnit);
        const xMm = stampPosition === 'custom' ? toMillimeters(stampX, stampUnit) : undefined;
        const yMm = stampPosition === 'custom' ? toMillimeters(stampY, stampUnit) : undefined;

        const approvalPayload = {
          comment: comment.trim(),
          mode: 'approve_with_stamp',
          approval_type: 'with_stamp',
          with_stamp: true,
          stamp_mode: stampPosition === 'custom' ? 'manual' : 'position',
          stamp_position: stampPosition,
          position: stampPosition,
          stamp_width_mm: widthMm,
          stamp_height_mm: heightMm,
          width_mm: widthMm,
          height_mm: heightMm,
          stamp_x_mm: xMm,
          stamp_y_mm: yMm,
          x_mm: xMm,
          y_mm: yMm,
          unit: 'mm',
        };

        if (section === 'approvals') {
          await approveDocumentApproval(id, approvalPayload);
        } else {
          await approveGeneratedDocument(id, approvalPayload);
        }
      } else if (section === 'approvals') {
        await rejectDocumentApproval(id, reason.trim());
      } else {
        await rejectGeneratedDocument(id, reason.trim());
      }

      await reload();
      if (action === 'approve') {
        setPreviewOpened(false);
      }
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
  const documentId = getEntityId(item) || id;
  const status = getEntityString(item, ['status'], section === 'templates' ? 'active' : 'draft');
  const fields = getEntityArray<ApiListItem>(item, 'fields_config');
  const canDownloadOriginal = getEntityBoolean(item, ['can_download_original']);
  const canDownloadApproved = getEntityBoolean(item, ['can_download_approved']);
  const canDownloadDocx = getEntityBoolean(item, ['can_download_docx'], canDownloadOriginal);
  const canDownloadPdf = getEntityBoolean(item, ['can_download_pdf'], canDownloadApproved);
  const canApprove = getEntityBoolean(item, ['can_approve'], isAdmin);
  const canReject = getEntityBoolean(item, ['can_reject'], isAdmin);
  const hasStampPreview = getEntityBoolean(item, ['has_stamp_preview']);

  const generatedUrl = firstAvailableUrl(
    getDocumentUrl(item, [
      'download_docx_url',
      'links.api.download_docx',
      'original_docx_url',
      'generated_file_url',
      'links.files.generated_file',
      'links.api.download_original',
      'download_original_url',
      'links.portal.download_original',
      'portal_download_original_url',
      'docx_url',
      'download_docx_url',
      'original_file_url',
      'file_url',
      'download_url',
    ]),
    canDownloadDocx ? getGeneratedDocumentDocxDownloadUrl(documentId) : '',
    canDownloadOriginal ? getGeneratedDocumentOriginalDownloadUrl(documentId) : ''
  );

  const approvedUrl = firstAvailableUrl(
    getDocumentUrl(item, [
      'download_pdf_url',
      'approved_pdf_url',
      'approved_file_url',
      'links.files.approved_file',
      'links.api.download_approved',
      'download_approved_url',
      'links.portal.download_approved',
      'portal_download_approved_url',
      'sealed_pdf_url',
      'pdf_url',
      'stamped_pdf_url',
    ]),
    canDownloadPdf ? getGeneratedDocumentPdfDownloadUrl(documentId) : '',
    canDownloadApproved ? getGeneratedDocumentApprovedDownloadUrl(documentId) : ''
  );

  const stampPreviewUrl = firstAvailableUrl(
    getDocumentUrl(item, [
      'stamp_preview_file_url',
      'links.files.stamp_preview_file',
      'links.api.stamp_preview',
      'stamp_preview_url',
      'links.portal.stamp_preview',
      'portal_stamp_preview_url',
    ]),
    hasStampPreview ? getGeneratedDocumentStampPreviewUrl(documentId) : ''
  );

  const previewUrl = firstAvailableUrl(
    getDocumentUrl(item, [
      'preview_url',
      'links.api.preview',
      'links.portal.preview',
      'preview_approved_url',
      'links.api.preview_approved',
      'links.portal.preview_approved',
      'portal_preview_approved_url',
      'pdf_preview_url',
      'preview_file_url',
      'approved_file_url',
      'links.files.approved_file',
      'generated_file_url',
      'links.files.generated_file',
      'file_url',
    ]),
    getEntityBoolean(item, ['can_preview']) ? getGeneratedDocumentPreviewUrl(documentId) : '',
    stampPreviewUrl,
    approvedUrl,
    generatedUrl
  );

  const previewText = getPreviewText(item);
  const canPreview = getEntityBoolean(item, ['can_preview']) || Boolean(previewUrl || previewText);
  const stampPreviewStyle = getStampPreviewStyle(stampPosition);
  const displayTitle = section === 'approvals'
    ? getEntityString(item, ['document_title'], 'Согласование документа')
    : getEntityTitle(item, sectionTitle(section));
  const openPreview = async () => {
    if (!canPreview) {
      Alert.alert('Предпросмотр', 'Preview недоступен: нужен PDF/text preview или ссылка на DOCX/PDF.');
      return;
    }

    setPreviewOpened(true);

    if (!previewUrl) return;
    await openExternalUrl('Предпросмотр', previewUrl);
  };

  return (
    <ScreenContainer>
      <Header
        title={sectionTitle(section)}
        subtitle={formatEntityDate(item.created_at)}
        showBack
        parentFallback="/(app)/documents-v2"
      />

      <Card glass style={styles.hero}>
        <Text style={[styles.heroKicker, { color: appTheme.colors.accent }]}>ERP documents</Text>
        <Text style={[styles.heroTitle, { color: appTheme.colors.text }]}>{displayTitle}</Text>
        <Text style={[styles.heroText, { color: appTheme.colors.textMuted }]}> 
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
          {generatedUrl ? <StatusPill label="DOCX доступен" tone="success" /> : null}
          {approvedUrl ? <StatusPill label="PDF с печатью" tone="success" /> : null}
        </View>

        {section === 'templates' ? (
          <Button
            title="Создать документ"
            onPress={() => router.push(`/(app)/documents-v2/templates/${id}/generate` as any)}
          />
        ) : null}

        {isAdmin && section !== 'templates' ? (
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

      {previewOpened && previewText ? (
        <Card style={styles.previewCard}>
          <Text style={[styles.rowTitle, { color: appTheme.colors.text }]}>Текст документа</Text>
          <Text style={[styles.previewText, { color: appTheme.colors.textMuted }]}>{previewText}</Text>
        </Card>
      ) : null}

      {isAdmin && section !== 'templates' && !canPreview ? (
        <Card style={[styles.noteCard, { borderColor: appTheme.colors.warningSoft }]}> 
          <Text style={[styles.rowTitle, { color: appTheme.colors.warning }]}>Предпросмотр недоступен</Text>
          <Text style={[styles.rowSubtitle, { color: appTheme.colors.textMuted }]}> 
            Backend не вернул preview/text или ссылку на файл. После генерации DOCX появится кнопка скачивания.
          </Text>
        </Card>
      ) : null}

      {isAdmin && section !== 'templates' ? (
        <Card style={styles.block}>
          <Text style={[styles.rowTitle, { color: appTheme.colors.text }]}>Печать и согласование</Text>
          <Text style={[styles.rowSubtitle, { color: appTheme.colors.textMuted }]}> 
            Выберите место и размер печати перед одобрением документа.
          </Text>
          <SegmentedControl options={stampPositionOptions} value={stampPosition} onChange={setStampPosition} />
          <SegmentedControl options={stampUnitOptions} value={stampUnit} onChange={setStampUnit} />
          <View style={styles.actions}>
            <View style={styles.stampField}>
              <Input label={`Ширина, ${stampUnit}`} value={stampWidth} onChangeText={setStampWidth} keyboardType="decimal-pad" />
            </View>
            <View style={styles.stampField}>
              <Input label={`Высота, ${stampUnit}`} value={stampHeight} onChangeText={setStampHeight} keyboardType="decimal-pad" />
            </View>
          </View>
          {stampPosition === 'custom' ? (
            <View style={styles.actions}>
              <View style={styles.stampField}>
                <Input label={`X, ${stampUnit}`} value={stampX} onChangeText={setStampX} keyboardType="decimal-pad" />
              </View>
              <View style={styles.stampField}>
                <Input label={`Y, ${stampUnit}`} value={stampY} onChangeText={setStampY} keyboardType="decimal-pad" />
              </View>
            </View>
          ) : null}
          <View style={[styles.stampPreview, { borderColor: appTheme.colors.border, backgroundColor: appTheme.colors.surfaceSoft }]}> 
            <View style={[styles.documentMockLine, { backgroundColor: appTheme.colors.border }]} />
            <View style={[styles.documentMockLineShort, { backgroundColor: appTheme.colors.border }]} />
            <View
              style={[
                styles.stampMock,
                stampPreviewStyle,
                {
                  borderColor: appTheme.colors.accent,
                  backgroundColor: appTheme.colors.accentSoft,
                },
              ]}
            >
              <Text style={[styles.stampMockText, { color: appTheme.colors.accent }]}>Печать</Text>
            </View>
          </View>
          <Button
            title={previewOpened ? 'Предпросмотр открыт' : 'Открыть предпросмотр'}
            variant="secondary"
            disabled={!canPreview}
            onPress={openPreview}
          />
          {!previewOpened ? (
            <Text style={[styles.rowSubtitle, { color: appTheme.colors.warning }]}> 
              Сначала откройте предпросмотр документа. После проверки станет доступно одобрение с печатью.
            </Text>
          ) : null}
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
              title="Одобрить и поставить печать"
              loading={saving === 'approve'}
              disabled={!previewOpened || !canApprove}
              onPress={() => runAction('approve')}
            />
            <Button
              title="Отклонить"
              variant="danger"
              loading={saving === 'reject'}
              disabled={!canReject}
              onPress={() => runAction('reject')}
            />
          </View>
        </Card>
      ) : null}

      <SectionTitle title="Файлы и ссылки" />
      <View style={styles.stack}>
        {generatedUrl ? <FileAction title="Скачать DOCX без печати" subtitle="Оригинальный документ без штампа" url={generatedUrl} /> : null}
        {approvedUrl ? <FileAction title="Скачать PDF с печатью" subtitle="Доступно только после одобрения администратора" url={approvedUrl} /> : null}
        {stampPreviewUrl ? <FileAction title="Предпросмотр PDF со штампом" subtitle="Проверочный файл перед финальным одобрением" url={stampPreviewUrl} /> : null}
        {!generatedUrl && !approvedUrl && !stampPreviewUrl ? (
          <Card style={styles.block}>
            <Text style={[styles.rowTitle, { color: appTheme.colors.text }]}>Файлы пока недоступны</Text>
            <Text style={[styles.rowSubtitle, { color: appTheme.colors.textMuted }]}> 
              Документ ещё не сгенерирован или backend не вернул ссылки. После генерации здесь появится DOCX, а после одобрения — PDF с печатью.
            </Text>
          </Card>
        ) : null}
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
                <Text style={[styles.rowTitle, { color: appTheme.colors.text }]}>{getEntityString(field, ['label', 'key'], 'Поле')}</Text>
                <Text style={[styles.rowSubtitle, { color: appTheme.colors.textMuted }]}> 
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

function FileAction({ title, subtitle, url }: { title: string; subtitle?: string; url: string }) {
  const appTheme = useAppTheme();

  return (
    <Pressable
      disabled={!url}
      onPress={() => openExternalUrl(title, url)}
      style={({ pressed }) => [pressed && styles.pressed, !url && styles.disabled]}
    >
      <Card style={styles.file}>
        <View style={[styles.fileIcon, { backgroundColor: appTheme.colors.primarySoft }]}> 
          <Ionicons name="document-attach-outline" size={20} color={appTheme.colors.primary} />
        </View>
        <View style={styles.fileText}>
          <Text style={[styles.rowTitle, { color: appTheme.colors.text }]}>{title}</Text>
          <Text style={[styles.rowSubtitle, { color: appTheme.colors.textMuted }]}>{subtitle || 'Файл готов к открытию'}</Text>
        </View>
        {url ? <Ionicons name="open-outline" size={19} color={appTheme.colors.textMuted} /> : null}
      </Card>
    </Pressable>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  const appTheme = useAppTheme();

  return (
    <Card style={styles.meta}>
      <Text style={[styles.metaLabel, { color: appTheme.colors.textMuted }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: appTheme.colors.text }]}>{value}</Text>
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
  stampField: {
    flex: 1,
    minWidth: 130,
  },
  block: {
    gap: theme.spacing.md,
  },
  noteCard: {
    gap: theme.spacing.sm,
  },
  previewCard: {
    gap: theme.spacing.md,
  },
  previewText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  stack: {
    gap: theme.spacing.md,
  },
  stampPreview: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    height: 182,
    overflow: 'hidden',
    padding: theme.spacing.lg,
    position: 'relative',
  },
  documentMockLine: {
    borderRadius: theme.radius.pill,
    height: 8,
    opacity: 0.8,
    width: '72%',
  },
  documentMockLineShort: {
    borderRadius: theme.radius.pill,
    height: 8,
    marginTop: theme.spacing.sm,
    opacity: 0.58,
    width: '48%',
  },
  stampMock: {
    alignItems: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 2,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    width: 68,
  },
  stampMockText: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
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
