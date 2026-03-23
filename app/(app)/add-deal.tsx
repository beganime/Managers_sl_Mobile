// app/(app)/add-deal.tsx
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Colors, Layout } from '../../constants/theme';
import apiClient from '../../src/api/apiClient';
import { getToken, saveToken } from '../../src/utils/storage';

// ✅ ИСПРАВЛЕНИЕ: degreeMap объявлен здесь, а не только в catalog.tsx
const degreeMap: Record<string, string> = {
    'bachelor': 'Бакалавриат',
    'master': 'Магистратура',
    'specialist': 'Специалитет',
    'language': 'Языковые курсы'
};

export default function AddDealScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const clientId = params.clientId as string | undefined;
    const clientName = params.clientName as string | undefined;

    const [loading, setLoading] = useState(true);
    const [submitLoading, setSubmitLoading] = useState(false);

    const [clientsList, setClientsList] = useState<any[]>([]);
    const [universitiesList, setUniversitiesList] = useState<any[]>([]);
    const [currenciesList, setCurrenciesList] = useState<any[]>([]);

    const [dealType, setDealType] = useState<'university' | 'service'>('university');
    const [selectedClient, setSelectedClient] = useState<string | number>(clientId ? Number(clientId) : '');

    const [priceClient, setPriceClient] = useState('');
    const [expectedRevenue, setExpectedRevenue] = useState('');
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
                const [clientsRes, unisRes, curRes] = await Promise.all([
                    apiClient.get('clients/'),
                    apiClient.get('catalog/universities/'),
                    apiClient.get('catalog/currencies/')
                ]);

                setClientsList(clientsRes.data.results || clientsRes.data || []);
                setCurrenciesList(curRes.data.results || curRes.data || []);

                const unisData = unisRes.data.results || unisRes.data || [];
                setUniversitiesList(unisData);
                await saveToken('cache_universities', JSON.stringify(unisData));
            } catch (error) {
                console.log('Офлайн режим, загружаем кэш...');
                try {
                    const cachedUnis = await getToken('cache_universities');
                    if (cachedUnis) setUniversitiesList(JSON.parse(cachedUnis));
                } catch (e) {
                    console.log('Кэш не найден');
                }
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
        () => Array.from(new Set(universitiesList.map(u => u.country))).filter(Boolean),
        [universitiesList]
    );

    const filteredUnis = useMemo(() => {
        return universitiesList
            .filter(u => (selectedCountry === '' ? true : u.country === selectedCountry))
            .filter(u => u.name?.toLowerCase().includes(debouncedUniSearch.toLowerCase()));
    }, [universitiesList, selectedCountry, debouncedUniSearch]);

    const selectedUniObj = useMemo(
        () => universitiesList.find(u => String(u.id) === String(universityId)),
        [universitiesList, universityId]
    );

    const availablePrograms = useMemo(() => {
        if (!selectedUniObj?.programs) return [];
        return selectedUniObj.programs.filter((p: any) =>
            p.name?.toLowerCase().includes(debouncedProgSearch.toLowerCase())
        );
    }, [selectedUniObj, debouncedProgSearch]);

    // ✅ ИСПРАВЛЕНИЕ: Правильный расчёт цены с учётом реальной валюты ВУЗа
    const handleProgramSelect = (prog: any) => {
        setProgramId(prog.id);
        Keyboard.dismiss();

        if (!selectedUniObj) return;

        // local_currency может быть объектом или ID
        const localCurrency = selectedUniObj.local_currency;
        let currencyObj: any = null;

        if (localCurrency && typeof localCurrency === 'object') {
            currencyObj = localCurrency;
        } else if (localCurrency) {
            currencyObj = currenciesList.find(c => c.id === localCurrency);
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
        setExpectedRevenue(serviceUsd.toFixed(2));

        if (code !== 'USD' && rate > 1) {
            setConversionInfo(
                `Обучение: ${tuitionLocal.toLocaleString()} ${symbol} (≈ $${Math.round(tuitionUsd).toLocaleString()}) + Услуги: $${Math.round(serviceUsd).toLocaleString()}`
            );
        } else {
            setConversionInfo(
                `Обучение: $${Math.round(tuitionUsd).toLocaleString()} + Услуги: $${Math.round(serviceUsd).toLocaleString()}`
            );
        }
    };

    const submitForm = async () => {
        if (!selectedClient) return Alert.alert('Ошибка', 'Выберите клиента');
        if (!priceClient || isNaN(Number(priceClient))) return Alert.alert('Ошибка', 'Введите корректную цену');
        if (dealType === 'university' && (!universityId || !programId))
            return Alert.alert('Ошибка', 'Выберите ВУЗ и программу');
        if (dealType === 'service' && !customServiceName.trim())
            return Alert.alert('Ошибка', 'Введите название услуги');

        setSubmitLoading(true);
        try {
            const usdCurrency = currenciesList.find(c => c.code === 'USD');
            const usdCurrencyId = usdCurrency?.id ?? 1;
            const finalPrice = parseFloat(priceClient);

            const payload: any = {
                client: selectedClient,
                deal_type: dealType,
                currency: usdCurrencyId,
                price_client: finalPrice,
                total_to_pay_usd: finalPrice,
                expected_revenue_usd: expectedRevenue ? parseFloat(expectedRevenue) : 0,
            };

            if (dealType === 'university') {
                payload.university = universityId || null;
                payload.program = programId || null;
            } else {
                payload.custom_service_name = customServiceName;
                payload.custom_service_desc = customServiceDesc;
            }

            // Проверка на офлайн-клиента
            if (String(selectedClient).startsWith('temp_')) {
                throw new Error('offline');
            }

            await apiClient.post('analytics/deals/', payload);
            Alert.alert('Успех', 'Сделка успешно создана', [
                { text: 'OK', onPress: () => router.replace('/crm') }
            ]);
        } catch (error: any) {
            if (error.response?.data) {
                const errorMsg = Object.entries(error.response.data)
                    .map(([key, msgs]) => `${key}: ${msgs}`)
                    .join('\n');
                Alert.alert('Ошибка сервера', errorMsg);
            } else {
                // Офлайн сохранение
                try {
                    const offlineDeals = JSON.parse((await getToken('offline_deals')) || '[]');
                    offlineDeals.push({
                        client: selectedClient,
                        deal_type: dealType,
                        price_client: parseFloat(priceClient),
                        expected_revenue_usd: expectedRevenue ? parseFloat(expectedRevenue) : 0,
                        id: `temp_${Date.now()}`,
                        client_name: clientName || 'Офлайн клиент',
                        payment_status: 'new',
                        isOffline: true,
                        ...(dealType === 'university'
                            ? { university: universityId, program: programId }
                            : { custom_service_name: customServiceName, custom_service_desc: customServiceDesc }),
                    });
                    await saveToken('offline_deals', JSON.stringify(offlineDeals));
                    Alert.alert('Нет сети', 'Сделка сохранена локально и синхронизируется при подключении.');
                    router.replace('/crm');
                } catch (e) {
                    Alert.alert('Ошибка', 'Не удалось сохранить сделку.');
                }
            }
        } finally {
            setSubmitLoading(false);
        }
    };

    if (loading)
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                </View>
            </ScreenWrapper>
        );

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Новая сделка</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.card}>
                    {/* Клиент */}
                    <Text style={styles.label}>Клиент *</Text>
                    {clientId ? (
                        <View style={styles.inputReadOnly}>
                            <Ionicons name="person" size={18} color={Colors.light.primary} style={{ marginRight: 10 }} />
                            <Text style={{ color: Colors.light.text, fontSize: 16, fontWeight: 'bold' }}>{clientName}</Text>
                        </View>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                            {clientsList.map(c => (
                                <TouchableOpacity
                                    key={c.id}
                                    style={[styles.modalChip, selectedClient === c.id && styles.modalChipActive]}
                                    onPress={() => setSelectedClient(c.id)}
                                >
                                    <Text style={[styles.modalChipText, selectedClient === c.id && { color: '#FFF' }]}>
                                        {c.full_name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {/* Тип сделки */}
                    <Text style={styles.label}>Тип сделки</Text>
                    <View style={styles.rowInputs}>
                        <TouchableOpacity
                            style={[styles.typeChip, dealType === 'university' && styles.typeChipActive]}
                            onPress={() => setDealType('university')}
                        >
                            <Ionicons
                                name="school"
                                size={18}
                                color={dealType === 'university' ? '#fff' : Colors.light.textSecondary}
                                style={{ marginRight: 6 }}
                            />
                            <Text style={[styles.typeChipText, dealType === 'university' && { color: '#fff' }]}>
                                Поступление
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.typeChip, dealType === 'service' && styles.typeChipActive]}
                            onPress={() => {
                                setDealType('service');
                                setUniversityId('');
                                setProgramId('');
                                setConversionInfo('');
                            }}
                        >
                            <Ionicons
                                name="briefcase"
                                size={18}
                                color={dealType === 'service' ? '#fff' : Colors.light.textSecondary}
                                style={{ marginRight: 6 }}
                            />
                            <Text style={[styles.typeChipText, dealType === 'service' && { color: '#fff' }]}>
                                Доп. Услуга
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Поступление в ВУЗ */}
                    {dealType === 'university' && (
                        <>
                            <Text style={styles.label}>Страна ВУЗа</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
                                <TouchableOpacity
                                    style={[styles.modalChip, selectedCountry === '' && styles.modalChipActive]}
                                    onPress={() => {
                                        setSelectedCountry('');
                                        setUniversityId('');
                                        setProgramId('');
                                        setConversionInfo('');
                                    }}
                                >
                                    <Text style={[styles.modalChipText, selectedCountry === '' && { color: '#FFF' }]}>
                                        Все
                                    </Text>
                                </TouchableOpacity>
                                {uniqueCountries.map(c => (
                                    <TouchableOpacity
                                        key={c as string}
                                        style={[styles.modalChip, selectedCountry === c && styles.modalChipActive]}
                                        onPress={() => {
                                            setSelectedCountry(c as string);
                                            setUniversityId('');
                                            setProgramId('');
                                            setConversionInfo('');
                                        }}
                                    >
                                        <Text style={[styles.modalChipText, selectedCountry === c && { color: '#FFF' }]}>
                                            {c as string}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={styles.label}>Университет *</Text>
                            <View style={styles.searchBox}>
                                <Ionicons name="search" size={18} color={Colors.light.textSecondary} style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.searchInputInner}
                                    placeholder="Название ВУЗа..."
                                    placeholderTextColor={Colors.light.textSecondary}
                                    value={uniSearch}
                                    onChangeText={setUniSearch}
                                />
                            </View>
                            <ScrollView style={styles.verticalList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                {filteredUnis.slice(0, 30).map(u => (
                                    <TouchableOpacity
                                        key={u.id}
                                        style={[styles.listItem, universityId === u.id && styles.listItemSelected]}
                                        onPress={() => {
                                            setUniversityId(u.id);
                                            setProgramId('');
                                            setProgSearch('');
                                            setConversionInfo('');
                                            Keyboard.dismiss();
                                        }}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text
                                                style={[
                                                    styles.listItemText,
                                                    universityId === u.id && styles.listItemTextSelected
                                                ]}
                                            >
                                                {u.name}
                                            </Text>
                                            <Text style={styles.listItemSubText}>
                                                {u.city}, {u.country}
                                                {u.local_currency?.code && u.local_currency.code !== 'USD'
                                                    ? ` • ${u.local_currency.code}`
                                                    : ''}
                                            </Text>
                                        </View>
                                        {universityId === u.id && (
                                            <Ionicons name="checkmark-circle" size={20} color={Colors.light.primary} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                                {filteredUnis.length === 0 && (
                                    <Text style={styles.emptyText}>ВУЗы не найдены</Text>
                                )}
                            </ScrollView>

                            {universityId !== '' && (
                                <>
                                    <Text style={styles.label}>Программа *</Text>
                                    <View style={styles.searchBox}>
                                        <Ionicons
                                            name="search"
                                            size={18}
                                            color={Colors.light.textSecondary}
                                            style={{ marginRight: 8 }}
                                        />
                                        <TextInput
                                            style={styles.searchInputInner}
                                            placeholder="Поиск программы..."
                                            placeholderTextColor={Colors.light.textSecondary}
                                            value={progSearch}
                                            onChangeText={setProgSearch}
                                        />
                                    </View>
                                    <ScrollView
                                        style={styles.verticalList}
                                        nestedScrollEnabled
                                        keyboardShouldPersistTaps="handled"
                                    >
                                        {availablePrograms.map((p: any) => (
                                            <TouchableOpacity
                                                key={p.id}
                                                style={[styles.listItem, programId === p.id && styles.listItemSelected]}
                                                onPress={() => handleProgramSelect(p)}
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <Text
                                                        style={[
                                                            styles.listItemText,
                                                            programId === p.id && styles.listItemTextSelected
                                                        ]}
                                                    >
                                                        {p.name}
                                                    </Text>
                                                    <Text style={styles.listItemSubText}>
                                                        {degreeMap[p.degree] || p.degree} | {p.duration}
                                                    </Text>
                                                </View>
                                                {programId === p.id && (
                                                    <Ionicons name="checkmark-circle" size={20} color={Colors.light.primary} />
                                                )}
                                            </TouchableOpacity>
                                        ))}
                                        {availablePrograms.length === 0 && (
                                            <Text style={styles.emptyText}>Программы не найдены</Text>
                                        )}
                                    </ScrollView>
                                </>
                            )}
                        </>
                    )}

                    {/* Доп. услуга */}
                    {dealType === 'service' && (
                        <>
                            <Text style={styles.label}>Название услуги *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Например: Оформление визы"
                                placeholderTextColor={Colors.light.textSecondary}
                                value={customServiceName}
                                onChangeText={setCustomServiceName}
                            />
                            <Text style={styles.label}>Описание действий</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                multiline
                                placeholder="Собрать документы..."
                                placeholderTextColor={Colors.light.textSecondary}
                                value={customServiceDesc}
                                onChangeText={setCustomServiceDesc}
                            />
                        </>
                    )}

                    {/* Финансы */}
                    <Text style={styles.sectionSubTitle}>Итоговые Финансы (USD)</Text>

                    {conversionInfo !== '' && dealType === 'university' && (
                        <View style={styles.infoBox}>
                            <Ionicons
                                name="information-circle-outline"
                                size={18}
                                color={Colors.light.primary}
                                style={{ marginRight: 8 }}
                            />
                            <Text style={styles.infoBoxText}>{conversionInfo}</Text>
                        </View>
                    )}

                    <View style={styles.rowInputs}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={styles.label}>Клиенту ($)</Text>
                            <TextInput
                                style={styles.searchBox}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={Colors.light.textSecondary}
                                value={priceClient}
                                onChangeText={setPriceClient}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Прибыль ($)</Text>
                            <TextInput
                                style={styles.searchBox}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={Colors.light.textSecondary}
                                value={expectedRevenue}
                                onChangeText={setExpectedRevenue}
                            />
                        </View>
                    </View>

                    <TouchableOpacity style={styles.submitBtn} onPress={submitForm} disabled={submitLoading}>
                        {submitLoading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.submitBtnText}>Оформить сделку</Text>
                        )}
                    </TouchableOpacity>
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
        padding: 20,
        paddingTop: 10,
    },
    backBtn: {
        padding: 10,
        backgroundColor: '#fff',
        borderRadius: Layout.radius.small,
        ...Layout.shadows.light,
    },
    title: { fontSize: 20, fontWeight: '800', color: Colors.light.text },
    container: { paddingHorizontal: 20, paddingBottom: 100 },
    card: {
        padding: 24,
        borderRadius: Layout.radius.large,
        backgroundColor: '#FFFFFF',
        ...Layout.shadows.light,
        marginBottom: 20,
    },
    sectionSubTitle: {
        color: Colors.light.primary,
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 15,
        marginTop: 10,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    label: {
        fontSize: 11,
        fontWeight: '800',
        color: Colors.light.textSecondary,
        marginBottom: 8,
        marginLeft: 6,
        textTransform: 'uppercase',
    },
    input: {
        backgroundColor: '#F2F2F7',
        borderRadius: Layout.radius.medium,
        padding: 16,
        fontSize: 15,
        marginBottom: 20,
        color: Colors.light.text,
        fontWeight: '500',
    },
    inputReadOnly: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F2F2F7',
        borderRadius: Layout.radius.medium,
        padding: 16,
        marginBottom: 20,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F2F2F7',
        borderRadius: Layout.radius.medium,
        paddingHorizontal: 15,
        height: 50,
        marginBottom: 10,
        fontSize: 16,
        fontWeight: '600',
    },
    searchInputInner: {
        flex: 1,
        color: Colors.light.text,
        fontSize: 16,
        fontWeight: '500',
    },
    verticalList: {
        maxHeight: 200,
        backgroundColor: '#F2F2F7',
        borderRadius: Layout.radius.medium,
        padding: 5,
        marginBottom: 20,
    },
    listItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 14,
        borderRadius: Layout.radius.small,
        marginBottom: 2,
    },
    listItemSelected: { backgroundColor: '#fff', ...Layout.shadows.light },
    listItemText: { color: Colors.light.text, fontSize: 14, fontWeight: '600' },
    listItemTextSelected: { color: Colors.light.primary, fontWeight: '800' },
    listItemSubText: {
        color: Colors.light.textSecondary,
        fontSize: 11,
        marginTop: 4,
        fontWeight: '500',
    },
    emptyText: {
        color: Colors.light.textSecondary,
        textAlign: 'center',
        padding: 20,
        fontStyle: 'italic',
    },
    rowInputs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    typeChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F2F2F7',
        paddingVertical: 12,
        borderRadius: Layout.radius.medium,
        marginRight: 10,
    },
    typeChipActive: { backgroundColor: Colors.light.primary },
    typeChipText: { color: Colors.light.textSecondary, fontWeight: '700', fontSize: 13 },
    modalChip: {
        backgroundColor: '#F2F2F7',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: Layout.radius.medium,
        marginRight: 10,
    },
    modalChipActive: { backgroundColor: Colors.light.primary },
    modalChipText: { fontSize: 13, fontWeight: '700', color: Colors.light.text },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 122, 255, 0.1)',
        padding: 12,
        borderRadius: Layout.radius.small,
        marginBottom: 15,
    },
    infoBoxText: { flex: 1, color: Colors.light.primary, fontSize: 12, fontWeight: '600' },
    submitBtn: {
        backgroundColor: Colors.light.primary,
        padding: 18,
        borderRadius: Layout.radius.large,
        alignItems: 'center',
        marginTop: 10,
        ...Layout.shadows.medium,
    },
    submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});