import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { extractItems, toApiError } from '../../api/client';
import { createNotification } from '../../api/notifications';
import { listUsers } from '../../api/users';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/ErrorState';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useAuth } from '../../store/auth';
import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { ApiListItem } from '../../types';
import { getEntityId, getEntityString, getEntityTitle } from '../../utils/entity';

const targetOptions = [
  { label: 'Пользователь', value: 'user' },
  { label: 'Все', value: 'all' },
];

const typeOptions = [
  { label: 'Info', value: 'info' },
  { label: 'Success', value: 'success' },
  { label: 'Warning', value: 'warning' },
  { label: 'Error', value: 'error' },
];

function getUserSubtitle(item: ApiListItem) {
  return [
    getEntityString(item, ['email']),
    getEntityString(item, ['role_display', 'position', 'role']),
    getEntityString(item, ['office_name', 'office_city', 'office']),
  ]
    .filter(Boolean)
    .join(' · ');
}

export function NotificationCreateScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');
  const [target, setTarget] = useState('user');
  const [notificationType, setNotificationType] = useState('info');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<ApiListItem | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverNote, setServerNote] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const loadRecipients = useCallback(async () => {
    const payload = await listUsers({
      limit: 60,
      search: debouncedSearch || undefined,
    });

    return extractItems<ApiListItem>(payload);
  }, [debouncedSearch]);

  const { data: users = [], loading: usersLoading, error: usersError, reload } = useAsyncResource(loadRecipients);
  const recipientUsers = users || [];
  const canSubmit = Boolean(title.trim() && body.trim() && (target === 'all' || selectedUser));
  const selectedUserId = useMemo(() => (selectedUser ? getEntityId(selectedUser) : undefined), [selectedUser]);

  const submit = async () => {
    if (!canSubmit) {
      Alert.alert('Уведомление', 'Выберите получателя, заголовок и текст.');
      return;
    }

    setSubmitting(true);
    setServerNote('');

    try {
      await createNotification({
        target,
        recipient_id: target === 'user' ? selectedUserId : undefined,
        user_id: target === 'user' ? selectedUserId : undefined,
        send_to_all: target === 'all',
        title: title.trim(),
        body: body.trim(),
        message: body.trim(),
        notification_type: notificationType,
        type: notificationType,
      });
      Alert.alert('Уведомление', 'Уведомление отправлено.');
      router.back();
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.status === 404 || apiError.status === 405) {
        setServerNote('Нужно добавить endpoint POST /api/v1/notifications/ или /api/v1/notifications/create/ с поддержкой user_id и send_to_all.');
      }
      Alert.alert('Уведомление', apiError.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <ScreenContainer>
        <Header title="Создать уведомление" showBack parentFallback="/(app)/notifications" />
        <ErrorState title="Недоступно" message="Отправка уведомлений доступна только администратору." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Header
        title="Создать уведомление"
        eyebrow="Notifications"
        subtitle="Отправка сообщения одному сотруднику или всей команде."
        showBack
        parentFallback="/(app)/notifications"
      />

      <Card glass style={styles.hero}>
        <View style={[styles.icon, { backgroundColor: appTheme.colors.accentSoft }]}>
          <Ionicons name="notifications-outline" size={24} color={appTheme.colors.accent} />
        </View>
        <Text style={[styles.title, { color: appTheme.colors.text }]}>Новое уведомление</Text>
        <Text style={[styles.text, { color: appTheme.colors.textMuted }]}>
          Выберите сотрудника из списка или отправьте объявление всем. ID вручную больше вводить не нужно.
        </Text>
      </Card>

      {serverNote ? (
        <Card style={[styles.noteCard, { borderColor: appTheme.colors.warningSoft }]}>
          <Text style={[styles.noteText, { color: appTheme.colors.warning }]}>{serverNote}</Text>
        </Card>
      ) : null}

      <SegmentedControl options={targetOptions} value={target} onChange={setTarget} />

      {target === 'user' ? (
        <Card style={styles.recipients}>
          <Input label="Поиск сотрудника" placeholder="Имя, email, должность или офис" value={search} onChangeText={setSearch} />
          {usersError ? (
            <ErrorState
              title="Список сотрудников недоступен"
              message="Нужен endpoint GET /api/v1/users/ или GET /api/v1/employees/ для выбора получателя."
              actionTitle="Проверить снова"
              onAction={reload}
            />
          ) : null}
          {usersLoading ? <ActivityIndicator color={appTheme.colors.primary} /> : null}
          {recipientUsers.slice(0, 12).map((item) => {
            const id = getEntityId(item);
            const selected = selectedUserId !== undefined && String(selectedUserId) === String(id);

            return (
              <Pressable
                key={String(id || getEntityTitle(item))}
                onPress={() => setSelectedUser(item)}
                style={({ pressed }) => [
                  styles.userRow,
                  {
                    borderColor: selected ? appTheme.colors.accent : appTheme.colors.border,
                    backgroundColor: selected ? appTheme.colors.accentSoft : appTheme.colors.surfaceStrong,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.avatar, { backgroundColor: appTheme.colors.primarySoft }]}>
                  <Text style={[styles.avatarText, { color: appTheme.colors.primary }]}>
                    {getEntityTitle(item, 'U').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userText}>
                  <Text style={[styles.userName, { color: appTheme.colors.text }]} numberOfLines={1}>
                    {getEntityTitle(item, 'Сотрудник')}
                  </Text>
                  <Text style={[styles.userMeta, { color: appTheme.colors.textMuted }]} numberOfLines={2}>
                    {getUserSubtitle(item) || 'Данные профиля не указаны'}
                  </Text>
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={22} color={appTheme.colors.accent} /> : null}
              </Pressable>
            );
          })}
          {!usersLoading && !usersError && !recipientUsers.length ? (
            <Text style={[styles.emptyText, { color: appTheme.colors.textMuted }]}>Сотрудники не найдены.</Text>
          ) : null}
        </Card>
      ) : (
        <Card style={styles.noteCard}>
          <Text style={[styles.noteText, { color: appTheme.colors.text }]}>Получатель: все сотрудники</Text>
          <Text style={[styles.text, { color: appTheme.colors.textMuted }]}>
            Сервер получит send_to_all=true. Если backend ещё не поддерживает массовую отправку, приложение покажет мягкую ошибку.
          </Text>
        </Card>
      )}

      <SegmentedControl options={typeOptions} value={notificationType} onChange={setNotificationType} />

      <Input label="Заголовок" placeholder="Короткий заголовок" value={title} onChangeText={setTitle} />
      <Input
        label="Текст"
        placeholder="Напишите сообщение сотруднику"
        value={body}
        onChangeText={setBody}
        multiline
        numberOfLines={5}
      />

      <Button title="Отправить" loading={submitting} disabled={!canSubmit} onPress={submit} />
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
  recipients: {
    gap: theme.spacing.md,
  },
  userRow: {
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '900',
  },
  userText: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 14,
    fontWeight: '900',
  },
  userMeta: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
});
