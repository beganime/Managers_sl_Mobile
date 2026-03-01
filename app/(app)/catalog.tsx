// app/(app)/catalog.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, LayoutAnimation, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, UIManager, View } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';
import { getToken, saveToken } from '../../src/utils/storage';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- УТИЛИТА ДЛЯ НЕЧЕТКОГО ПОИСКА (ПРОЩАЕТ ОПЕЧАТКИ) ---
const getEditDistance = (a: string, b: string) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i += 1) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j += 1) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j += 1) {
        for (let i = 1; i <= a.length; i += 1) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                matrix[j - 1][i - 1] + indicator
            );
        }
    }
    return matrix[b.length][a.length];
};

const isFuzzyMatch = (text: string, query: string) => {
    if (!query) return true;
    if (!text) return false;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    if (lowerText.includes(lowerQuery)) return true;
    
    // Если слово длиннее 3 символов, прощаем до 2 опечаток
    if (lowerQuery.length > 3) {
        const words = lowerText.split(/\s+/);
        for (let w of words) {
            if (getEditDistance(w, lowerQuery) <= 2) return true;
        }
    }
    return false;
};

const degreeMap: any = {
    'bachelor': 'Бакалавриат',
    'master': 'Магистратура',
    'specialist': 'Специалитет',
    'language': 'Языковые курсы'
};

export default function CatalogScreen() {
    const router = useRouter();
    const [universities, setUniversities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    
    // Раскрытие программы
    const [expandedProgId, setExpandedProgId] = useState<number | string | null>(null);
    
    // Поиск и инструменты
    const [searchQuery, setSearchQuery] = useState('');
    const [showTools, setShowTools] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState('');
    const [sortMethod, setSortMethod] = useState('name_asc'); // name_asc, name_desc, price_asc, price_desc

    // ПАГИНАЦИЯ (чтобы не лагало)
    const [visibleCount, setVisibleCount] = useState(20);

    const loadData = async () => {
        try {
            const cached = await getToken('cache_universities');
            if (cached) {
                setUniversities(JSON.parse(cached));
                setLoading(false);
            }
            const res = await apiClient.get('catalog/universities/');
            const data = res.data.results || res.data;
            setUniversities(data);
            await saveToken('cache_universities', JSON.stringify(data));
        } catch (error) {
            console.log("Офлайн режим для каталога");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // Сброс пагинации при изменении фильтров/поиска
    useEffect(() => {
        setVisibleCount(20);
    }, [searchQuery, selectedCountry, sortMethod]);

    const forceSyncData = async () => {
        setSyncing(true);
        try {
            const res = await apiClient.get('catalog/universities/');
            const data = res.data.results || res.data;
            setUniversities(data);
            await saveToken('cache_universities', JSON.stringify(data));
            Alert.alert("Успешно", "База данных каталога обновлена");
        } catch (error) {
            Alert.alert("Ошибка", "Нет интернета. Показана локальная база.");
        } finally {
            setSyncing(false);
        }
    };

    const toggleExpand = (id: number | string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedProgId(expandedProgId === id ? null : id);
    };

    const uniqueCountries = Array.from(new Set(universities.map(u => u.country))).filter(Boolean);

    // --- РАСПАКОВКА ДАННЫХ В ЕДИНЫЙ МАССИВ ---
    let displayPrograms: any[] = [];
    
    universities.forEach(uni => {
        if (uni.programs && uni.programs.length > 0) {
            uni.programs.forEach((prog: any) => {
                displayPrograms.push({
                    ...prog,
                    uni: uni // Вшиваем ВУЗ в программу
                });
            });
        }
    });

    // --- ФИЛЬТРАЦИЯ ПО ВСЕЙ БАЗЕ ---
    displayPrograms = displayPrograms.filter(prog => {
        // Страна ВУЗа
        if (selectedCountry && prog.uni.country !== selectedCountry) return false;
        
        // Умный поиск (Название программы ИЛИ Название/Город ВУЗа)
        if (searchQuery) {
            const matchProg = isFuzzyMatch(prog.name, searchQuery);
            const matchUni = isFuzzyMatch(prog.uni.name, searchQuery) || isFuzzyMatch(prog.uni.city, searchQuery);
            if (!matchProg && !matchUni) return false;
        }
        
        return true;
    });

    // --- СОРТИРОВКА ВСЕЙ БАЗЫ ---
    displayPrograms.sort((a, b) => {
        if (sortMethod === 'name_asc') return a.name.localeCompare(b.name);
        if (sortMethod === 'name_desc') return b.name.localeCompare(a.name);
        
        const priceA = parseFloat(a.tuition_fee) || 0;
        const priceB = parseFloat(b.tuition_fee) || 0;
        if (sortMethod === 'price_asc') return priceA - priceB;
        if (sortMethod === 'price_desc') return priceB - priceA;
        
        return 0;
    });

    // --- ОТСЕЧЕНИЕ ДЛЯ ОПТИМИЗАЦИИ (БЕРЕМ ТОЛЬКО ПЕРВЫЕ visibleCount ШТУК) ---
    const paginatedPrograms = displayPrograms.slice(0, visibleCount);

    const loadMore = () => {
        if (visibleCount < displayPrograms.length) {
            setVisibleCount(prev => prev + 20);
        }
    };

    const renderProgramCard = ({ item: prog }: { item: any }) => {
        const isExpanded = expandedProgId === prog.id;
        
        return (
            <View style={styles.progWrapper}>
                <TouchableOpacity activeOpacity={0.8} onPress={() => toggleExpand(prog.id)}>
                    <BlurView intensity={40} tint="light" style={[styles.progCard, isExpanded && styles.progCardExpanded]}>
                        
                        <View style={styles.progHeader}>
                            <View style={{flex: 1, paddingRight: 10}}>
                                <Text style={styles.progName}>{prog.name}</Text>
                                <View style={styles.progTagsRow}>
                                    <View style={styles.progBadge}>
                                        <Text style={styles.progBadgeText}>{degreeMap[prog.degree] || prog.degree}</Text>
                                    </View>
                                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                        <Ionicons name="time-outline" size={14} color="#64748B" style={{marginRight: 4}} />
                                        <Text style={styles.progDuration}>{prog.duration}</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.expandIcon}>
                                <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#0D416D" />
                            </View>
                        </View>
                        
                        <View style={styles.progFinanceRow}>
                            <View>
                                <Text style={styles.financeLabel}>Контракт</Text>
                                <Text style={styles.financeValue}>
                                    {parseFloat(prog.tuition_fee).toLocaleString()} {prog.uni.local_currency?.code || 'USD'}
                                </Text>
                            </View>
                            <View style={{alignItems: 'flex-end'}}>
                                <Text style={styles.financeLabel}>Услуги (USD)</Text>
                                <Text style={[styles.financeValue, {color: '#10b981'}]}>
                                    ${parseFloat(prog.service_fee).toLocaleString()}
                                </Text>
                            </View>
                        </View>

                        {isExpanded && (
                            <View style={styles.expandedUniContainer}>
                                <View style={styles.uniInfoBox}>
                                    <View style={styles.uniIconCircle}>
                                        <Ionicons name="school" size={24} color="#0D416D" />
                                    </View>
                                    <View style={{flex: 1}}>
                                        <Text style={styles.uniNameExpanded}>{prog.uni.name}</Text>
                                        <Text style={styles.uniLocationExpanded}>
                                            <Ionicons name="location-outline" size={12} color="#475569" /> {prog.uni.city}, {prog.uni.country}
                                        </Text>
                                    </View>
                                </View>
                                
                                <TouchableOpacity style={styles.detailsBtn} onPress={() => router.push(`/university/${prog.uni.id}` as any)}>
                                    <Ionicons name="document-text-outline" size={18} color="#fff" />
                                    <Text style={styles.detailsBtnText}>Открыть справочник ВУЗа</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </BlurView>
                </TouchableOpacity>
            </View>
        );
    };

    if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color="#0D416D" /></View></ScreenWrapper>;

    return (
        <ScreenWrapper>
            <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient colors={['#F1F5F9', '#E2E8F0']} style={StyleSheet.absoluteFillObject} />
            </View>
            
            <View style={styles.topHeader}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Ionicons name="library" size={26} color="#0D416D" style={{marginRight: 10}} />
                    <Text style={styles.pageTitle}>Программы</Text>
                </View>
                <TouchableOpacity style={styles.toolsBtn} onPress={() => setShowTools(true)}>
                    <Ionicons name="options" size={22} color="#0D416D" />
                </TouchableOpacity>
            </View>

            <BlurView intensity={50} tint="light" style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#64748B" />
                <TextInput 
                    style={styles.searchInput} 
                    placeholder="Поиск специальности или ВУЗа..." 
                    placeholderTextColor="#94A3B8" 
                    value={searchQuery} 
                    onChangeText={setSearchQuery} 
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color="#64748B" />
                    </TouchableOpacity>
                )}
            </BlurView>

            {/* ИСПОЛЬЗУЕМ FLATLIST ДЛЯ ПЛАВНОЙ ПРОКРУТКИ 3000+ ПРОГРАММ */}
            <FlatList
                data={paginatedPrograms}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderProgramCard}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
                // Пагинация:
                onEndReached={loadMore}
                onEndReachedThreshold={0.5} // Подгружаем, когда осталось прокрутить половину экрана
                refreshControl={<RefreshControl refreshing={syncing} onRefresh={forceSyncData} tintColor="#0D416D" />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="folder-open-outline" size={48} color="#94A3B8" />
                        <Text style={styles.emptyText}>По вашему запросу ничего не найдено</Text>
                    </View>
                }
                ListFooterComponent={
                    visibleCount < displayPrograms.length ? (
                        <ActivityIndicator size="small" color="#0D416D" style={{ marginVertical: 20 }} />
                    ) : null
                }
            />

            {/* === МОДАЛЬНОЕ ОКНО ИНСТРУМЕНТОВ === */}
            <Modal visible={showTools} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <BlurView intensity={80} tint="light" style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Настройки отображения</Text>
                            <TouchableOpacity onPress={() => setShowTools(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.sectionLabel}>Сортировка программ</Text>
                            <View style={styles.sortGrid}>
                                <TouchableOpacity style={[styles.sortBtn, sortMethod === 'name_asc' && styles.sortBtnActive]} onPress={() => setSortMethod('name_asc')}>
                                    <Text style={[styles.sortBtnText, sortMethod === 'name_asc' && {color: '#fff'}]}>А - Я</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.sortBtn, sortMethod === 'name_desc' && styles.sortBtnActive]} onPress={() => setSortMethod('name_desc')}>
                                    <Text style={[styles.sortBtnText, sortMethod === 'name_desc' && {color: '#fff'}]}>Я - А</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.sortBtn, sortMethod === 'price_asc' && styles.sortBtnActive]} onPress={() => setSortMethod('price_asc')}>
                                    <Text style={[styles.sortBtnText, sortMethod === 'price_asc' && {color: '#fff'}]}>Дешевые контракты</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.sortBtn, sortMethod === 'price_desc' && styles.sortBtnActive]} onPress={() => setSortMethod('price_desc')}>
                                    <Text style={[styles.sortBtnText, sortMethod === 'price_desc' && {color: '#fff'}]}>Дорогие контракты</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.sectionLabel}>Фильтр по стране ВУЗа</Text>
                            <View style={styles.sortGrid}>
                                <TouchableOpacity style={[styles.sortBtn, selectedCountry === '' && styles.sortBtnActive]} onPress={() => setSelectedCountry('')}>
                                    <Text style={[styles.sortBtnText, selectedCountry === '' && {color: '#fff'}]}>Все страны</Text>
                                </TouchableOpacity>
                                {uniqueCountries.map((c: string) => (
                                    <TouchableOpacity key={c} style={[styles.sortBtn, selectedCountry === c && styles.sortBtnActive]} onPress={() => setSelectedCountry(c)}>
                                        <Text style={[styles.sortBtnText, selectedCountry === c && {color: '#fff'}]}>{c}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity style={styles.applyBtn} onPress={() => setShowTools(false)}>
                                <Text style={styles.applyBtnText}>Применить</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity style={styles.syncBtn} onPress={() => { forceSyncData(); setShowTools(false); }}>
                                <Ionicons name="cloud-download-outline" size={18} color="#0D416D" style={{marginRight: 8}} />
                                <Text style={styles.syncBtnText}>Обновить базу с сервера</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </BlurView>
                </View>
            </Modal>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 20, paddingTop: 10 },
    pageTitle: { color: '#0F172A', fontSize: 24, fontWeight: '900' },
    toolsBtn: { backgroundColor: 'rgba(255,255,255,0.7)', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
    
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 18, paddingHorizontal: 15, height: 55, marginBottom: 20, marginHorizontal: 20, borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput: { flex: 1, color: '#1E293B', marginLeft: 10, fontSize: 16, fontWeight: '600', outlineStyle: 'none' },
    
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
    emptyText: { color: '#64748B', textAlign: 'center', marginTop: 15, fontSize: 16, fontWeight: '600' },
    
    progWrapper: { marginBottom: 15 },
    progCard: { padding: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(255,255,255,0.5)', overflow: 'hidden' },
    progCardExpanded: { borderColor: '#0D416D', backgroundColor: 'rgba(255,255,255,0.8)' },
    
    progHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
    progName: { color: '#0F172A', fontSize: 18, fontWeight: '900', marginBottom: 8, lineHeight: 24 },
    progTagsRow: { flexDirection: 'row', alignItems: 'center' },
    progBadge: { backgroundColor: 'rgba(13,65,109,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 15 },
    progBadgeText: { color: '#0D416D', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
    progDuration: { color: '#475569', fontSize: 13, fontWeight: '700' },
    expandIcon: { backgroundColor: 'rgba(255,255,255,0.8)', padding: 10, borderRadius: 14, marginTop: 2 },
    
    progFinanceRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(15,23,42,0.05)', paddingTop: 15 },
    financeLabel: { color: '#64748B', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
    financeValue: { color: '#1E293B', fontWeight: '900', fontSize: 16 },

    // Блок ВУЗа внутри программы
    expandedUniContainer: { marginTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(15,23,42,0.1)', paddingTop: 20 },
    uniInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)', padding: 15, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    uniIconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(13, 65, 109, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    uniNameExpanded: { color: '#0F172A', fontSize: 16, fontWeight: '800', marginBottom: 4 },
    uniLocationExpanded: { color: '#475569', fontSize: 13, fontWeight: '600' },

    detailsBtn: { flexDirection: 'row', backgroundColor: '#0D416D', paddingVertical: 14, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#0D416D', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: {width: 0, height: 4} },
    detailsBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, marginLeft: 8 },

    // Модальное окно
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.4)' },
    modalContent: { borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 30, maxHeight: '90%', backgroundColor: 'rgba(241, 245, 249, 0.95)', overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    modalTitle: { color: '#0F172A', fontSize: 22, fontWeight: '900' },
    closeBtn: { backgroundColor: 'rgba(15,23,42,0.05)', padding: 8, borderRadius: 16 },
    sectionLabel: { color: '#475569', fontSize: 12, textTransform: 'uppercase', fontWeight: '900', marginBottom: 12, marginTop: 10, letterSpacing: 1 },
    sortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
    sortBtn: { backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
    sortBtnActive: { backgroundColor: '#0D416D', borderColor: '#0D416D' },
    sortBtnText: { color: '#475569', fontWeight: '700', fontSize: 13 },
    applyBtn: { backgroundColor: '#0D416D', padding: 18, borderRadius: 20, alignItems: 'center', marginTop: 25, shadowColor: '#0D416D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    applyBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
    syncBtn: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.6)', padding: 18, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    syncBtnText: { color: '#0D416D', fontWeight: '800', fontSize: 15 }
});