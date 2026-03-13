// app/(app)/documents.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';

export default function DocumentsScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'templates' | 'generated'>('templates');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    const [templates, setTemplates] = useState<any[]>([]);
    const [generatedDocs, setGeneratedDocs] = useState<any[]>([]);
    
    // Модалка генерации
    const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
    const [docTitle, setDocTitle] = useState(''); // Новое состояние для названия документа
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [isGenerating, setIsGenerating] = useState(false);

    const loadData = async () => {
        try {
            const [templatesRes, generatedRes] = await Promise.all([
                apiClient.get('documents/templates/'),
                apiClient.get('documents/generated/')
            ]);
            setTemplates(templatesRes.data.results || templatesRes.data);
            setGeneratedDocs(generatedRes.data.results || generatedRes.data);
        } catch (error) {
            console.error("Ошибка загрузки документов", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleOpenTemplate = (template: any) => {
        setSelectedTemplate(template);
        setDocTitle(''); // Очищаем название
        setFormData({}); // Очищаем форму полей
    };

    const handleGenerate = async () => {
        // Проверка названия документа
        if (!docTitle.trim()) {
            Alert.alert("Внимание", "Укажите название документа (например: Договор Иванов И.И.)");
            return;
        }

        // Проверка обязательных динамических полей
        for (const field of selectedTemplate.fields_config) {
            if (field.is_required && !formData[field.key]) {
                Alert.alert("Внимание", `Поле "${field.label}" обязательно для заполнения`);
                return;
            }
        }

        setIsGenerating(true);
        try {
            // ИСПРАВЛЕНИЕ: отправляем context_data, как того ждет Django модель!
            const payload = {
                template: selectedTemplate.id,
                title: docTitle.trim(),
                context_data: formData 
            };
            
            await apiClient.post('documents/generated/', payload);
            Alert.alert("Успех", "Документ поставлен в очередь на генерацию. Проверьте вкладку 'Мои файлы'.");
            setSelectedTemplate(null);
            loadData(); 
        } catch (error) {
            console.error("Generate error", error);
            Alert.alert("Ошибка", "Не удалось сгенерировать документ");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = (url: string) => {
        if (!url) {
            Alert.alert("Ошибка", "Файл еще не сгенерирован или недоступен.");
            return;
        }
        Linking.openURL(url);
    };

    if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color="#0D416D" /></View></ScreenWrapper>;

    return (
        <ScreenWrapper>
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient colors={['#F1F5F9', '#E2E8F0']} style={StyleSheet.absoluteFillObject} />
            </View>

            {/* --- ШАПКА С КНОПКОЙ НАЗАД --- */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Документооборот</Text>
                <View style={{width: 40}} />
            </View>

            <ScrollView 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#0D416D" />}
            >
                <BlurView intensity={50} tint="light" style={styles.tabsContainer}>
                    <TouchableOpacity style={[styles.tab, activeTab === 'templates' && styles.activeTab]} onPress={() => setActiveTab('templates')}>
                        <Text style={[styles.tabText, activeTab === 'templates' && styles.activeTabText]}>Шаблоны</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tab, activeTab === 'generated' && styles.activeTab]} onPress={() => setActiveTab('generated')}>
                        <Text style={[styles.tabText, activeTab === 'generated' && styles.activeTabText]}>Мои файлы</Text>
                    </TouchableOpacity>
                </BlurView>

                {activeTab === 'templates' && (
                    templates.length === 0 ? <Text style={styles.emptyText}>Доступных шаблонов нет</Text> :
                    templates.map(tpl => (
                        <BlurView key={tpl.id} intensity={50} tint="light" style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Ionicons name="document-text" size={24} color="#0D416D" />
                                <View style={{ flex: 1, marginLeft: 15 }}>
                                    <Text style={styles.cardTitle}>{tpl.title}</Text>
                                    <Text style={styles.cardSubtitle}>{tpl.description}</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => handleOpenTemplate(tpl)}>
                                <Text style={styles.actionBtnText}>Заполнить и создать</Text>
                                <Ionicons name="chevron-forward" size={16} color="#fff" />
                            </TouchableOpacity>
                        </BlurView>
                    ))
                )}

                {activeTab === 'generated' && (
                    generatedDocs.length === 0 ? <Text style={styles.emptyText}>Вы еще не создавали документы</Text> :
                    generatedDocs.map(doc => (
                        <BlurView key={doc.id} intensity={50} tint="light" style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Ionicons name={doc.file_url ? "checkmark-circle" : "time"} size={24} color={doc.file_url ? "#10b981" : "#f59e0b"} />
                                <View style={{ flex: 1, marginLeft: 15 }}>
                                    <Text style={styles.cardTitle}>{doc.title || doc.template_name}</Text>
                                    <Text style={styles.cardSubtitle}>Статус: {doc.status === 'generated' || doc.file_url ? 'Готов' : doc.status === 'error' ? 'Ошибка' : 'В обработке'}</Text>
                                </View>
                            </View>
                            {doc.file_url && (
                                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#10b981'}]} onPress={() => handleDownload(doc.file_url)}>
                                    <Ionicons name="cloud-download" size={18} color="#fff" style={{marginRight: 8}} />
                                    <Text style={styles.actionBtnText}>Скачать документ</Text>
                                </TouchableOpacity>
                            )}
                        </BlurView>
                    ))
                )}
            </ScrollView>

            <Modal visible={selectedTemplate !== null} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <BlurView intensity={70} tint="light" style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Создание документа</Text>
                            <TouchableOpacity onPress={() => setSelectedTemplate(null)}>
                                <Ionicons name="close-circle" size={32} color="#0D416D" />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView showsVerticalScrollIndicator={false} style={{marginBottom: 20}}>
                            <Text style={styles.templateNameInfo}>Шаблон: {selectedTemplate?.title}</Text>
                            
                            {/* НОВОЕ ПОЛЕ: Название документа */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    Название документа <Text style={{color: '#ef4444'}}>*</Text>
                                </Text>
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="Например: Договор Иванов И.И."
                                    placeholderTextColor="#94A3B8"
                                    value={docTitle}
                                    onChangeText={setDocTitle}
                                />
                            </View>

                            <View style={styles.divider} />

                            {/* ДИНАМИЧЕСКИЕ ПОЛЯ ИЗ ШАБЛОНА */}
                            {selectedTemplate?.fields_config?.map((field: any) => (
                                <View key={field.key} style={styles.inputGroup}>
                                    <Text style={styles.label}>
                                        {field.label} {field.is_required && <Text style={{color: '#ef4444'}}>*</Text>}
                                    </Text>
                                    <TextInput 
                                        style={[styles.input, field.field_type === 'textarea' && { height: 80, textAlignVertical: 'top' }]} 
                                        multiline={field.field_type === 'textarea'}
                                        placeholder={field.field_type === 'date' ? 'YYYY-MM-DD' : 'Введите значение...'}
                                        placeholderTextColor="#94A3B8"
                                        keyboardType={field.field_type === 'numeric' ? 'numeric' : 'default'}
                                        value={formData[field.key] || ''}
                                        onChangeText={text => setFormData({...formData, [field.key]: text})}
                                    />
                                </View>
                            ))}
                        </ScrollView>

                        <TouchableOpacity style={styles.submitBtn} onPress={handleGenerate} disabled={isGenerating}>
                            {isGenerating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Сгенерировать</Text>}
                        </TouchableOpacity>
                    </BlurView>
                </KeyboardAvoidingView>
            </Modal>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
    backBtn: { width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
    headerTitle: { color: '#0F172A', fontSize: 20, fontWeight: '900', flex: 1, textAlign: 'center' },

    tabsContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 16, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
    activeTab: { backgroundColor: '#0D416D', shadowColor: '#0D416D', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
    tabText: { color: '#64748B', fontWeight: '800', fontSize: 14 },
    activeTabText: { color: '#ffffff' },
    
    emptyText: { color: '#94A3B8', textAlign: 'center', marginTop: 40, fontSize: 15, fontWeight: '600', fontStyle: 'italic' },
    
    card: { padding: 20, borderRadius: 24, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(255,255,255,0.5)', overflow: 'hidden' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900', marginBottom: 4 },
    cardSubtitle: { color: '#475569', fontSize: 13, fontWeight: '600', lineHeight: 18 },
    
    actionBtn: { flexDirection: 'row', backgroundColor: '#0D416D', paddingVertical: 14, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 14, marginRight: 5 },

    // Модалка
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.4)' },
    modalContent: { borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 25, maxHeight: '90%', backgroundColor: 'rgba(241, 245, 249, 0.95)', overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
    templateNameInfo: { fontSize: 13, color: '#64748B', fontWeight: '800', marginBottom: 25, textTransform: 'uppercase', letterSpacing: 1 },
    
    divider: { height: 1, backgroundColor: 'rgba(15,23,42,0.1)', marginBottom: 20 },

    inputGroup: { marginBottom: 15 },
    label: { fontSize: 12, fontWeight: '900', color: '#475569', marginBottom: 8, marginLeft: 6, textTransform: 'uppercase' },
    input: { backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: 16, padding: 16, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.9)', color: '#1E293B', fontWeight: '700' },
    
    submitBtn: { backgroundColor: '#0D416D', padding: 20, borderRadius: 20, alignItems: 'center', shadowColor: '#0D416D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }
});