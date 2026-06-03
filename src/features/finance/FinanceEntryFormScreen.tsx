import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  createExpense,
  createIncome,
  listCashboxes,
  listExpenseCategories,
} from '../../api/finance';
import { extractItems, toApiError } from '../../api/client';
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
import { ApiListItem, EntityId } from '../../types';
import { getEntityId, getEntityString, getEntityTitle } from '../../utils/entity';

function normalizeId(value: unknown): EntityId | undefined {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) && String(parsed) === value ? parsed : value;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function FinanceEntryFormScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = params.kind === 'expenses' || pathname.includes('/expenses/') ? 'expenses' : 'incomes';
  const isExpense = kind === 'expenses';

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [comment, setComment] = useState('');
  const [source, setSource] = useState('');
  const [cashboxId, setCashboxId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [saving, setSaving] = useState(false);

  const loadFormData = useCallback(async () => {
    const [cashboxes, categories] = await Promise.all([
      listCashboxes({ limit: 50, is_active: true }).catch(() => []),
      listExpenseCategories({ limit: 50, is_active: true }).catch(() => []),
    ]);

    return {
      cashboxes: extractItems<ApiListItem>(cashboxes),
      categories: extractItems<ApiListItem>(categories),
    };
  }, []);

  const { data, loading, error, reload } = useAsyncResource(loadFormData);

  const selectedCashbox = useMemo(
    () => data?.cashboxes.find((cashbox) => String(getEntityId(cashbox)) === String(cashboxId)),
    [cashboxId, data?.cashboxes]
  );

  const selectedCategory = useMemo(
    () => data?.categories.find((category) => String(getEntityId(category)) === String(categoryId)),
    [categoryId, data?.categories]
  );

  const submit = async () => {
    const cleanTitle = title.trim();
    const cleanAmount = amount.trim().replace(',', '.');

    if (!cleanTitle) {
      Alert.alert(isExpense ? 'Расход' : 'Доход', 'Введите название.');
      return;
    }

    if (!cleanAmount || Number.isNaN(Number(cleanAmount))) {
      Alert.alert(isExpense ? 'Расход' : 'Доход', 'Введите сумму числом.');
      return;
    }

    if (!selectedCashbox) {
      Alert.alert(isExpense ? 'Расход' : 'Доход', 'Выберите кассу.');
      return;
    }

    if (isExpense && !selectedCategory) {
      Alert.alert('Расход', 'Выберите категорию расхода.');
      return;
    }

    const company = normalizeId(getEntityString(selectedCashbox, ['company']));
    const office = normalizeId(getEntityString(selectedCashbox, ['office']));
    const currency = normalizeId(getEntityString(selectedCashbox, ['currency']));

    if (!company || !currency) {
      Alert.alert(
        isExpense ? 'Расход' : 'Доход',
        'В выбранной кассе не хватает company или currency. Проверьте кассу в backend.'
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        title: cleanTitle,
        amount: cleanAmount,
        date: date.trim() || today(),
        cashbox: getEntityId(selectedCashbox),
        company,
        office: office || null,
        currency,
        comment: comment.trim(),
        source: source.trim(),
        category: selectedCategory ? getEntityId(selectedCategory) : undefined,
      };

      const saved = isExpense ? await createExpense(payload) : await createIncome(payload);
      router.replace(`/(app)/finance-v2/${kind}/${getEntityId(saved)}` as any);
    } catch (requestError) {
      Alert.alert(isExpense ? 'Расход' : 'Доход', toApiError(requestError).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <ScreenContainer>
        <Header title={isExpense ? 'Новый расход' : 'Новый доход'} showBack />
        <LoadingState title="Готовим форму" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Header
        title={isExpense ? 'Новый расход' : 'Новый доход'}
        subtitle="Форма использует реальные кассы и категории из finance API."
        showBack
        parentFallback="/(app)/(tabs)/finance"
      />

      {error ? <ErrorState message={error} actionTitle="Повторить" onAction={reload} /> : null}

      <Card glass style={styles.form}>
        <Input
          label="Название"
          placeholder={isExpense ? 'Например: Аренда офиса' : 'Например: Оплата консультации'}
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label="Сумма"
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <Input
          label="Дата"
          placeholder="YYYY-MM-DD"
          value={date}
          onChangeText={setDate}
        />
        {!isExpense ? (
          <Input
            label="Источник"
            placeholder="Клиент, сервис, партнёр"
            value={source}
            onChangeText={setSource}
          />
        ) : null}
        <Input
          label="Комментарий"
          placeholder="Короткое пояснение"
          value={comment}
          onChangeText={setComment}
          multiline
          style={styles.textarea}
        />

        <SectionTitle title="Касса" subtitle={selectedCashbox ? getEntityTitle(selectedCashbox) : 'Выберите кассу'} />
        {data?.cashboxes.length ? (
          <View style={styles.chips}>
            {data.cashboxes.map((cashbox) => {
              const id = String(getEntityId(cashbox));
              const active = id === cashboxId;

              return (
                <Pressable
                  key={id}
                  onPress={() => setCashboxId(id)}
                  style={({ pressed }) => [
                    styles.chip,
                    active && styles.chipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{getEntityTitle(cashbox)}</Text>
                  <Text style={[styles.chipMeta, active && styles.chipTextActive]}>
                    {getEntityString(cashbox, ['currency_code'], 'currency')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState title="Касс нет" message="Для создания записи нужна активная касса." />
        )}

        {isExpense ? (
          <>
            <SectionTitle
              title="Категория"
              subtitle={selectedCategory ? getEntityTitle(selectedCategory) : 'Выберите категорию расхода'}
            />
            {data?.categories.length ? (
              <View style={styles.chips}>
                {data.categories.map((category) => {
                  const id = String(getEntityId(category));
                  const active = id === categoryId;

                  return (
                    <Pressable
                      key={id}
                      onPress={() => setCategoryId(id)}
                      style={({ pressed }) => [
                        styles.chip,
                        active && styles.chipActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{getEntityTitle(category)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <EmptyState title="Категорий нет" message="Для расхода нужна expense category." />
            )}
          </>
        ) : null}

        <Button
          title={isExpense ? 'Создать расход' : 'Создать доход'}
          loading={saving}
          onPress={submit}
        />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: theme.spacing.lg,
  },
  textarea: {
    minHeight: 96,
    paddingTop: theme.spacing.md,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    minWidth: 130,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
    gap: 3,
    padding: theme.spacing.md,
  },
  chipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  chipText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  chipMeta: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  chipTextActive: {
    color: theme.colors.white,
  },
  pressed: {
    opacity: 0.72,
  },
});
