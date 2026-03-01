// app/(app)/payment/create.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
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
    
    const [loading, setLoading] = useState(false);

    // Подгружаем валюты при открытии экрана
    useEffect(() => {
        const fetchCurrencies = async () => {
            try {
                const res = await apiClient.get('/catalog/currencies/');
                const data = res.data.results || res.data;
                setCurrencies(data);
                
                // Автоматически выбираем первую валюту из списка (например, USD)
                if (data.length > 0) {
                    setSelectedCurrency(data[0].id);
                }
            } catch (error) {
                console.error("Ошибка загрузки валют", error);
            }
        };
        fetchCurrencies();
    }, []);

    const handleSubmit = async () => {
        if (!amount || isNaN(Number(amount))) {
            Alert.alert("Ошибка", "Введите корректную сумму");
            return;
        }

        if (!selectedCurrency) {
            Alert.alert("Ошибка", "Выберите валюту платежа");
            return;
        }

        // Формируем payload. Отправляем net_income_usd = 0, чтобы потом Админ вписал маржу
        const payload = {
            deal: dealId,
            amount: parseFloat(amount),
            method: method,
            currency: selectedCurrency,
            net_income_usd: 0 
        };

        setLoading(true);
        try {
            // Если сделка создана в офлайне, сервер ее не найдет. Сразу сохраняем платеж локально!
            if (dealId && dealId.toString().startsWith('temp_')) {
                throw new Error("offline_deal");
            }
            await apiClient.post('/analytics/payments/', payload);
            Alert.alert("Успешно", "Платеж отправлен администратору на проверку!");
            router.replace('/crm');
        } catch (error: any) {
            console.log("Payment Error:", error.response?.data || error.message);
            // ОФФЛАЙН СОХРАНЕНИЕ ПЛАТЕЖА
            const offlinePayments = JSON.parse(await getToken('offline_payments') || '[]');
            offlinePayments.push({...payload, id: `temp_${Date.now()}`, isOffline: true, is_confirmed: false});
            await saveToken('offline_payments', JSON.stringify(offlinePayments));
            Alert.alert("Нет сети (Офлайн)", "Платеж сохранен в очередь на телефоне. Нажмите 'Синхронизировать базу' позже.");
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
                <Text style={styles.headerTitle}>Новый платёж</Text>
                <View style={{width: 40}} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <BlurView intensity={40} tint="dark" style={styles.formCard}>
                    
                    <Text style={styles.label}>Сделка ID</Text>
                    <View style={styles.inputReadOnly}>
                        <Text style={{color: '#fff', fontSize: 16, fontWeight: 'bold'}}>{dealId}</Text>
                    </View>

                    {/* ВЫБОР ВАЛЮТЫ */}
                    <Text style={[styles.label, { marginTop: 10 }]}>Валюта платежа *</Text>
                    {currencies.length === 0 ? (
                        <ActivityIndicator size="small" color="#3b82f6" style={{alignItems: 'flex-start', marginBottom: 15}} />
                    ) : (
                        <ScrollView horizontal style={styles.chipScroll} showsHorizontalScrollIndicator={false}>
                            {currencies.map(c => (
                                <TouchableOpacity 
                                    key={c.id} 
                                    style={[styles.chip, selectedCurrency === c.id && styles.chipActive]} 
                                    onPress={() => setSelectedCurrency(c.id)}
                                >
                                    <Text style={[styles.chipText, selectedCurrency === c.id && {color: '#fff'}]}>
                                        {c.code} {c.symbol ? `(${c.symbol})` : ''}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    <Text style={styles.label}>Сумма платежа *</Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="cash-outline" size={20} color="rgba(255,255,255,0.5)" />
                        <TextInput 
                            style={styles.input}
                            placeholder="500"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            keyboardType="numeric"
                            value={amount}
                            onChangeText={setAmount}
                        />
                    </View>

                    <Text style={[styles.label, { marginTop: 20 }]}>Способ оплаты</Text>
                    <View style={styles.methodRow}>
                        <TouchableOpacity style={[styles.methodBtn, method === 'cash' && styles.methodBtnActive]} onPress={() => setMethod('cash')}>
                            <Text style={[styles.methodText, method === 'cash' && styles.methodTextActive]}>Наличные</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.methodBtn, method === 'card' && styles.methodBtnActive]} onPress={() => setMethod('card')}>
                            <Text style={[styles.methodText, method === 'card' && styles.methodTextActive]}>Карта</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.methodBtn, method === 'bank' && styles.methodBtnActive]} onPress={() => setMethod('bank')}>
                            <Text style={[styles.methodText, method === 'bank' && styles.methodTextActive]}>Перевод</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Оформить платёж</Text>}
                    </TouchableOpacity>
                    
                    <Text style={styles.hint}>* Платёж поступит в базу, но зачислится в Ваш план только после подтверждения администрацией.</Text>
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
    label: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 10, fontWeight: '600', textTransform: 'uppercase' },
    
    inputReadOnly: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 15 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, paddingHorizontal: 15, height: 55, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 15 },
    input: { flex: 1, color: '#fff', fontSize: 16, marginLeft: 10, outlineStyle: 'none' },
    
    chipScroll: { marginBottom: 20, maxHeight: 50 },
    chip: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    chipActive: { backgroundColor: '#3b82f6', borderColor: '#60a5fa' },
    chipText: { color: 'rgba(255,255,255,0.6)', fontWeight: 'bold', fontSize: 14 },
    
    methodRow: { flexDirection: 'row', gap: 10, marginBottom: 30 },
    methodBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    methodBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    methodText: { color: 'rgba(255,255,255,0.6)', fontWeight: 'bold' },
    methodTextActive: { color: '#fff' },
    
    submitBtn: { backgroundColor: '#10b981', padding: 16, borderRadius: 16, alignItems: 'center', shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    hint: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 18 }
});