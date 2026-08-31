import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { listClients } from '../../api/crm';
import { createClientExam, listClientExams } from '../../api/exams';
import { extractItems, toApiError } from '../../api/client';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { StatusPill } from '../../components/ui/StatusPill';
import { SERVICE_URLS } from '../../config/app';
import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { ApiListItem } from '../../types';
import { getEntityId, getEntityString } from '../../utils/entity';

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isoTime(value: Date) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function displayDate(value: Date) {
  return value.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

function displayTime(value: Date) {
  return value.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function ExamsScreen() {
  const appTheme = useAppTheme();
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<ApiListItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<ApiListItem | null>(null);
  const [exams, setExams] = useState<ApiListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingExams, setLoadingExams] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState('');
  const [university, setUniversity] = useState('');
  const [comment, setComment] = useState('');
  const [date, setDate] = useState(() => {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(10, 0, 0, 0);
    return next;
  });
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [repeat, setRepeat] = useState(true);

  const mobileUserId = useMemo(
    () => getEntityString(selectedClient || {}, ['mobile_app_user_id']),
    [selectedClient]
  );

  const runSearch = useCallback(async () => {
    const query = search.trim();
    if (query.length < 2) {
      Alert.alert('Поиск клиента', 'Введите хотя бы 2 символа имени, телефона или SL-ID.');
      return;
    }
    setSearching(true);
    setError('');
    try {
      const payload = await listClients({ search: query, limit: 20 });
      setClients(extractItems(payload));
    } catch (requestError) {
      setError(toApiError(requestError).message);
    } finally {
      setSearching(false);
    }
  }, [search]);

  const loadExams = useCallback(async (client: ApiListItem) => {
    const clientId = getEntityId(client);
    if (!clientId) return;
    setLoadingExams(true);
    setError('');
    try {
      const payload = await listClientExams(clientId);
      setExams(payload.exams || []);
    } catch (requestError) {
      setExams([]);
      setError(toApiError(requestError).message);
    } finally {
      setLoadingExams(false);
    }
  }, []);

  const selectClient = useCallback(
    (client: ApiListItem) => {
      setSelectedClient(client);
      setClients([]);
      void loadExams(client);
    },
    [loadExams]
  );

  const saveExam = useCallback(async () => {
    const clientId = getEntityId(selectedClient || {});
    if (!clientId) {
      Alert.alert('Выберите клиента', 'Сначала найдите и выберите клиента из базы ManagerSL.');
      return;
    }
    if (!mobileUserId) {
      Alert.alert('Нет мобильного аккаунта', 'У клиента ещё нет mobile user id. Сначала активируйте его клиентское приложение.');
      return;
    }
    if (!subject.trim() || !university.trim()) {
      Alert.alert('Заполните поля', 'Укажите вуз и название экзамена.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createClientExam(clientId, {
        subject: subject.trim(),
        university: university.trim(),
        exam_date: isoDate(date),
        exam_time: isoTime(date),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ashgabat',
        comment: comment.trim(),
        repeat_until_acknowledged: repeat,
      });
      setSubject('');
      setUniversity('');
      setComment('');
      await loadExams(selectedClient as ApiListItem);
      Alert.alert('Экзамен назначен', 'Клиент получил push-уведомление, запись появилась в его приложении.');
    } catch (requestError) {
      const message = toApiError(requestError).message;
      setError(message);
      Alert.alert('Не удалось назначить экзамен', message);
    } finally {
      setSaving(false);
    }
  }, [comment, date, loadExams, mobileUserId, repeat, selectedClient, subject, university]);

  const onDateChange = (_event: DateTimePickerEvent, value?: Date) => {
    setShowDate(Platform.OS === 'ios');
    if (!value) return;
    const next = new Date(date);
    next.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
    setDate(next);
  };

  const onTimeChange = (_event: DateTimePickerEvent, value?: Date) => {
    setShowTime(Platform.OS === 'ios');
    if (!value) return;
    const next = new Date(date);
    next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    setDate(next);
  };

  return (
    <ScreenContainer>
      <Header
        title="Экзамены"
        eyebrow="ExamSL"
        subtitle="Найдите клиента, назначьте экзамен и проверьте, увидел ли он уведомление."
        showBack
        parentFallback="/(app)/services-hub"
      />

      <Card glass style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: appTheme.colors.accentSoft }]}>
          <Ionicons name="school-outline" size={26} color={appTheme.colors.accent} />
        </View>
        <View style={styles.heroBody}>
          <Text style={[styles.heroTitle, { color: appTheme.colors.text }]}>Экзамен за несколько шагов</Text>
          <Text style={[styles.heroText, { color: appTheme.colors.textMuted }]}>1. Найдите клиента  2. Проверьте мобильный ID  3. Укажите вуз, дату и время.</Text>
        </View>
        <Pressable onPress={() => WebBrowser.openBrowserAsync(SERVICE_URLS.exams)} style={styles.webButton}>
          <Ionicons name="open-outline" size={17} color={appTheme.colors.accent} />
          <Text style={[styles.webButtonText, { color: appTheme.colors.accent }]}>Веб-версия</Text>
        </Pressable>
      </Card>

      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: appTheme.colors.text }]}>1. Клиент</Text>
        <Input
          label="Имя, телефон или SL-ID"
          placeholder="Например: SL-008 или Иванов"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={runSearch}
          returnKeyType="search"
          maxLength={255}
        />
        <Button title="Найти клиента" onPress={runSearch} loading={searching} fullWidth />
        {clients.map((client) => (
          <Pressable key={String(getEntityId(client))} onPress={() => selectClient(client)}>
            <View style={[styles.clientResult, { borderColor: appTheme.colors.border, backgroundColor: appTheme.colors.surfaceSoft }]}>
              <View style={[styles.clientAvatar, { backgroundColor: appTheme.colors.primarySoft }]}>
                <Ionicons name="person-outline" size={21} color={appTheme.colors.primary} />
              </View>
              <View style={styles.clientText}>
                <Text style={[styles.clientName, { color: appTheme.colors.text }]}>{getEntityString(client, ['full_name'], 'Клиент')}</Text>
                <Text style={[styles.clientMeta, { color: appTheme.colors.textMuted }]}>{[getEntityString(client, ['phone']), getEntityString(client, ['email'])].filter(Boolean).join(' · ')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={appTheme.colors.textMuted} />
            </View>
          </Pressable>
        ))}

        {selectedClient ? (
          <View style={[styles.selected, { borderColor: appTheme.colors.accent, backgroundColor: appTheme.colors.accentSoft }]}>
            <View style={styles.selectedTop}>
              <View style={styles.clientText}>
                <Text style={[styles.selectedLabel, { color: appTheme.colors.accent }]}>ВЫБРАН КЛИЕНТ</Text>
                <Text style={[styles.clientName, { color: appTheme.colors.text }]}>{getEntityString(selectedClient, ['full_name'], 'Клиент')}</Text>
              </View>
              <StatusPill label={mobileUserId ? `Mobile ID ${mobileUserId}` : 'Нет mobile ID'} tone={mobileUserId ? 'success' : 'warning'} />
            </View>
            <Button title="Выбрать другого" variant="ghost" onPress={() => { setSelectedClient(null); setExams([]); }} />
          </View>
        ) : null}
      </Card>

      {selectedClient ? (
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: appTheme.colors.text }]}>2. Данные экзамена</Text>
          <Input label="Вуз *" placeholder="Например: КФУ" value={university} onChangeText={setUniversity} maxLength={255} />
          <Input label="Экзамен *" placeholder="Например: Русский язык" value={subject} onChangeText={setSubject} maxLength={255} />

          <View style={styles.pickerRow}>
            <PickerButton label="Дата *" value={displayDate(date)} icon="calendar-outline" onPress={() => setShowDate(true)} />
            <PickerButton label="Время *" value={displayTime(date)} icon="time-outline" onPress={() => setShowTime(true)} />
          </View>
          {showDate ? <DateTimePicker value={date} mode="date" minimumDate={new Date()} onChange={onDateChange} /> : null}
          {showTime ? <DateTimePicker value={date} mode="time" is24Hour onChange={onTimeChange} /> : null}

          <Input label="Комментарий" placeholder="Что важно знать менеджеру" value={comment} onChangeText={setComment} multiline maxLength={1000} />
          <Text style={[styles.counter, { color: appTheme.colors.textMuted }]}>{comment.length}/1000</Text>

          <View style={[styles.switchRow, { borderColor: appTheme.colors.border, backgroundColor: appTheme.colors.surfaceSoft }]}>
            <View style={styles.switchText}>
              <Text style={[styles.switchTitle, { color: appTheme.colors.text }]}>Напоминать до подтверждения</Text>
              <Text style={[styles.switchSub, { color: appTheme.colors.textMuted }]}>Клиент должен открыть уведомление и подтвердить просмотр.</Text>
            </View>
            <Switch value={repeat} onValueChange={setRepeat} trackColor={{ true: appTheme.colors.accent }} />
          </View>
          <Button title="Назначить и отправить push" onPress={saveExam} loading={saving} disabled={!mobileUserId} fullWidth />
        </Card>
      ) : null}

      {error ? <ErrorState message={error} actionTitle={selectedClient ? 'Повторить' : undefined} onAction={selectedClient ? () => loadExams(selectedClient) : undefined} /> : null}

      {selectedClient ? (
        <View style={styles.examSection}>
          <Text style={[styles.sectionTitle, { color: appTheme.colors.screenText }]}>Экзамены клиента</Text>
          {loadingExams ? <ActivityIndicator color={appTheme.colors.accent} /> : null}
          {!loadingExams && !exams.length ? <EmptyState title="Экзаменов пока нет" message="Созданные экзамены появятся здесь." /> : null}
          {exams.map((exam) => <ExamCard key={String(getEntityId(exam))} exam={exam} />)}
        </View>
      ) : null}
    </ScreenContainer>
  );
}

function PickerButton({ label, value, icon, onPress }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  const appTheme = useAppTheme();
  return (
    <Pressable onPress={onPress} style={[styles.pickerButton, { borderColor: appTheme.colors.border, backgroundColor: appTheme.colors.surfaceStrong }]}>
      <Text style={[styles.pickerLabel, { color: appTheme.colors.textMuted }]}>{label}</Text>
      <View style={styles.pickerValueRow}>
        <Ionicons name={icon} size={18} color={appTheme.colors.accent} />
        <Text numberOfLines={1} style={[styles.pickerValue, { color: appTheme.colors.text }]}>{value}</Text>
      </View>
    </Pressable>
  );
}

function ExamCard({ exam }: { exam: ApiListItem }) {
  const appTheme = useAppTheme();
  const acknowledged = Boolean(exam.acknowledged_by_user);
  return (
    <Card style={styles.examCard}>
      <View style={styles.examTop}>
        <View style={[styles.examIcon, { backgroundColor: appTheme.colors.primarySoft }]}>
          <Ionicons name="school" size={20} color={appTheme.colors.primary} />
        </View>
        <View style={styles.clientText}>
          <Text style={[styles.clientName, { color: appTheme.colors.text }]}>{getEntityString(exam, ['university', 'subject'], 'Экзамен')}</Text>
          <Text style={[styles.clientMeta, { color: appTheme.colors.textMuted }]}>{[getEntityString(exam, ['subject']), getEntityString(exam, ['exam_date']), getEntityString(exam, ['exam_time'])].filter(Boolean).join(' · ')}</Text>
        </View>
      </View>
      <StatusPill label={acknowledged ? 'Клиент увидел' : 'Ожидает просмотра'} tone={acknowledged ? 'success' : 'warning'} />
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { gap: theme.spacing.md },
  heroIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heroBody: { gap: 5 },
  heroTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900' },
  heroText: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  webButton: { flexDirection: 'row', gap: 7, alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 4 },
  webButtonText: { fontSize: 13, fontWeight: '900' },
  section: { gap: theme.spacing.md },
  sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900' },
  clientResult: { minHeight: 68, borderWidth: 1, borderRadius: theme.radius.md, padding: 11, flexDirection: 'row', gap: 11, alignItems: 'center' },
  clientAvatar: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  clientText: { flex: 1, gap: 4 },
  clientName: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  clientMeta: { fontSize: 12.5, lineHeight: 18, fontWeight: '700' },
  selected: { borderWidth: 1, borderRadius: theme.radius.md, padding: 12, gap: 8 },
  selectedTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  selectedLabel: { fontSize: 10.5, letterSpacing: 0.8, fontWeight: '900' },
  pickerRow: { flexDirection: 'row', gap: theme.spacing.sm },
  pickerButton: { flex: 1, minWidth: 0, minHeight: 68, borderWidth: 1, borderRadius: theme.radius.md, padding: 11, gap: 8 },
  pickerLabel: { fontSize: 12, fontWeight: '800' },
  pickerValueRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pickerValue: { flex: 1, fontSize: 13, fontWeight: '900' },
  counter: { marginTop: -8, textAlign: 'right', fontSize: 11, fontWeight: '800' },
  switchRow: { borderWidth: 1, borderRadius: theme.radius.md, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' },
  switchText: { flex: 1, gap: 3 },
  switchTitle: { fontSize: 14, fontWeight: '900' },
  switchSub: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  examSection: { gap: theme.spacing.md },
  examCard: { gap: theme.spacing.md },
  examTop: { flexDirection: 'row', gap: 11, alignItems: 'center' },
  examIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
