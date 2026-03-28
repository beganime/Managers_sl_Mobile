// app/(app)/payment/create.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import ScreenWrapper from '../../../components/ScreenWrapper';
import apiClient, { fetchAllPages } from '../../../src/api/apiClient';
import { useTheme } from '../../../src/context/ThemeContext';

type CurrencyItem = {
  id: number | string;
  code?: string;
  symbol?: string;
  name?: string;
};

type DealItem = {
  id: number | string;
  payment_status?: string;
  deal_type?: string;
  total_to_pay_usd?: number | string;
  paid_amount_usd?: number | string;
  client_data?: {
    full_name?: string;
  } | null;
};

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function flattenServerError(data: any): string {
  if (!data) return 'Проверьте данные платежа';

  if (typeof data === 'string') return data;

  if (Array.isArray(data)) {
    return data.map((x) => String(x)).join('\n');
  }

  if (typeof data === 'object') {
    return Object.entries(data)
      .map(([key, value]) =>
        `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`
      )
      .join('\n');
  }

  return 'Проверьте данные платежа';
}

export default function CreatePaymentScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ dealId?: string }>();

  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [usdCurrencyId, setUsdCurrencyId] = useState<number | null>(null);
  const [deals, setDeals] = useState<DealItem[]>([]);

  const [selectedDealId, setSelectedDealId] = useState<string>(
    params.dealId ? String(params.dealId) : ''
  );
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'card' | 'bank'>('cash');

  useEffect(() => {
    const load = async () => {
      try {
        const [currenciesData, dealsData] = await Promise.all([
          fetchAllPages('catalog/currencies/').catch(() => []),
          fetchAllPages('analytics/deals/').catch(() => []),
        ]);

        const loadedCurrencies = currenciesData as CurrencyItem[];
        const loadedDeals = dealsData as DealItem[];

        setDeals(loadedDeals);

        const usd = loadedCurrencies.find((c) => c.code === 'USD');
        if (!usd) {
          Alert.alert('Ошибка', 'В каталоге валют не найдена USD.');
        } else {
          setUsdCurrencyId(Number(usd.id));
        }

        if (!params.dealId && loadedDeals.length) {
          setSelectedDealId(String(loadedDeals[0].id));
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [params.dealId]);

  const selectedDeal = useMemo(
    () => deals.find((item) => String(item.id) === String(selectedDealId)),
    [deals, selectedDealId]
  );

  const remainingUsd = useMemo(() => {
    return Math.max(
      0,
      num(selectedDeal?.total_to_pay_usd) - num(selectedDeal?.paid_amount_usd)
    );
  }, [selectedDeal]);

  const handleSubmit = async () => {
    if (!selectedDealId || Number.isNaN(Number(selectedDealId))) {
      Alert.alert('Ошибка', 'Некорректная сделка.');
      return;
    }

    if (!amount || Number.isNaN(Number(amount.replace(',', '.'))) || Number(amount.replace(',', '.')) <= 0) {
      Alert.alert('Ошибка', 'Введите корректную сумму платежа в USD.');
      return;
    }

    if (!usdCurrencyId) {
      Alert.alert('Ошибка', 'USD валюта не найдена.');
      return;
    }

    setSubmitLoading(true);

    try {
      await apiClient.post('analytics/payments/', {
        deal: Number(selectedDealId),
        amount: parseFloat(amount.replace(',', '.')),
        method,
        currency: usdCurrencyId,
      });

      Alert.alert('Успешно', 'Платёж отправлен администратору на подтверждение.', [
        {
          text: 'Открыть сделку',
          onPress: () => router.replace(`/(app)/deal/${selectedDealId}` as any),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Ошибка сервера', flattenServerError(error?.response?.data));
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.blue} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: theme.text }]}>Новый платёж</Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>
          Сумма вводится только в USD. После создания платёж ждёт подтверждения администратора.
        </Text>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Сделка</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipsRow}>
              {deals.map((item) => {
                const active = String(selectedDealId) === String(item.id);
                return (
                  <Pressable
                    key={String(item.id)}
                    onPress={() => setSelectedDealId(String(item.id))}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? theme.blue : theme.surface,
                        borderColor: active ? theme.blue : theme.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '900' }}>
                      #{item.id} {item.client_data?.full_name || 'Сделка'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={[styles.selectedBox, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
            <Text style={[styles.selectedTitle, { color: theme.text }]}>
              {selectedDeal
                ? `${selectedDeal.client_data?.full_name || 'Клиент'} · #${selectedDeal.id}`
                : 'Сделка не выбрана'}
            </Text>
            <Text style={[styles.selectedSub, { color: theme.textSecondary }]}>
              Остаток: ${remainingUsd.toFixed(2)}
            </Text>
          </View>

          <Text style={[styles.label, { color: theme.textSecondary, marginTop: 16 }]}>
            Валюта
          </Text>
          <View style={[styles.fixedBox, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
            <Text style={[styles.fixedBoxText, { color: theme.text }]}>USD ($)</Text>
          </View>

          <Text style={[styles.label, { color: theme.textSecondary, marginTop: 16 }]}>
            Сумма в USD
          </Text>
          <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="Введите сумму в USD"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              style={[styles.input, { color: theme.text }]}
            />
          </View>

          <Text style={[styles.label, { color: theme.textSecondary, marginTop: 16 }]}>
            Способ оплаты
          </Text>

          <View style={styles.methodRow}>
            {(['cash', 'card', 'bank'] as const).map((item) => {
              const active = method === item;
              const label =
                item === 'cash' ? 'Наличные' : item === 'card' ? 'Карта' : 'Перевод';

              return (
                <Pressable
                  key={item}
                  onPress={() => setMethod(item)}
                  style={[
                    styles.methodBtn,
                    {
                      backgroundColor: active ? theme.blue : theme.surface,
                      borderColor: active ? theme.blue : theme.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? '#fff' : theme.text, fontWeight: '900' }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable onPress={handleSubmit} style={[styles.submitBtn, { backgroundColor: theme.success }]}>
          {submitLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Оформить платёж</Text>
          )}
        </Pressable>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, paddingBottom: 120, gap: 14 },
  title: { fontSize: 28, fontWeight: '900' },
  sub: { marginTop: 6, fontSize: 13, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 24, padding: 16 },
  label: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  chipsRow: { flexDirection: 'row', gap: 8, paddingRight: 16, marginTop: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  selectedBox: { borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 14 },
  selectedTitle: { fontSize: 15, fontWeight: '900' },
  selectedSub: { marginTop: 6, fontSize: 12, fontWeight: '600' },
  fixedBox: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 16, marginTop: 8 },
  fixedBoxText: { fontSize: 15, fontWeight: '800' },
  inputWrap: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8 },
  input: { fontSize: 15, fontWeight: '600' },
  methodRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  methodBtn: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  submitBtn: { borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});