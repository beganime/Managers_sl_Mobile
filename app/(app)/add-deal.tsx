// app/(app)/add-deal.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
import apiClient from '../../src/api/apiClient';
import { getToken, saveToken } from '../../src/utils/storage';

export default function AddDealScreen() {
    const router = useRouter();
    const { clientId, clientName } = useLocalSearchParams(); 

    const [loading, setLoading] = useState(true);
    const [submitLoading, setSubmitLoading] = useState(false);
    
    // --- ДАННЫЕ С БЭКЕНДА ---
    const [clientsList, setClientsList] = useState<any[]>([]);
    const [universitiesList, setUniversitiesList] = useState<any[]>([]);
    const [currenciesList, setCurrenciesList] = useState<any[]>([]);
    
    // --- ПОЛЯ СДЕЛКИ ---
    const [dealType, setDealType] = useState<'university' | 'service'>('university');
    const [selectedClient, setSelectedClient] = useState<string | number>(clientId ? Number(clientId) : '');
    
    const [priceClient, setPriceClient] = useState('');
    const [expectedRevenue, setExpectedRevenue] = useState('');
    const [conversionInfo, setConversionInfo] = useState(''); // Для вывода расшифровки расчета
    
    // Поля ВУЗа
    const [selectedCountry, setSelectedCountry] = useState('');
    const [uniSearch, setUniSearch] = useState('');
    const [progSearch, setProgSearch] = useState('');
    const [universityId, setUniversityId] = useState<number | string>('');
    const [programId, setProgramId] = useState<number | string>('');

    // Поля доп. услуги
    const [customServiceName, setCustomServiceName] = useState('');
    const [customServiceDesc, setCustomServiceDesc] = useState('');

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Скачиваем сразу клиентов, ВУЗы и Валюты
                const [clientsRes, unisRes, curRes] = await Promise.all([
                    apiClient.get('clients/'),
                    apiClient.get('catalog/universities/'),
                    apiClient.get('catalog/currencies/')
                ]);
                
                setClientsList(clientsRes.data.results || clientsRes.data);
                setCurrenciesList(curRes.data.results || curRes.data);
                
                const unisData = unisRes.data.results || unisRes.data;
                setUniversitiesList(unisData);
                await saveToken('cache_universities', JSON.stringify(unisData));
            } catch (error) {
                console.log('Ошибка сети, грузим из кеша');
                const cachedUnis = await getToken('cache_universities');
                if (cachedUnis) setUniversitiesList(JSON.parse(cachedUnis));
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    // --- ФИЛЬТРЫ ---
    const uniqueCountries = useMemo(() => Array.from(new Set(universitiesList.map(u => u.country))).filter(Boolean), [universitiesList]);
    
    const filteredUnis = useMemo(() => {
        return universitiesList
            .filter(u => selectedCountry === '' ? true : u.country === selectedCountry)
            .filter(u => u.name?.toLowerCase().includes(uniSearch.toLowerCase()));
    }, [universitiesList, selectedCountry, uniSearch]);

    const selectedUniObj = universitiesList.find(u => String(u.id) === String(universityId));
    const availablePrograms = useMemo(() => {
        if (!selectedUniObj || !selectedUniObj.programs) return [];
        return selectedUniObj.programs.filter((p: any) => p.name?.toLowerCase().includes(progSearch.toLowerCase()));
    }, [selectedUniObj, progSearch]);

    // --- АВТОМАТИЧЕСКИЙ РАСЧЕТ И КОНВЕРТАЦИЯ В USD ---
    const handleProgramSelect = (prog: any) => {
        setProgramId(prog.id);
        Keyboard.dismiss();

        // 1. Ищем валюту университета
        const uniCurrencyId = selectedUniObj?.local_currency;
        const currencyObj = currenciesList.find(c => c.id === uniCurrencyId);
        
        const rate = currencyObj ? parseFloat(currencyObj.rate) : 1;
        const symbol = currencyObj ? currencyObj.symbol : '';

        // 2. Достаем цены
        const tuitionLocal = parseFloat(prog.tuition_fee) || 0;
        const serviceUsd = parseFloat(prog.service_fee) || 0;
        
        // 3. Считаем (rate = сколько единиц местной валюты в 1 долларе)
        const tuitionUsd = rate > 0 ? (tuitionLocal / rate) : tuitionLocal;
        const totalUsd = tuitionUsd + serviceUsd;

        // 4. Заполняем стейты
        setPriceClient(totalUsd.toFixed(2));
        setExpectedRevenue(serviceUsd.toFixed(2));
        
        // 5. Формируем красивую подсказку
        if (currencyObj && currencyObj.code !== 'USD') {
            setConversionInfo(`Обучение: ${tuitionLocal.toLocaleString()} ${symbol} (≈ $${Math.round(tuitionUsd)}) + Услуги: $${Math.round(serviceUsd)}`);
        } else {
            setConversionInfo(`Обучение: $${tuitionUsd} + Услуги: $${serviceUsd}`);
        }
    };

    // --- ОТПРАВКА НА СЕРВЕР ---
    const submitForm = async () => {
        if (!selectedClient) {
            Alert.alert('Ошибка', 'Выберите клиента');
            return;
        }
        if (!priceClient || isNaN(Number(priceClient))) {
            Alert.alert('Ошибка', 'Введите корректную итоговую цену (число)');
            return;
        }
        if (dealType === 'university' && (!universityId || !programId)) {
            Alert.alert("Ошибка", "Обязательно выберите ВУЗ и программу");
            return;
        }
        if (dealType === 'service' && !customServiceName.trim()) {
            Alert.alert("Ошибка", "Введите название услуги");
            return;
        }

        setSubmitLoading(true);
        try {
            // Ищем ID для USD (обычно 1, но лучше найти точно, если USD есть в базе)
            const usdCurrency = currenciesList.find(c => c.code === 'USD');
            const usdCurrencyId = usdCurrency ? usdCurrency.id : 1;

            const finalPrice = parseFloat(priceClient);

            // ИСПРАВЛЕНИЕ ОШИБКИ: добавили total_to_pay_usd в payload
            const payload: any = {
                client: selectedClient,
                deal_type: dealType,
                currency: usdCurrencyId, 
                price_client: finalPrice,
                total_to_pay_usd: finalPrice, // <- Вот то самое обязательное поле для DRF
                expected_revenue_usd: expectedRevenue ? parseFloat(expectedRevenue) : 0,
            };

            if (dealType === 'university') {
                payload.university = universityId || null;
                payload.program = programId || null;
                payload.custom_service_name = '';
                payload.custom_service_desc = '';
            } else {
                payload.university = null;
                payload.program = null;
                payload.custom_service_name = customServiceName;
                payload.custom_service_desc = customServiceDesc;
            }

            if (String(selectedClient).startsWith('temp_')) throw new Error("offline_client");

            await apiClient.post('analytics/deals/', payload);
            Alert.alert('Успех', 'Сделка успешно создана', [
                { text: 'OK', onPress: () => router.replace('/crm') }
            ]);

        } catch (error: any) {
            console.log("Ошибка добавления сделки:", error.response?.data || error.message);
            
            if (error.response?.data) {
                let errorMsg = Object.entries(error.response.data)
                    .map(([key, msgs]) => `${key}: ${msgs}`)
                    .join('\n');
                Alert.alert('Ошибка сервера (400)', errorMsg);
            } else {
                const offlineDeals = JSON.parse(await getToken('offline_deals') || '[]');
                offlineDeals.push({
                    client: selectedClient, deal_type: dealType,
                    price_client: parseFloat(priceClient), total_to_pay_usd: parseFloat(priceClient),
                    id: `temp_${Date.now()}`, client_name: clientName || "Офлайн клиент",
                    payment_status: 'new', isOffline: true
                });
                await saveToken('offline_deals', JSON.stringify(offlineDeals));
                Alert.alert("Нет сети", "Сделка сохранена локально и будет отправлена при синхронизации.");
                router.replace('/crm');
            }
        } finally {
            setSubmitLoading(false);
        }
    };

    if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color="#0D416D" /></View></ScreenWrapper>;

    return (
        <ScreenWrapper>
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient colors={['#F1F5F9', '#E2E8F0']} style={StyleSheet.absoluteFillObject} />
            </View>

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.title}>Новая сделка</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <BlurView intensity={40} tint="light" style={styles.glassCard}>
                    
                    <Text style={styles.label}>Клиент *</Text>
                    {clientId ? (
                        <View style={styles.inputReadOnly}>
                            <Ionicons name="person" size={18} color="#0D416D" style={{marginRight: 10}} />
                            <Text style={{ color: '#0F172A', fontSize: 16, fontWeight: 'bold' }}>{clientName}</Text>
                        </View>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:20}}>
                            {clientsList.map(c => (
                                <TouchableOpacity key={c.id} style={[styles.modalChip, selectedClient === c.id && styles.modalChipActive]} onPress={() => setSelectedClient(c.id)}>
                                    <Text style={[styles.modalChipText, selectedClient === c.id && {color:'#FFF'}]}>{c.full_name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    <Text style={styles.label}>Тип сделки</Text>
                    <View style={styles.rowInputs}>
                        <TouchableOpacity style={[styles.typeChip, dealType === 'university' && styles.typeChipActive]} onPress={() => setDealType('university')}>
                            <Ionicons name="school" size={18} color={dealType === 'university' ? "#fff" : "#64748B"} style={{marginRight: 6}} />
                            <Text style={[styles.typeChipText, dealType === 'university' && {color: '#fff'}]}>Поступление</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.typeChip, dealType === 'service' && styles.typeChipActive]} onPress={() => {setDealType('service'); setUniversityId(''); setProgramId(''); setConversionInfo('');}}>
                            <Ionicons name="airplane" size={18} color={dealType === 'service' ? "#fff" : "#64748B"} style={{marginRight: 6}} />
                            <Text style={[styles.typeChipText, dealType === 'service' && {color: '#fff'}]}>Доп. Услуга</Text>
                        </TouchableOpacity>
                    </View>

                    {/* --- РЕЖИМ: ПОСТУПЛЕНИЕ В ВУЗ --- */}
                    {dealType === 'university' && (
                        <>
                            <Text style={styles.label}>Страна ВУЗа</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:15}}>
                                <TouchableOpacity style={[styles.modalChip, selectedCountry === '' && styles.modalChipActive]} onPress={() => {setSelectedCountry(''); setUniversityId(''); setProgramId(''); setConversionInfo('');}}>
                                    <Text style={[styles.modalChipText, selectedCountry === '' && {color:'#FFF'}]}>Все</Text>
                                </TouchableOpacity>
                                {uniqueCountries.map(c => (
                                    <TouchableOpacity key={c as string} style={[styles.modalChip, selectedCountry === c && styles.modalChipActive]} onPress={() => {setSelectedCountry(c as string); setUniversityId(''); setProgramId(''); setConversionInfo('');}}>
                                        <Text style={[styles.modalChipText, selectedCountry === c && {color:'#FFF'}]}>{c as string}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            
                            <Text style={styles.label}>Университет *</Text>
                            <View style={styles.searchBox}>
                                <Ionicons name="search" size={18} color="#64748B" style={{marginRight: 8}} />
                                <TextInput style={styles.searchInputInner} placeholder="Название ВУЗа..." placeholderTextColor="#94A3B8" value={uniSearch} onChangeText={setUniSearch} />
                            </View>
                            <ScrollView style={styles.verticalList} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
                                {filteredUnis.map(u => (
                                    <TouchableOpacity key={u.id} style={[styles.listItem, universityId === u.id && styles.listItemSelected]} onPress={() => { setUniversityId(u.id); setProgramId(''); setProgSearch(''); setConversionInfo(''); Keyboard.dismiss(); }}>
                                        <View style={{flex: 1}}>
                                            <Text style={[styles.listItemText, universityId === u.id && styles.listItemTextSelected]}>{u.name}</Text>
                                            <Text style={styles.listItemSubText}>{u.city}, {u.country}</Text>
                                        </View>
                                        {universityId === u.id && <Ionicons name="checkmark-circle" size={20} color="#0D416D" />}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            
                            {universityId !== '' && (
                                <>
                                    <Text style={styles.label}>Программа *</Text>
                                    <View style={styles.searchBox}>
                                        <Ionicons name="search" size={18} color="#64748B" style={{marginRight: 8}} />
                                        <TextInput style={styles.searchInputInner} placeholder="Поиск программы..." placeholderTextColor="#94A3B8" value={progSearch} onChangeText={setProgSearch} />
                                    </View>
                                    <ScrollView style={styles.verticalList} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
                                        {availablePrograms.map((p: any) => (
                                            <TouchableOpacity key={p.id} style={[styles.listItem, programId === p.id && styles.listItemSelected]} onPress={() => handleProgramSelect(p)}>
                                                <View style={{flex: 1}}>
                                                    <Text style={[styles.listItemText, programId === p.id && styles.listItemTextSelected]}>{p.name}</Text>
                                                    <Text style={styles.listItemSubText}>{p.degree} | Длит: {p.duration}</Text>
                                                </View>
                                                {programId === p.id && <Ionicons name="checkmark-circle" size={20} color="#0D416D" />}
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </>
                            )}
                        </>
                    )}

                    {/* --- РЕЖИМ: РУЧНАЯ УСЛУГА --- */}
                    {dealType === 'service' && (
                        <>
                            <Text style={styles.label}>Название услуги *</Text>
                            <TextInput style={styles.input} placeholder="Например: Оформление визы" placeholderTextColor="#94A3B8" value={customServiceName} onChangeText={setCustomServiceName} />

                            <Text style={styles.label}>Описание действий</Text>
                            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline placeholder="Собрать документы..." placeholderTextColor="#94A3B8" value={customServiceDesc} onChangeText={setCustomServiceDesc} />
                        </>
                    )}

                    {/* --- ИТОГОВЫЕ ФИНАНСЫ --- */}
                    <Text style={styles.sectionSubTitle}>Итоговые Финансы (USD)</Text>
                    
                    {/* КРАСИВАЯ РАСШИФРОВКА КОНВЕРТАЦИИ */}
                    {conversionInfo !== '' && dealType === 'university' && (
                        <View style={styles.infoBox}>
                            <Ionicons name="information-circle-outline" size={18} color="#0D416D" style={{marginRight: 8}} />
                            <Text style={styles.infoBoxText}>{conversionInfo}</Text>
                        </View>
                    )}

                    <View style={styles.rowInputs}>
                        <View style={{flex: 1, marginRight: 10}}>
                            <Text style={styles.label}>К оплате клиентом *</Text>
                            <View style={styles.searchBox}>
                                <Text style={{color: '#64748B', fontWeight: '900', marginRight: 5, fontSize: 16}}>$</Text>
                                <TextInput style={styles.searchInputInner} keyboardType="numeric" placeholder="0.00" placeholderTextColor="#94A3B8" value={priceClient} onChangeText={setPriceClient} />
                            </View>
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={styles.label}>Прибыль фирмы</Text>
                            <View style={styles.searchBox}>
                                <Text style={{color: '#10b981', fontWeight: '900', marginRight: 5, fontSize: 16}}>$</Text>
                                <TextInput style={styles.searchInputInner} keyboardType="numeric" placeholder="0.00" placeholderTextColor="#94A3B8" value={expectedRevenue} onChangeText={setExpectedRevenue} />
                            </View>
                        </View>
                    </View>
                    
                    <TouchableOpacity style={styles.submitBtn} onPress={submitForm} disabled={submitLoading}>
                        {submitLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Оформить сделку</Text>}
                    </TouchableOpacity>
                </BlurView>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 10 },
    backBtn: { padding: 10, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
    title: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
    container: { padding: 20, paddingBottom: 100 },
    
    glassCard: { padding: 24, borderRadius: 32, backgroundColor: 'rgba(255, 255, 255, 0.6)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.9)', overflow: 'hidden' },
    sectionSubTitle: { color: '#0D416D', fontSize: 13, fontWeight: '900', marginBottom: 15, marginTop: 10, textTransform: 'uppercase', letterSpacing: 1 },
    label: { fontSize: 11, fontWeight: '900', color: '#475569', marginBottom: 8, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    
    input: { backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: 16, padding: 16, fontSize: 15, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20, color: '#1E293B', fontWeight: '700' },
    inputReadOnly: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(13, 65, 109, 0.05)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(13, 65, 109, 0.1)', marginBottom: 20 },
    
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 14, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
    searchInputInner: { flex: 1, color: '#1E293B', fontSize: 16, fontWeight: '800', outlineStyle: 'none' },
    
    verticalList: { maxHeight: 200, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 5, marginBottom: 20 },
    listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 10, marginBottom: 2 },
    listItemSelected: { backgroundColor: 'rgba(13, 65, 109, 0.1)' },
    listItemText: { color: '#1E293B', fontSize: 14, fontWeight: '700' },
    listItemTextSelected: { color: '#0D416D', fontWeight: '900' },
    listItemSubText: { color: '#64748B', fontSize: 11, marginTop: 4, fontWeight: '600' },

    rowInputs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    typeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.8)', paddingVertical: 12, borderRadius: 14, marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    typeChipActive: { backgroundColor: '#0D416D', borderColor: '#0D416D' },
    typeChipText: { color: '#64748B', fontWeight: '800', fontSize: 13 },
    
    modalChip: { backgroundColor: 'rgba(255, 255, 255, 0.8)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', marginRight: 10 },
    modalChipActive: { backgroundColor: '#0D416D', borderColor: '#0D416D' },
    modalChipText: { fontSize: 13, fontWeight: '800', color: '#475569' },
    
    infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 12, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.2)' },
    infoBoxText: { flex: 1, color: '#0D416D', fontSize: 12, fontWeight: '700' },

    submitBtn: { backgroundColor: '#0D416D', padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 10, shadowColor: '#0D416D', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5 },
    submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }
});