// app/(app)/university/[id].tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ScreenWrapper from '../../../components/ScreenWrapper';
import { getToken } from '../../../src/utils/storage';

// --- ОЧИСТКА HTML ТЕГОВ ---
const stripHtml = (html: string) => {
    if (!html) return '';
    return html
        .replace(/<[^>]*>?/gm, '') // удаляет все теги <p>, <li>, <b> и т.д.
        .replace(/&nbsp;/g, ' ')   // заменяет пробелы
        .replace(/&amp;/g, '&')
        .trim();
};

export default function UniversityDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [uni, setUni] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUni = async () => {
            try {
                const cached = await getToken('cache_universities');
                if (cached) {
                    const unis = JSON.parse(cached);
                    const found = unis.find((u: any) => u.id.toString() === id?.toString());
                    if (found) setUni(found);
                }
            } catch (error) {
                console.error("Ошибка загрузки ВУЗа", error);
            } finally {
                setLoading(false);
            }
        };
        fetchUni();
    }, [id]);

    const handleCopy = async (text: string, title: string) => {
        if (!text) return;
        const cleanText = stripHtml(text);
        await Clipboard.setStringAsync(cleanText);
        Alert.alert("Скопировано", `${title} скопировано в буфер обмена`);
    };

    // Блок информации премиум дизайна (светлое стекло)
    const InfoBlock = ({ title, content, icon }: { title: string, content: string, icon: any }) => {
        if (!content) return null;
        const cleanContent = stripHtml(content);
        return (
            <TouchableOpacity activeOpacity={0.7} onPress={() => handleCopy(cleanContent, title)}>
                <BlurView intensity={50} tint="light" style={styles.infoBlock}>
                    <View style={styles.infoHeader}>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Ionicons name={icon} size={18} color="#0D416D" style={{marginRight: 10}} />
                            <Text style={styles.infoTitle}>{title}</Text>
                        </View>
                        <Ionicons name="copy-outline" size={16} color="#94A3B8" />
                    </View>
                    <Text style={styles.infoContent}>{cleanContent}</Text>
                </BlurView>
            </TouchableOpacity>
        );
    };

    if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color="#0D416D" /></View></ScreenWrapper>;
    if (!uni) return <ScreenWrapper><Text style={styles.errorText}>ВУЗ не найден</Text></ScreenWrapper>;

    return (
        <ScreenWrapper>
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient colors={['#F1F5F9', '#E2E8F0']} style={StyleSheet.absoluteFillObject} />
            </View>

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/catalog')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>Справочник</Text>
                <View style={{width: 40}} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                
                <BlurView intensity={50} tint="light" style={styles.heroCard}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="business" size={36} color="#0D416D" />
                    </View>
                    <Text style={styles.heroName}>{uni.name}</Text>
                    <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 8}}>
                        <Ionicons name="location-outline" size={16} color="#475569" />
                        <Text style={styles.heroLocation}>{uni.city}, {uni.country}</Text>
                    </View>
                </BlurView>

                <Text style={styles.sectionTitle}>Детальная информация</Text>
                <Text style={styles.hintText}>Нажмите на блок, чтобы скопировать чистый текст</Text>
                
                <InfoBlock title="Общее описание" content={uni.description} icon="information-circle" />
                <InfoBlock title="Необходимые документы" content={uni.required_docs} icon="document-text" />
                <InfoBlock title="Расходы на жизнь" content={uni.expenses_info} icon="wallet" />
                <InfoBlock title="Приглашение и виза" content={uni.invitation_info} icon="airplane" />
                
                <View style={{flexDirection: 'row', gap: 12, marginBottom: 15}}>
                    <View style={[styles.infoBlock, {flex: 1, padding: 18, marginBottom: 0, backgroundColor: 'rgba(255,255,255,0.6)'}]}>
                        <Text style={styles.infoLabel}>Период приема</Text>
                        <Text style={styles.infoValueSmall}>{uni.intake_period || 'Не указан'}</Text>
                    </View>
                    <View style={[styles.infoBlock, {flex: 1, padding: 18, marginBottom: 0, backgroundColor: 'rgba(255,255,255,0.6)'}]}>
                        <Text style={styles.infoLabel}>Возраст</Text>
                        <Text style={styles.infoValueSmall}>{uni.age_limit || 'Нет ограничений'}</Text>
                    </View>
                </View>
                
                <InfoBlock title="Контакты университета" content={uni.contacts} icon="call" />

                <View style={{height: 100}} />
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
    backBtn: { width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
    headerTitle: { color: '#0F172A', fontSize: 20, fontWeight: '900', flex: 1, textAlign: 'center' },
    errorText: { color: '#ef4444', fontSize: 16, textAlign: 'center', marginTop: 40, fontWeight: '700' },
    scrollContent: { paddingHorizontal: 20 },
    
    heroCard: { padding: 30, borderRadius: 32, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },
    iconCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(13, 65, 109, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: 'rgba(13, 65, 109, 0.2)' },
    heroName: { color: '#0F172A', fontSize: 22, fontWeight: '900', textAlign: 'center', lineHeight: 28 },
    heroLocation: { color: '#475569', fontSize: 15, fontWeight: '600', marginLeft: 4 },

    sectionTitle: { color: '#334155', fontSize: 13, fontWeight: '900', marginBottom: 4, marginLeft: 5, letterSpacing: 1.5, textTransform: 'uppercase' },
    hintText: { color: '#94A3B8', fontSize: 12, marginBottom: 20, marginLeft: 5, fontWeight: '600' },
    
    // Стили Инфо блоков
    infoBlock: { padding: 20, borderRadius: 24, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(255,255,255,0.5)', overflow: 'hidden' },
    infoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    infoTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
    infoContent: { color: '#475569', fontSize: 15, lineHeight: 22, fontWeight: '500' },
    infoLabel: { color: '#94A3B8', fontSize: 11, textTransform: 'uppercase', marginBottom: 6, fontWeight: '800', letterSpacing: 0.5 },
    infoValueSmall: { color: '#1E293B', fontSize: 15, fontWeight: '800' }
});