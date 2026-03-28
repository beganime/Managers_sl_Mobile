import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import ScreenWrapper from '../../components/ScreenWrapper';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import apiClient, { fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import { getToken, saveToken } from '../../src/utils/storage';

const degreeMap: Record<string, string> = {
  bachelor: 'Бакалавриат',
  master: 'Магистратура',
  specialist: 'Специалитет',
  language: 'Языковые курсы',
};

function toNum(value: any) {
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function flattenError(data: any, prefix = ''): string[] {
  if (data == null) return [];
  if (typeof data === 'string') return [prefix ? `${prefix}: ${data}` : data];
  if (Array.isArray(data)) {
    return data.flatMap((item) => flattenError(item, prefix));
  }
  if (typeof data === 'object') {
    return Object.entries(data).flatMap(([key, value]) =>
      flattenError(value, key)
    );
  }
  return [prefix ? `${prefix}: ${String(data)}` : String(data)];
}

export default function AddDealScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useCurrentUser();
  const { theme } = useTheme();

  const clientId = params.clientId as string | undefined;
  const clientName = params.clientName as string | undefined;

  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [clientsList, setClientsList] = useState<any[]>([]);
  const [universitiesList, setUniversitiesList] = useState<any[]>([]);
  const [currenciesList, setCurrenciesList] = useState<any[]>([]);

  const [dealType, setDealType] = useState<'university' | 'service'>('university');
  const [selectedClient, setSelectedClient] = useState<string | number>(
    clientId ? Number(clientId) : ''
  );

  const [priceClient, setPriceClient] = useState('');
  const [conversionInfo, setConversionInfo] = useState('');

  const [selectedCountry, setSelectedCountry] = useState('');
  const [uniSearch, setUniSearch] = useState('');
  const [debouncedUniSearch, setDebouncedUniSearch] = useState('');
  const [progSearch, setProgSearch] = useState('');
  const [debouncedProgSearch, setDebouncedProgSearch] = useState('');
  const [universityId, setUniversityId] = useState<number | string>('');
  const [programId, setProgramId] = useState<number | string>('');

  const [customServiceName, setCustomServiceName] = useState('');
  const [customServiceDesc, setCustomServiceDesc] = useState('');

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [clientsData, unisData, curData] = await Promise.all([
          fetchAllPages('clients/'),
          fetchAllPages('catalog/universities/'),
          fetchAllPages('catalog/currencies/'),
        ]);

        setClientsList(clientsData || []);
        setCurrenciesList(curData || []);
        setUniversitiesList(unisData || []);
        await saveToken('cache_universities', JSON.stringify(unisData || []));
      } catch {
        try {
          const cachedUnis = await getToken('cache_universities');
          if (cachedUnis) setUniversitiesList(JSON.parse(cachedUnis));
        } catch {}
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedUniSearch(uniSearch), 300);
    return () => clearTimeout(handler);
  }, [uniSearch]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedProgSearch(progSearch), 300);
    return () => clearTimeout(handler);
  }, [progSearch]);

  const uniqueCountries = useMemo(
    () => Array.from(new Set(universitiesList.map((u) => u.country))).filter(Boolean),
    [universitiesList]
  );

  const filteredUnis = useMemo(() => {
    return universitiesList
      .filter((u) => (selectedCountry === '' ? true : u.country === selectedCountry))
      .filter((u) =>
        String(u.name || '').toLowerCase().includes(debouncedUniSearch.toLowerCase())
      );
  }, [universitiesList, selectedCountry, debouncedUniSearch]);

  const selectedUniObj = useMemo(
    () => universitiesList.find((u) => String(u.id) === String(universityId)),
    [universitiesList, universityId]
  );

  const availablePrograms = useMemo(() => {
    if (!selectedUniObj?.programs) return [];
    return selectedUniObj.programs.filter((p: any) =>
      String(p.name || '').toLowerCase().includes(debouncedProgSearch.toLowerCase())
    );
  }, [selectedUniObj, debouncedProgSearch]);

  const handleProgramSelect = (prog: any) => {
    setProgramId(prog.id);
    Keyboard.dismiss();

    if (!selectedUniObj) return;

    const localCurrency = selectedUniObj.local_currency;
    let currencyObj: any = null;

    if (localCurrency && typeof localCurrency === 'object') {
      currencyObj = localCurrency;
    } else if (localCurrency) {
      currencyObj = currenciesList.find((c) => c.id === localCurrency);
    }

    const rate = currencyObj?.rate ? parseFloat(currencyObj.rate) : 1;
    const symbol = currencyObj?.symbol || '$';
    const code = currencyObj?.code || 'USD';

    const tuitionLocal = parseFloat(prog.tuition_fee) || 0;
    const serviceUsd = parseFloat(prog.service_fee) || 0;

    let tuitionUsd: number;
    if (code === 'USD' || rate <= 0) {
      tuitionUsd = tuitionLocal;
    } else {
      tuitionUsd = tuitionLocal / rate;
    }

    const totalUsd = tuitionUsd + serviceUsd;

    setPriceClient(totalUsd.toFixed(2));

    if (code !== 'USD' && rate > 0) {
      setConversionInfo(
        `Обучение: ${tuitionLocal.toLocaleString()} ${symbol} (≈ $${Math.round(
          tuitionUsd
        ).toLocaleString()}) + Услуги: $${Math.round(serviceUsd).toLocaleString()}`
      );
    } else {
      setConversionInfo(
        `Обучение: $${Math.round(tuitionUsd).toLocaleString()} + Услуги: $${Math.round(
          serviceUsd
        ).toLocaleString()}`
      );
    }
  };

  const submitForm = async () => {
    if (!selectedClient) {
      Alert.alert('Ошибка', 'Выберите клиента');
      return;
    }

    if (!priceClient || Number.isNaN(Number(priceClient.replace(',', '.'))) || Number(priceClient.replace(',', '.')) <= 0) {
      Alert.alert('Ошибка', 'Введите корректную цену');
      return;
    }

    setSubmitLoading(true);

    try {
      const clientNumeric = Number(selectedClient);
      if (!Number.isFinite(clientNumeric)) {
        throw new Error('Некорректный client id');
      }

      if (String(selectedClient).startsWith('temp_')) {
        throw new Error('offline');
      }

      const usdCurrency = currenciesList.find((c) => c.code === 'USD');
      const fallbackCurrency = currenciesList[0];
      const currencyId = Number(usdCurrency?.id ?? fallbackCurrency?.id);

      if (!Number.isFinite(currencyId)) {
        Alert.alert('Ошибка', 'Не найдена валюта для сделки.');
        setSubmitLoading(false);
        return;
      }

      const payload: any = {
        client: clientNumeric,
        deal_type: dealType,
        currency: currencyId,
        price_client: toNum(priceClient),
      };

      if (dealType === 'university') {
        if (!universityId || !programId) {
          Alert.alert('Ошибка', 'Выберите ВУЗ и программу');
          setSubmitLoading(false);
          return;
        }

        payload.university = Number(universityId);
        payload.program = Number(programId);
      } else {
        if (!customServiceName.trim()) {
          Alert.alert('Ошибка', 'Введите название услуги');
          setSubmitLoading(false);
          return;
        }

        payload.custom_service_name = customServiceName.trim();
        payload.custom_service_desc = customServiceDesc.trim();
      }

      const response = await apiClient.post('analytics/deals/', payload);
      const createdDeal = response?.data;

      Alert.alert('Успех', 'Сделка успешно создана', [
        {
          text: 'Открыть сделку',
          onPress: () => {
            if (createdDeal?.id) {
              router.replace(`/(app)/deal/${createdDeal.id}` as any);
            } else {
              router.replace('/(app)/crm' as any);
            }
          },
        },
      ]);
    } catch (error: any) {
      if (error?.response?.data) {
        const messageLines = flattenError(error.response.data);
        Alert.alert(
          'Ошибка сервера',
          messageLines.length ? messageLines.join('\n') : 'Сделка не прошла валидацию.'
        );
      } else {
        try {
          const offlineDeals = JSON.parse((await getToken('offline_deals')) || '[]');

          offlineDeals.push({
            id: `temp_${Date.now()}`,
            client: selectedClient,
            client_name: clientName || 'Офлайн клиент',
            deal_type: dealType,
            manager: user?.id ?? null,
            currency: currenciesList.find((c) => c.code === 'USD')?.id ?? currenciesList[0]?.id,
            price_client: toNum(priceClient),
            isOffline: true,
            payment_status: 'new',
            paid_amount_usd: 0,
            total_to_pay_usd: toNum(priceClient),
            ...(dealType === 'university'
              ? {
                  university: universityId,
                  program: programId,
                }
              : {
                  custom_service_name: customServiceName.trim(),
                  custom_service_desc: customServiceDesc.trim(),
                }),
          });

          await saveToken('offline_deals', JSON.stringify(offlineDeals));

          Alert.alert(
            'Нет сети',
            'Сделка сохранена локально и синхронизируется при подключении.',
            [{ text: 'OK', onPress: () => router.replace('/(app)/crm' as any) }]
          );
        } catch {
          Alert.alert('Ошибка', 'Не удалось сохранить сделку.');
        }
      }
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
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>

        <Text style={[styles.title, { color: theme.text }]}>Новая сделка</Text>

        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.label, { color: theme.textSecondary }]}>Клиент *</Text>

          {clientId ? (
            <View
              style={[
                styles.readOnlyBox,
                { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
              ]}
            >
              <Ionicons
                name="person"
                size={18}
                color={theme.blue}
                style={{ marginRight: 10 }}
              />
              <Text style={[styles.readOnlyText, { color: theme.text }]}>
                {clientName}
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipsRow}>
                {clientsList.map((c) => {
                  const active = selectedClient === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setSelectedClient(c.id)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? theme.blue : theme.surface,
                          borderColor: active ? theme.blue : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? '#fff' : theme.text,
                          fontWeight: '800',
                        }}
                      >
                        {c.full_name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}

          <Text style={[styles.label, { color: theme.textSecondary }]}>Тип сделки</Text>

          <View style={styles.row}>
            <Pressable
              onPress={() => setDealType('university')}
              style={[
                styles.typeBtn,
                {
                  backgroundColor:
                    dealType === 'university' ? theme.blue : theme.backgroundSoft,
                  borderColor:
                    dealType === 'university' ? theme.blue : theme.border,
                },
              ]}
            >
              <Ionicons
                name="school"
                size={18}
                color={dealType === 'university' ? '#fff' : theme.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={{
                  color: dealType === 'university' ? '#fff' : theme.text,
                  fontWeight: '900',
                }}
              >
                Поступление
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setDealType('service');
                setUniversityId('');
                setProgramId('');
                setConversionInfo('');
              }}
              style={[
                styles.typeBtn,
                {
                  backgroundColor:
                    dealType === 'service' ? theme.blue : theme.backgroundSoft,
                  borderColor: dealType === 'service' ? theme.blue : theme.border,
                },
              ]}
            >
              <Ionicons
                name="briefcase"
                size={18}
                color={dealType === 'service' ? '#fff' : theme.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={{
                  color: dealType === 'service' ? '#fff' : theme.text,
                  fontWeight: '900',
                }}
              >
                Доп. услуга
              </Text>
            </Pressable>
          </View>

          {dealType === 'university' ? (
            <>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Страна ВУЗа</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipsRow}>
                  <Pressable
                    onPress={() => {
                      setSelectedCountry('');
                      setUniversityId('');
                      setProgramId('');
                      setConversionInfo('');
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor:
                          selectedCountry === '' ? theme.blue : theme.surface,
                        borderColor:
                          selectedCountry === '' ? theme.blue : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: selectedCountry === '' ? '#fff' : theme.text,
                        fontWeight: '800',
                      }}
                    >
                      Все
                    </Text>
                  </Pressable>

                  {uniqueCountries.map((c) => {
                    const active = selectedCountry === c;
                    return (
                      <Pressable
                        key={String(c)}
                        onPress={() => {
                          setSelectedCountry(String(c));
                          setUniversityId('');
                          setProgramId('');
                          setConversionInfo('');
                        }}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active ? theme.blue : theme.surface,
                            borderColor: active ? theme.blue : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: active ? '#fff' : theme.text,
                            fontWeight: '800',
                          }}
                        >
                          {String(c)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              <Text style={[styles.label, { color: theme.textSecondary }]}>Университет *</Text>

              <View
                style={[
                  styles.searchBox,
                  { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
                ]}
              >
                <Ionicons
                  name="search"
                  size={18}
                  color={theme.textSecondary}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Название ВУЗа..."
                  placeholderTextColor={theme.textMuted}
                  value={uniSearch}
                  onChangeText={setUniSearch}
                />
              </View>

              <ScrollView
                style={[
                  styles.verticalList,
                  { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
                ]}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {filteredUnis.slice(0, 30).map((u) => {
                  const active = universityId === u.id;
                  return (
                    <Pressable
                      key={u.id}
                      onPress={() => {
                        setUniversityId(u.id);
                        setProgramId('');
                        setProgSearch('');
                        setConversionInfo('');
                        Keyboard.dismiss();
                      }}
                      style={[
                        styles.listItem,
                        { borderBottomColor: theme.divider },
                        active && { backgroundColor: theme.blueSoft || theme.backgroundSoft },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.listItemTitle,
                            { color: active ? theme.blue : theme.text },
                          ]}
                        >
                          {u.name}
                        </Text>
                        <Text
                          style={[
                            styles.listItemSub,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {u.city}, {u.country}
                          {u.local_currency?.code && u.local_currency.code !== 'USD'
                            ? ` • ${u.local_currency.code}`
                            : ''}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {!!selectedUniObj && (
                <>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Программа *</Text>

                  <View
                    style={[
                      styles.searchBox,
                      { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
                    ]}
                  >
                    <Ionicons
                      name="search"
                      size={18}
                      color={theme.textSecondary}
                      style={{ marginRight: 8 }}
                    />
                    <TextInput
                      style={[styles.searchInput, { color: theme.text }]}
                      placeholder="Название программы..."
                      placeholderTextColor={theme.textMuted}
                      value={progSearch}
                      onChangeText={setProgSearch}
                    />
                  </View>

                  <ScrollView
                    style={[
                      styles.verticalList,
                      { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
                    ]}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {availablePrograms.slice(0, 40).map((p: any) => {
                      const active = programId === p.id;
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => handleProgramSelect(p)}
                          style={[
                            styles.listItem,
                            { borderBottomColor: theme.divider },
                            active && {
                              backgroundColor: theme.blueSoft || theme.backgroundSoft,
                            },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.listItemTitle,
                                { color: active ? theme.blue : theme.text },
                              ]}
                            >
                              {p.name}
                            </Text>
                            <Text
                              style={[
                                styles.listItemSub,
                                { color: theme.textSecondary },
                              ]}
                            >
                              {degreeMap[p.degree] || p.degree || 'Программа'} • {p.duration || '-'}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              )}
            </>
          ) : (
            <>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Название услуги *</Text>
              <View
                style={[
                  styles.inputWrap,
                  { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
                ]}
              >
                <TextInput
                  value={customServiceName}
                  onChangeText={setCustomServiceName}
                  placeholder="Например: перевод, приглашение, виза..."
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, { color: theme.text }]}
                />
              </View>

              <Text style={[styles.label, { color: theme.textSecondary }]}>Описание услуги</Text>
              <View
                style={[
                  styles.inputWrap,
                  {
                    backgroundColor: theme.backgroundSoft,
                    borderColor: theme.border,
                    minHeight: 100,
                  },
                ]}
              >
                <TextInput
                  value={customServiceDesc}
                  onChangeText={setCustomServiceDesc}
                  placeholder="Краткое описание услуги"
                  placeholderTextColor={theme.textMuted}
                  multiline
                  style={[
                    styles.input,
                    { color: theme.text, minHeight: 76, textAlignVertical: 'top' },
                  ]}
                />
              </View>
            </>
          )}

          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Цена для клиента (USD) *
          </Text>
          <View
            style={[
              styles.inputWrap,
              { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
            ]}
          >
            <TextInput
              value={priceClient}
              onChangeText={setPriceClient}
              placeholder="0"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              style={[styles.input, { color: theme.text }]}
            />
          </View>

          {!!conversionInfo && (
            <View
              style={[
                styles.infoBox,
                { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                {conversionInfo}
              </Text>
            </View>
          )}

          <Pressable
            onPress={submitForm}
            disabled={submitLoading}
            style={[styles.submitBtn, { backgroundColor: theme.blue }]}
          >
            {submitLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Создать сделку</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
  },
  container: {
    padding: 20,
    paddingBottom: 120,
  },
  card: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  readOnlyBox: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  readOnlyText: {
    fontSize: 15,
    fontWeight: '800',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  typeBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  searchBox: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  verticalList: {
    maxHeight: 220,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
  },
  listItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  listItemSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  inputWrap: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoBox: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: 18,
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
});