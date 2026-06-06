import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { toApiError } from '../../api/client';
import { createNotification } from '../../api/notifications';
import { Card } from '../../components/cards/Card';
import { Input } from '../../components/forms/Input';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/ErrorState';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { useAuth } from '../../store/auth';
import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';

const targetOptions = [
  { label: 'Пользователь', value: 'user' },
  { label: 'Офис', value: 'office' },
  { label: 'Все', value: 'all' },
];

const typeOptions = [
  { label: 'Info', value: 'info' },
  { label: 'Success', value: 'success' },
  { label: 'Warning', value: 'warning' },
  { label: 'Error', value: 'error' },
];

export function NotificationCreateScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');
  const [target, setTarget] = useState('user');
  const [notificationType, setNotificationType] = useState('info');
  const [recipient, setRecipient] = useState('');
  const [office, setOffice] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverNote, setServerNote] = useState('');

  const canSubmit = Boolean(title.trim() && body.trim() && (target === 'all' || recipient.trim() || office.trim()));

  const submit = async () => {
    if (!canSubmit) {
      Alert.alert('Уведомление', 'Заполните получателя, заголовок и текст.');
      return;
    }

    setSubmitting(true);
    setServerNote('');

    try {
      await createNotification({
        target,
        recipient_id: target === 'user' ? recipient.trim() : undefined,
        user_id: target === 'user' ? recipient.trim() : undefined,
        office_id: target === 'office' ? office.trim() : undefined,
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
        setServerNote('Нужно добавить endpoint POST /api/v1/notifications/ на сервере.');
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
        subtitle="Отправка сообщения сотруднику, офису или всей команде."
        showBack
        parentFallback="/(app)/notifications"
      />

      <Card glass style={styles.hero}>
        <View style={[styles.icon, { backgroundColor: appTheme.colors.accentSoft }]}>
          <Ionicons name="notifications-outline" size={24} color={appTheme.colors.accent} />
        </View>
        <Text style={[styles.title, { color: appTheme.colors.text }]}>Новое уведомление</Text>
        <Text style={[styles.text, { color: appTheme.colors.textMuted }]}>
          Если сервер ещё не принимает создание уведомлений из мобильного приложения, экран покажет мягкую ошибку.
        </Text>
      </Card>

      {serverNote ? (
        <Card style={[styles.noteCard, { borderColor: appTheme.colors.warningSoft }]}>
          <Text style={[styles.noteText, { color: appTheme.colors.warning }]}>{serverNote}</Text>
        </Card>
      ) : null}

      <SegmentedControl options={targetOptions} value={target} onChange={setTarget} />

      {target === 'user' ? (
        <Input
          label="ID пользователя"
          placeholder="Например: 12"
          value={recipient}
          onChangeText={setRecipient}
          keyboardType="number-pad"
        />
      ) : null}

      {target === 'office' ? (
        <Input
          label="ID офиса"
          placeholder="Например: 3"
          value={office}
          onChangeText={setOffice}
          keyboardType="number-pad"
        />
      ) : null}

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
});
