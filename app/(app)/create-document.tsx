// app/(app)/create-document.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';

export default function CreateDocumentScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
    
    // Здесь будем хранить то, что вводит пользователь
    const [formData, setFormData] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                // Скачиваем доступные шаблоны (убрали начальный слеш)
                const res = await apiClient.get('documents/templates/');
                const data = res.data.results || res.data;
                setTemplates(data);
                
                // Автоматически выбираем первый шаблон, если он есть
                if (data.length > 0) {
                    handleSelectTemplate(data[0]);
                }
            } catch (error) {
                console.error("Ошибка загрузки шаблонов", error);
                Alert.alert("Ошибка", "Не удалось загрузить шаблоны. Проверьте интернет.");
            } finally {
                setLoading(false);
            }
        };
        fetchTemplates();
    }, []);

    // При выборе шаблона сбрасываем введенные данные
    const handleSelectTemplate = (tpl: any) => {
        setSelectedTemplate(tpl);
        setFormData({});
    };

    // Безопасный парсинг JSON-конфига полей
    const getFieldsConfig = () => {
        if (!selectedTemplate || !selectedTemplate.fields_config) return [];
        try {
            return typeof selectedTemplate.fields_config === 'string' 
                ? JSON.parse(selectedTemplate.fields_config) 
                : selectedTemplate.fields_config;
        } catch (e) {
            console.error("Ошибка парсинга fields_config", e);
            return [];
        }
    };

    const handleInputChange = (key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleGenerate = async () => {
        if (!selectedTemplate) return;

        setGenerating(true);
        try {
            // Отправляем ID шаблона и заполненные данные (context_data)
            const payload = {
                template: selectedTemplate.id,
                context_data: formData
            };

            const res = await apiClient.post('documents/generated/', payload);
            
            const fileUrl = res.data.file_url;

            Alert.alert(
                "Успешно! 🎉", 
                "Документ сгенерирован.",
                [
                    { text: "Вернуться в CRM", onPress: () => router.back() },
                    { 
                        text: "Скачать файл", 
                        onPress: () => {
                            if (fileUrl) {
                                Linking.openURL(fileUrl);
                            } else {
                                Alert.alert("Ошибка", "Файл еще не готов или произошла ошибка генерации.");
                            }
                            router.back();
                        },
                        style: "default" 
                    }
                ]
            );
        } catch (error: any) {
            console.error("Ошибка генерации:", error.response?.data || error.message);
            Alert.alert("Ошибка", "Не удалось сгенерировать документ.");
        } finally {
            setGenerating(false);
        }
    };

    if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color="#0D416D" /></View></ScreenWrapper>;

    const fields = getFieldsConfig();

    return (
        <ScreenWrapper>
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient colors={['#F1F5F9', '#E2E8F0']} style={StyleSheet.absoluteFillObject} />
            </View>

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.title}>Умный документ</Text>
                <View style={{ width: 44 }} />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    
                    <Text style={styles.sectionTitle}>1. Выберите шаблон</Text>
                    {templates.length === 0 ? (
                        <Text style={styles.emptyText}>Доступных шаблонов нет</Text>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templatesScroll}>
                            {templates.map(tpl => (
                                <TouchableOpacity 
                                    key={tpl.id} 
                                    style={[styles.templateChip, selectedTemplate?.id === tpl.id && styles.templateChipActive]}
                                    onPress={() => handleSelectTemplate(tpl)}
                                >
                                    <Ionicons 
                                        name={selectedTemplate?.id === tpl.id ? "document-text" : "document-text-outline"} 
                                        size={18} 
                                        color={selectedTemplate?.id === tpl.id ? "#FFF" : "#64748B"} 
                                        style={{marginRight: 6}}
                                    />
                                    <Text style={[styles.templateText, selectedTemplate?.id === tpl.id && styles.templateTextActive]}>
                                        {tpl.title}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {selectedTemplate && (
                        <>
                            <Text style={styles.sectionTitle}>2. Заполните данные</Text>
                            <BlurView intensity={50} tint="light" style={styles.formCard}>
                                {selectedTemplate.description ? (
                                    <Text style={styles.templateDesc}>{selectedTemplate.description}</Text>
                                ) : null}

                                {fields.length === 0 ? (
                                    <Text style={styles.emptyText}>Для этого шаблона не настроены динамические поля.</Text>
                                ) : (
                                    fields.map((field: any, index: number) => (
                                        <View key={index} style={styles.inputGroup}>
                                            <Text style={styles.label}>{field.label || field.key} *</Text>
                                            <View style={styles.inputWrapper}>
                                                <Ionicons 
                                                    name={field.type === 'date' ? "calendar" : field.type === 'numeric' ? "calculator" : "text"} 
                                                    size={18} 
                                                    color="#64748B" 
                                                    style={styles.inputIcon} 
                                                />
                                                <TextInput 
                                                    style={styles.input} 
                                                    placeholder={`Введите ${field.label?.toLowerCase() || 'значение'}`} 
                                                    placeholderTextColor="#94A3B8" 
                                                    value={formData[field.key] || ''} 
                                                    onChangeText={(val) => handleInputChange(field.key, val)}
                                                    keyboardType={field.type === 'numeric' ? 'numeric' : 'default'}
                                                />
                                            </View>
                                        </View>
                                    ))
                                )}

                                <TouchableOpacity 
                                    style={[styles.submitBtn, fields.length === 0 && { opacity: 0.5 }]} 
                                    onPress={handleGenerate} 
                                    disabled={generating || fields.length === 0}
                                >
                                    {generating ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <>
                                            <Ionicons name="color-wand" size={20} color="#FFF" style={{marginRight: 8}} />
                                            <Text style={styles.submitBtnText}>Сгенерировать файл</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </BlurView>
                            
                            <Text style={styles.hint}>
                                <Ionicons name="information-circle" size={14} color="#64748B" /> Данные будут подставлены в шаблон на сервере и вы получите готовый DOCX файл.
                            </Text>
                        </>
                    )}

                    <View style={{ height: 100 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
    backBtn: { width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
    title: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
    
    container: { padding: 20 },
    
    sectionTitle: { color: '#0D416D', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 5 },
    
    templatesScroll: { marginBottom: 25, maxHeight: 55 },
    templateChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.7)', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 16, marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    templateChipActive: { backgroundColor: '#0D416D', borderColor: '#0D416D', shadowColor: '#0D416D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 },
    templateText: { fontSize: 14, fontWeight: '800', color: '#475569' },
    templateTextActive: { color: '#FFF' },
    
    formCard: { padding: 24, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.9)', backgroundColor: 'rgba(255, 255, 255, 0.5)', overflow: 'hidden' },
    templateDesc: { color: '#475569', fontSize: 13, fontWeight: '600', fontStyle: 'italic', marginBottom: 20, backgroundColor: 'rgba(13, 65, 109, 0.05)', padding: 12, borderRadius: 12 },
    
    inputGroup: { marginBottom: 18 },
    label: { fontSize: 11, fontWeight: '900', color: '#475569', marginBottom: 8, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', height: 55, overflow: 'hidden' },
    inputIcon: { paddingLeft: 16, paddingRight: 8 },
    input: { flex: 1, height: '100%', fontSize: 15, fontWeight: '700', color: '#1E293B', outlineStyle: 'none' },
    
    submitBtn: { flexDirection: 'row', backgroundColor: '#8b5cf6', paddingVertical: 18, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#8b5cf6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
    submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
    
    emptyText: { color: '#94A3B8', fontStyle: 'italic', fontWeight: '600', textAlign: 'center', marginVertical: 10 },
    hint: { color: '#64748B', fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 18, fontWeight: '600', paddingHorizontal: 10 }
});