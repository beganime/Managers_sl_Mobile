// app/(app)/payment/create.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../../../components/ScreenWrapper';
import apiClient from '../../../src/api/apiClient';
import { getToken, saveToken } from '../../../src/utils/storage';

export default function CreatePaymentScreen() {
    const { dealId } = useLocalSearchParams();
    const router = useRouter();
    
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('cash'); 
    
    // Стейты для валют
    const [currencies, setCurrencies] = useState<any[]>([]);
    const [selectedCurrency, setSelectedCurrency] = useState<number | string>('');
    
    const [loading, setLoading] = useState(true);
    const [submitLoading, setSubmitLoading] = useState(false);

    // Подгружаем валюты при открытии экрана
    useEffect(() => {
        const fetchCurrencies = async () => {
            try {
                // ИСПРАВЛЕНИЕ: Убрали начальный слеш, чтобы Axios склеил путь корректно
                const res = await apiClient.get('catalog/currencies/');
                const data = res.data.results || res.data;
                setCurrencies(data);
                
                // Автоматически выбираем первую валюту из списка
                if (data.length > 0) {
                    setSelectedCurrency(data[0].id);
                }
            } catch (error) {
                console.error("Ошибка загрузки валют", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCurrencies();
    }, []);

    const handleSubmit = async () => {
        if (!amount || isNaN(Number(amount))) {
            Alert.alert("Ошибка", "Введите корректную сумму (число)");
            return;
        }

        if (!selectedCurrency) {
            Alert.alert("Ошибка", "Выберите валюту платежа");
            return;
        }

        // Формируем payload. Отправляем net_income_usd = 0, бэкенд в методе save() сам пересчитает прибыль!
        const payload = {
            deal: dealId,
            amount: parseFloat(amount),
            method: method,
            currency: selectedCurrency,
            net_income_usd: 0 
        };

        setSubmitLoading(true);
        try {
            // Если сделка создана в офлайне (temp_...), сервер ее еще не знает
            if (dealId && dealId.toString().startsWith('temp_')) {
                throw new Error("offline_deal");
            }
            
            await apiClient.post('analytics/payments/', payload);
            Alert.alert("Успешно", "Платеж отправлен администратору на проверку!", [
                { text: 'OK', onPress: () => router.replace('/crm') }
            ]);
        } catch (error: any) {
            console.log("Payment Error:", error.response?.data || error.message);
            
            // Если ошибка от сервера (например 400 Bad Request) - показываем детально
            if (error.response?.data) {
                const serverError = error.response.data;
                let errorMsg = 'Проверьте данные платежа';
                if (typeof serverError === 'object') {
                    errorMsg = Object.entries(serverError)
                        .map(([key, msgs]) => `${key.toUpperCase()}: ${msgs}`)
                        .join('\n');
                }
                Alert.alert("Ошибка сервера (400)", errorMsg);
            } else {
                // ОФФЛАЙН СОХРАНЕНИЕ ПЛАТЕЖА (если нет сети)
                const offlinePayments = JSON.parse(await getToken('offline_payments') || '[]');
                offlinePayments.push({...payload, id: `temp_${Date.now()}`, isOffline: true, is_confirmed: false});
                await saveToken('offline_payments', JSON.stringify(offlinePayments));
                
                Alert.alert("Нет сети", "Платеж сохранен в очередь на телефоне. Нажмите 'Синхронизировать базу' при появлении интернета.", [
                    { text: 'OK', onPress: () => router.replace('/crm') }
                ]);
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
                <Text style={styles.headerTitle}>Новый платёж</Text>
                <View style={{width: 40}} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
                <BlurView intensity={40} tint="light" style={styles.glassCard}>
                    
                    <Text style={styles.label}>Сделка ID</Text>
                    <View style={styles.inputReadOnly}>
                        <Ionicons name="briefcase" size={18} color="#0D416D" style={{marginRight: 10}} />
                        <Text style={{color: '#0F172A', fontSize: 16, fontWeight: 'bold'}}>#{dealId}</Text>
                    </View>

                    {/* ВЫБОР ВАЛЮТЫ */}
                    <Text style={styles.label}>Валюта платежа *</Text>
                    {currencies.length === 0 ? (
                        <ActivityIndicator size="small" color="#0D416D" style={{alignItems: 'flex-start', marginBottom: 15}} />
                    ) : (
                        <ScrollView horizontal style={styles.chipScroll} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            {currencies.map(c => (
                                <TouchableOpacity 
                                    key={c.id} 
                                    style={[styles.chip, selectedCurrency === c.id && styles.chipActive]} 
                                    onPress={() => setSelectedCurrency(c.id)}
                                >
                                    <Text style={[styles.chipText, selectedCurrency === c.id && {color: '#FFF'}]}>
                                        {c.code} {c.symbol ? `(${c.symbol})` : ''}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    <Text style={styles.label}>Сумма платежа *</Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="cash" size={20} color="#64748B" />
                        <TextInput 
                            style={styles.input}
                            placeholder="Например: 500"
                            placeholderTextColor="#94A3B8"
                            keyboardType="numeric"
                            value={amount}
                            onChangeText={setAmount}
                        />
                    </View>

                    <Text style={[styles.label, { marginTop: 10 }]}>Способ оплаты</Text>
                    <View style={styles.methodRow}>
                        <TouchableOpacity style={[styles.methodBtn, method === 'cash' && styles.methodBtnActive]} onPress={() => setMethod('cash')}>
                            <Ionicons name="wallet-outline" size={18} color={method === 'cash' ? '#FFF' : '#64748B'} style={{marginBottom: 4}} />
                            <Text style={[styles.methodText, method === 'cash' && styles.methodTextActive]}>Наличные</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.methodBtn, method === 'card' && styles.methodBtnActive]} onPress={() => setMethod('card')}>
                            <Ionicons name="card-outline" size={18} color={method === 'card' ? '#FFF' : '#64748B'} style={{marginBottom: 4}} />
                            <Text style={[styles.methodText, method === 'card' && styles.methodTextActive]}>Карта</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.methodBtn, method === 'bank' && styles.methodBtnActive]} onPress={() => setMethod('bank')}>
                            <Ionicons name="business-outline" size={18} color={method === 'bank' ? '#FFF' : '#64748B'} style={{marginBottom: 4}} />
                            <Text style={[styles.methodText, method === 'bank' && styles.methodTextActive]}>Перевод</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitLoading}>
                        {submitLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Оформить платёж</Text>}
                    </TouchableOpacity>
                    
                    <Text style={styles.hint}>
                        <Ionicons name="information-circle" size={14} color="#64748B" /> Платёж зачислится в Ваш план только после подтверждения администрацией.
                    </Text>
                </BlurView>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 10 },
    backBtn: { padding: 10, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
    container: { padding: 20, paddingBottom: 100 },
    
    glassCard: { padding: 25, borderRadius: 32, backgroundColor: 'rgba(255, 255, 255, 0.6)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.9)', overflow: 'hidden' },
    label: { color: '#475569', fontSize: 11, marginBottom: 8, marginLeft: 6, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
    
    inputReadOnly: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(13, 65, 109, 0.05)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(13, 65, 109, 0.1)', marginBottom: 20 },
    
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 16, paddingHorizontal: 15, height: 55, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
    input: { flex: 1, color: '#1E293B', fontSize: 16, fontWeight: '700', marginLeft: 10, outlineStyle: 'none' },
    
    chipScroll: { marginBottom: 20, maxHeight: 50 },
    chip: { backgroundColor: 'rgba(255, 255, 255, 0.8)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    chipActive: { backgroundColor: '#0D416D', borderColor: '#0D416D' },
    chipText: { color: '#475569', fontWeight: '800', fontSize: 13 },
    
    methodRow: { flexDirection: 'row', gap: 10, marginBottom: 25 },
    methodBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.8)', borderWidth: 1, borderColor: '#E2E8F0' },
    methodBtnActive: { backgroundColor: '#0D416D', borderColor: '#0D416D', shadowColor: '#0D416D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 },
    methodText: { color: '#64748B', fontWeight: '800', fontSize: 12 },
    methodTextActive: { color: '#FFF' },
    
    submitBtn: { backgroundColor: '#10b981', padding: 20, borderRadius: 20, alignItems: 'center', shadowColor: '#10b981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
    
    hint: { color: '#64748B', fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 18, fontWeight: '600' }
});