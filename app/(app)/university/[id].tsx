// app/(app)/university/[id].tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
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

    // Блок информации премиум дизайна
    const InfoBlock = ({ title, content, icon }: { title: string, content: string, icon: any }) => {
        if (!content) return null;
        const cleanContent = stripHtml(content);
        return (
            <TouchableOpacity activeOpacity={0.7} onPress={() => handleCopy(cleanContent, title)}>
                <BlurView intensity={25} tint="dark" style={styles.infoBlock}>
                    <View style={styles.infoHeader}>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Ionicons name={icon} size={18} color="#60a5fa" style={{marginRight: 10}} />
                            <Text style={styles.infoTitle}>{title}</Text>
                        </View>
                        <Ionicons name="copy-outline" size={16} color="rgba(255,255,255,0.3)" />
                    </View>
                    <Text style={styles.infoContent}>{cleanContent}</Text>
                </BlurView>
            </TouchableOpacity>
        );
    };

    if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View></ScreenWrapper>;
    if (!uni) return <ScreenWrapper><Text style={styles.errorText}>ВУЗ не найден</Text></ScreenWrapper>;

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/catalog')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>Справочник</Text>
                <View style={{width: 40}} />
            </View>

            <BlurView intensity={40} tint="dark" style={styles.heroCard}>
                <View style={styles.iconCircle}>
                    <Ionicons name="business" size={32} color="#3b82f6" />
                </View>
                <Text style={styles.heroName}>{uni.name}</Text>
                <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 8}}>
                    <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.heroLocation}>{uni.city}, {uni.country}</Text>
                </View>
            </BlurView>

            <ScrollView showsVerticalScrollIndicator={false}>
                
                <Text style={styles.sectionTitle}>Детальная информация</Text>
                <Text style={styles.hintText}>Нажмите на блок, чтобы скопировать чистый текст</Text>
                
                <InfoBlock title="Общее описание" content={uni.description} icon="information-circle" />
                <InfoBlock title="Необходимые документы" content={uni.required_docs} icon="document-text" />
                <InfoBlock title="Расходы на жизнь" content={uni.expenses_info} icon="wallet" />
                <InfoBlock title="Приглашение и виза" content={uni.invitation_info} icon="airplane" />
                
                <View style={{flexDirection: 'row', gap: 12, marginBottom: 15}}>
                    <View style={[styles.infoBlock, {flex: 1, padding: 15, marginBottom: 0}]}>
                        <Text style={styles.infoLabel}>Период приема</Text>
                        <Text style={styles.infoValueSmall}>{uni.intake_period || 'Не указан'}</Text>
                    </View>
                    <View style={[styles.infoBlock, {flex: 1, padding: 15, marginBottom: 0}]}>
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
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
    errorText: { color: '#fca5a5', fontSize: 16, textAlign: 'center', marginTop: 40 },
    
    heroCard: { padding: 30, borderRadius: 28, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', backgroundColor: 'rgba(30, 58, 138, 0.2)' },
    iconCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(59, 130, 246, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)' },
    heroName: { color: '#fff', fontSize: 22, fontWeight: 'bold', textAlign: 'center', lineHeight: 28 },
    heroLocation: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '500', marginLeft: 4 },

    sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4, marginLeft: 5, letterSpacing: 0.5 },
    hintText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 20, marginLeft: 5 },
    
    // Стили Инфо блоков
    infoBlock: { padding: 20, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.3)' },
    infoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    infoTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
    infoContent: { color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 22 },
    infoLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', marginBottom: 6, fontWeight: 'bold' },
    infoValueSmall: { color: '#fff', fontSize: 15, fontWeight: 'bold' }
});