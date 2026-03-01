// app/(app)/add-client.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';

export default function AddClientScreen() {
    const router = useRouter();
    const [submitLoading, setSubmitLoading] = useState(false);
    const [formClient, setFormClient] = useState({ 
        full_name: '', phone: '', email: '', dob: '', city: '', citizenship: 'Туркменистан',
        passport_local_num: '', passport_inter_num: '', passport_issued_by: '', 
        passport_issued_date: '', address_registration: ''
    });

    const submitForm = async () => {
        // Проверка обязательных полей (включая город, так как на бэкенде он обязателен)
        if (!formClient.full_name || !formClient.phone || !formClient.city) {
            Alert.alert('Ошибка', 'Заполните обязательные поля: ФИО, Телефон и Город');
            return;
        }

        setSubmitLoading(true);
        try {
            const payload: any = { ...formClient };
            
            // Очищаем пустые поля, чтобы Django не выдавал 400 Bad Request
            if (!payload.dob) payload.dob = null;
            if (!payload.passport_issued_date) payload.passport_issued_date = null;
            if (!payload.email) payload.email = null;

            await apiClient.post('clients/', payload);
            
            Alert.alert('Успех', 'Клиент успешно добавлен', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error: any) {
            console.log("Validation Error:", error.response?.data);
            const serverError = error.response?.data;
            let errorMsg = 'Проверьте введенные данные';
            
            // Парсим красивый вывод ошибки от Django
            if (serverError && typeof serverError === 'object') {
                errorMsg = Object.entries(serverError)
                    .map(([key, msgs]) => `${key}: ${msgs}`)
                    .join('\n');
            }

            Alert.alert('Ошибка (400)', errorMsg);
        } finally {
            setSubmitLoading(false);
        }
    };

    return (
        <ScreenWrapper>
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient colors={['#F1F5F9', '#E2E8F0']} style={StyleSheet.absoluteFillObject} />
            </View>

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.title}>Новый клиент</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <BlurView intensity={40} tint="light" style={styles.glassCard}>
                    <Text style={styles.label}>ФИО Абитуриента *</Text>
                    <TextInput style={styles.input} value={formClient.full_name} onChangeText={v => setFormClient({...formClient, full_name:v})} placeholder="Иванов Иван Иванович" placeholderTextColor="#94A3B8" />
                    
                    <View style={styles.row}>
                        <View style={{flex:1, marginRight:10}}>
                            <Text style={styles.label}>Телефон *</Text>
                            <TextInput style={styles.input} keyboardType="phone-pad" value={formClient.phone} onChangeText={v => setFormClient({...formClient, phone:v})} placeholder="+993..." placeholderTextColor="#94A3B8" />
                        </View>
                        <View style={{flex:1}}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput style={styles.input} keyboardType="email-address" value={formClient.email} onChangeText={v => setFormClient({...formClient, email:v})} placeholder="mail@example.com" placeholderTextColor="#94A3B8" autoCapitalize="none" />
                        </View>
                    </View>
                    
                    <View style={styles.row}>
                        <View style={{flex:1, marginRight:10}}>
                            <Text style={styles.label}>Город *</Text>
                            <TextInput style={styles.input} value={formClient.city} onChangeText={v => setFormClient({...formClient, city:v})} placeholder="Ашхабад" placeholderTextColor="#94A3B8" />
                        </View>
                        <View style={{flex:1}}>
                            <Text style={styles.label}>Дата рожд.</Text>
                            <TextInput style={styles.input} value={formClient.dob} onChangeText={v => setFormClient({...formClient, dob:v})} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />
                        </View>
                    </View>

                    <Text style={styles.label}>Гражданство</Text>
                    <TextInput style={styles.input} value={formClient.citizenship} onChangeText={v => setFormClient({...formClient, citizenship:v})} placeholder="Туркменистан" placeholderTextColor="#94A3B8" />
                    
                    <Text style={styles.label}>Паспортные данные</Text>
                    <View style={styles.row}>
                        <TextInput style={[styles.input, {flex:1, marginRight:10}]} value={formClient.passport_local_num} onChangeText={v => setFormClient({...formClient, passport_local_num:v})} placeholder="Внутренний" placeholderTextColor="#94A3B8" />
                        <TextInput style={[styles.input, {flex:1}]} value={formClient.passport_inter_num} onChangeText={v => setFormClient({...formClient, passport_inter_num:v})} placeholder="Загранпаспорт" placeholderTextColor="#94A3B8" />
                    </View>
                    <View style={styles.row}>
                        <TextInput style={[styles.input, {flex:1, marginRight:10}]} value={formClient.passport_issued_by} onChangeText={v => setFormClient({...formClient, passport_issued_by:v})} placeholder="Кем выдан" placeholderTextColor="#94A3B8" />
                        <TextInput style={[styles.input, {flex:1}]} value={formClient.passport_issued_date} onChangeText={v => setFormClient({...formClient, passport_issued_date:v})} placeholder="Дата (YYYY-MM-DD)" placeholderTextColor="#94A3B8" />
                    </View>
                    
                    <Text style={styles.label}>Адрес регистрации</Text>
                    <TextInput style={[styles.input, {height:80}]} multiline value={formClient.address_registration} onChangeText={v => setFormClient({...formClient, address_registration:v})} placeholder="Полный адрес прописки..." placeholderTextColor="#94A3B8" />
                    
                    <TouchableOpacity style={styles.submitBtn} onPress={submitForm} disabled={submitLoading}>
                        {submitLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Сохранить</Text>}
                    </TouchableOpacity>
                </BlurView>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 10 },
    backBtn: { padding: 10, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
    title: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
    container: { padding: 20, paddingBottom: 100 },
    glassCard: { padding: 24, borderRadius: 32, backgroundColor: 'rgba(255, 255, 255, 0.4)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.7)', overflow: 'hidden' },
    label: { fontSize: 11, fontWeight: '900', color: '#475569', marginBottom: 8, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { backgroundColor: 'rgba(255, 255, 255, 0.6)', borderRadius: 16, padding: 16, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.9)', marginBottom: 20, color: '#1E293B', fontWeight: '700' },
    row: { flexDirection: 'row' },
    submitBtn: { backgroundColor: '#0D416D', padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 10, shadowColor: '#0D416D', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 5 },
    submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }
});