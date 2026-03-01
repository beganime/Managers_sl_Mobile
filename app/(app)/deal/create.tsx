// app/(app)/deal/create.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../../../components/ScreenWrapper';
import apiClient from '../../../src/api/apiClient';
import { getToken, saveToken } from '../../../src/utils/storage';

export default function CreateDealScreen() {
    const { clientId, clientName } = useLocalSearchParams();
    const router = useRouter();
    
    // --- ОСНОВНЫЕ ПОЛЯ СДЕЛКИ ---
    const [dealType, setDealType] = useState<'university' | 'service'>('university');
    const [priceClient, setPriceClient] = useState('');
    const [expectedRevenue, setExpectedRevenue] = useState('');
    
    // --- ПОЛЯ ДЛЯ "ВУЗ" ---
    const [selectedCountry, setSelectedCountry] = useState('');
    const [uniSearch, setUniSearch] = useState('');
    const [progSearch, setProgSearch] = useState('');
    const [universityId, setUniversityId] = useState<number | string>('');
    const [programId, setProgramId] = useState<number | string>('');
    
    // --- ПОЛЯ ДЛЯ "ДОП. УСЛУГА" ---
    const [customServiceName, setCustomServiceName] = useState('');
    const [customServiceDesc, setCustomServiceDesc] = useState('');

    const [loading, setLoading] = useState(false);
    const [universitiesList, setUniversitiesList] = useState<any[]>([]);

    useEffect(() => {
        const loadUnis = async () => {
            try {
                const res = await apiClient.get('/catalog/universities/');
                const data = res.data.results || res.data;
                setUniversitiesList(data);
                await saveToken('cache_universities', JSON.stringify(data));
            } catch (e) {
                const cached = await getToken('cache_universities');
                if (cached) setUniversitiesList(JSON.parse(cached));
            }
        };
        loadUnis();
    }, []);

    // Логика фильтрации списков
    const uniqueCountries = Array.from(new Set(universitiesList.map(u => u.country))).filter(Boolean);
    
    const filteredUnis = universitiesList
        .filter(u => selectedCountry === '' ? true : u.country === selectedCountry)
        .filter(u => u.name?.toLowerCase().includes(uniSearch.toLowerCase()));

    const selectedUniObj = universitiesList.find(u => u.id === universityId);
    const availablePrograms = selectedUniObj?.programs 
        ? selectedUniObj.programs.filter((p: any) => p.name?.toLowerCase().includes(progSearch.toLowerCase())) 
        : [];

    const handleSubmit = async () => {
        // Базовые проверки
        if (!priceClient || isNaN(Number(priceClient))) {
            Alert.alert("Ошибка", "Введите корректную 'Цену для клиента' (число)");
            return;
        }

        if (dealType === 'university' && (!universityId || !programId)) {
            Alert.alert("Ошибка", "Обязательно выберите ВУЗ и программу");
            return;
        }

        if (dealType === 'service' && !customServiceName.trim()) {
            Alert.alert("Ошибка", "Введите название доп. услуги");
            return;
        }

        // Строго по полям модели Deal из бэкенда
        const payload: any = {
            client: clientId,
            deal_type: dealType,
            currency: 1, // 1 = USD (замени на ID нужной валюты, если в БД иначе)
            price_client: parseFloat(priceClient),
            expected_revenue_usd: expectedRevenue ? parseFloat(expectedRevenue) : 0,
        };

        if (dealType === 'university') {
            payload.university = universityId;
            payload.program = programId;
            payload.custom_service_name = '';
            payload.custom_service_desc = '';
        } else {
            payload.university = null;
            payload.program = null;
            payload.custom_service_name = customServiceName;
            payload.custom_service_desc = customServiceDesc;
        }

        setLoading(true);
        try {
            if (clientId && clientId.toString().startsWith('temp_')) {
                throw new Error("offline_client_detected");
            }

            await apiClient.post('/analytics/deals/', payload);
            Alert.alert("Успешно", "Сделка успешно создана!");
            router.replace('/crm');
        } catch (error: any) {
            console.log("Submit Error", error.response?.data || error.message);
            // ОФФЛАЙН СОХРАНЕНИЕ
            const offlineDeals = JSON.parse(await getToken('offline_deals') || '[]');
            offlineDeals.push({
                ...payload, 
                id: `temp_${Date.now()}`, 
                client_name: clientName,
                payment_status: 'new',
                isOffline: true
            });
            await saveToken('offline_deals', JSON.stringify(offlineDeals));
            Alert.alert("Нет сети", "Сделка сохранена локально. Нажмите 'Синхронизировать' при появлении интернета.");
            router.replace('/crm');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/crm')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Оформление сделки</Text>
                <View style={{width: 40}} />
            </View>

            {/* keyboardShouldPersistTaps="handled" ИСПРАВЛЯЕТ БАГ С КЛИКАМИ ПО СПИСКУ ПРИ ОТКРЫТОЙ КЛАВИАТУРЕ */}
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <BlurView intensity={40} tint="dark" style={styles.formCard}>
                    
                    <Text style={styles.label}>Студент / Клиент</Text>
                    <View style={styles.inputReadOnly}>
                        <Ionicons name="person" size={18} color="#60a5fa" style={{marginRight: 10}} />
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{clientName}</Text>
                    </View>

                    <Text style={styles.label}>Тип сделки</Text>
                    <View style={styles.rowInputs}>
                        <TouchableOpacity style={[styles.chip, dealType === 'university' && styles.chipActive]} onPress={() => setDealType('university')}>
                            <Ionicons name="school" size={16} color={dealType === 'university' ? "#fff" : "rgba(255,255,255,0.6)"} style={{marginRight: 6}} />
                            <Text style={[styles.chipText, dealType === 'university' && {color: '#fff'}]}>Поступление в ВУЗ</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.chip, dealType === 'service' && styles.chipActive]} onPress={() => {setDealType('service'); setUniversityId(''); setProgramId('');}}>
                            <Ionicons name="airplane" size={16} color={dealType === 'service' ? "#fff" : "rgba(255,255,255,0.6)"} style={{marginRight: 6}} />
                            <Text style={[styles.chipText, dealType === 'service' && {color: '#fff'}]}>Доп. Услуга</Text>
                        </TouchableOpacity>
                    </View>

                    {/* ==================================================== */}
                    {/* РЕЖИМ 1: ПОСТУПЛЕНИЕ В ВУЗ                           */}
                    {/* ==================================================== */}
                    {dealType === 'university' && (
                        <>
                            <Text style={styles.label}>Фильтр по стране</Text>
                            <ScrollView horizontal style={styles.chipScroll} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                <TouchableOpacity style={[styles.chip, selectedCountry === '' && styles.chipActive]} onPress={() => {setSelectedCountry(''); setUniversityId(''); setProgramId('');}}>
                                    <Text style={[styles.chipText, selectedCountry === '' && {color: '#fff'}]}>Все страны</Text>
                                </TouchableOpacity>
                                {uniqueCountries.map((country: string) => (
                                    <TouchableOpacity key={country} style={[styles.chip, selectedCountry === country && styles.chipActive]} onPress={() => {setSelectedCountry(country); setUniversityId(''); setProgramId('');}}>
                                        <Text style={[styles.chipText, selectedCountry === country && {color: '#fff'}]}>{country}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <View style={styles.fieldContainer}>
                                <Text style={styles.label}>Университет *</Text>
                                <View style={styles.searchBox}>
                                    <Ionicons name="search" size={18} color="#888" style={{marginRight: 8}} />
                                    <TextInput 
                                        style={styles.searchInputInner} 
                                        placeholder="Название ВУЗа..." 
                                        placeholderTextColor="#666" 
                                        value={uniSearch} 
                                        onChangeText={setUniSearch} 
                                    />
                                    {uniSearch.length > 0 && (
                                        <TouchableOpacity onPress={() => setUniSearch('')}>
                                            <Ionicons name="close-circle" size={18} color="#666" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                                
                                {filteredUnis.length > 0 ? (
                                    <ScrollView style={styles.verticalList} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
                                        {filteredUnis.map(u => (
                                            <TouchableOpacity 
                                                key={u.id} 
                                                style={[styles.listItem, universityId === u.id && styles.listItemSelected]} 
                                                onPress={() => {
                                                    setUniversityId(u.id); 
                                                    setProgramId(''); 
                                                    setProgSearch('');
                                                    Keyboard.dismiss(); // Прячем клаву при клике
                                                }}
                                            >
                                                <View style={{flex: 1}}>
                                                    <Text style={[styles.listItemText, universityId === u.id && styles.listItemTextSelected]}>{u.name}</Text>
                                                    <Text style={styles.listItemSubText}>{u.city}, {u.country}</Text>
                                                </View>
                                                {universityId === u.id && <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />}
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                ) : (
                                    <Text style={styles.noResultsText}>Ничего не найдено</Text>
                                )}
                            </View>

                            {universityId !== '' && (
                                <View style={styles.fieldContainer}>
                                    <Text style={styles.label}>Программа обучения *</Text>
                                    <View style={styles.searchBox}>
                                        <Ionicons name="search" size={18} color="#888" style={{marginRight: 8}} />
                                        <TextInput 
                                            style={styles.searchInputInner} 
                                            placeholder="Название программы..." 
                                            placeholderTextColor="#666" 
                                            value={progSearch} 
                                            onChangeText={setProgSearch} 
                                        />
                                        {progSearch.length > 0 && <TouchableOpacity onPress={() => setProgSearch('')}><Ionicons name="close-circle" size={18} color="#666" /></TouchableOpacity>}
                                    </View>
                                    
                                    {availablePrograms.length > 0 ? (
                                        <ScrollView style={styles.verticalList} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
                                            {availablePrograms.map((p: any) => (
                                                <TouchableOpacity 
                                                    key={p.id} 
                                                    style={[styles.listItem, programId === p.id && styles.listItemSelected]} 
                                                    onPress={() => {
                                                        setProgramId(p.id);
                                                        // АВТОПОДСТАНОВКА ЦЕН
                                                        setPriceClient(p.tuition_fee?.toString() || '');
                                                        setExpectedRevenue(p.service_fee?.toString() || '');
                                                        Keyboard.dismiss();
                                                    }}
                                                >
                                                    <View style={{flex: 1}}>
                                                        <Text style={[styles.listItemText, programId === p.id && styles.listItemTextSelected]}>{p.name}</Text>
                                                        <Text style={styles.listItemSubText}>{p.degree} | Длит: {p.duration}</Text>
                                                    </View>
                                                    {programId === p.id && <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />}
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    ) : (
                                        <Text style={styles.noResultsText}>У ВУЗа нет доступных программ</Text>
                                    )}
                                </View>
                            )}
                        </>
                    )}

                    {/* ==================================================== */}
                    {/* РЕЖИМ 2: ДОП УСЛУГА (Ручной ввод)                    */}
                    {/* ==================================================== */}
                    {dealType === 'service' && (
                        <>
                            <Text style={styles.label}>Название услуги *</Text>
                            <TextInput 
                                style={styles.input} 
                                placeholder="Например: Оформление визы" 
                                placeholderTextColor="#666" 
                                value={customServiceName} 
                                onChangeText={setCustomServiceName} 
                            />

                            <Text style={styles.label}>Описание действий (Необязательно)</Text>
                            <TextInput 
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
                                multiline
                                placeholder="Собрать документы, подать в посольство..." 
                                placeholderTextColor="#666" 
                                value={customServiceDesc} 
                                onChangeText={setCustomServiceDesc} 
                            />
                        </>
                    )}

                    {/* ==================================================== */}
                    {/* ОБЩИЙ БЛОК: ФИНАНСЫ                                  */}
                    {/* ==================================================== */}
                    <Text style={[styles.sectionSubTitle, {marginTop: 10}]}>Финансы сделки</Text>
                    <View style={styles.rowInputs}>
                        <View style={{flex: 1, marginRight: 10}}>
                            <Text style={styles.label}>Сумма для клиента *</Text>
                            <View style={styles.searchBox}>
                                <Ionicons name="cash" size={18} color="#888" style={{marginRight: 8}} />
                                <TextInput style={styles.searchInputInner} keyboardType="numeric" placeholder="0.00" placeholderTextColor="#666" value={priceClient} onChangeText={setPriceClient} />
                            </View>
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={styles.label}>Ожидаемый доход</Text>
                            <View style={styles.searchBox}>
                                <Ionicons name="trending-up" size={18} color="#10b981" style={{marginRight: 8}} />
                                <TextInput style={styles.searchInputInner} keyboardType="numeric" placeholder="0.00" placeholderTextColor="#666" value={expectedRevenue} onChangeText={setExpectedRevenue} />
                            </View>
                        </View>
                    </View>
                    <Text style={styles.hintText}>* Суммы указываются в базовой валюте (USD)</Text>

                    <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Создать сделку</Text>}
                    </TouchableOpacity>
                    <View style={{height: 50}} />
                </BlurView>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    
    formCard: { padding: 25, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.2)' },
    sectionSubTitle: { color: '#60a5fa', fontSize: 13, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
    label: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 8, fontWeight: '600', textTransform: 'uppercase' },
    
    input: { backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', borderRadius: 16, padding: 15, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 15 },
    inputReadOnly: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)', marginBottom: 20 },
    hintText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontStyle: 'italic', marginBottom: 15, textAlign: 'right' },
    
    // Поисковые блоки и списки
    fieldContainer: { marginBottom: 20 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 10 },
    searchInputInner: { flex: 1, color: '#fff', fontSize: 15, outlineStyle: 'none' },
    
    verticalList: { maxHeight: 220, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 5 },
    listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 8, marginBottom: 2 },
    listItemSelected: { backgroundColor: 'rgba(59, 130, 246, 0.2)' },
    listItemText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500' },
    listItemTextSelected: { color: '#fff', fontWeight: 'bold' },
    listItemSubText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 },
    noResultsText: { color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', textAlign: 'center', paddingVertical: 15 },

    rowInputs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    chipScroll: { marginBottom: 15, maxHeight: 50 },
    chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    chipActive: { backgroundColor: '#3b82f6', borderColor: '#60a5fa' },
    chipText: { color: 'rgba(255,255,255,0.6)', fontWeight: 'bold', fontSize: 13 },
    
    submitBtn: { backgroundColor: '#10b981', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});