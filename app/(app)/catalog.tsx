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
    
    // Стейты данных
    const [universities, setUniversities] = useState<any[]>([]);
    const [currencies, setCurrencies] = useState<any[]>([]); // Сохраняем валюты
    
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    
    // Режим отображения: ВУЗы или Программы
    const [viewMode, setViewMode] = useState<'universities' | 'programs'>('programs');
    
    // Раскрытие карточки (универсальное)
    const [expandedId, setExpandedId] = useState<number | string | null>(null);
    
    // Поиск и инструменты
    const [searchQuery, setSearchQuery] = useState('');
    const [showTools, setShowTools] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState('');
    const [sortMethod, setSortMethod] = useState('name_asc');

    // ПАГИНАЦИЯ
    const [visibleCount, setVisibleCount] = useState(20);

    const loadData = async () => {
        try {
            // Пытаемся быстро подгрузить из кэша
            const cachedUnis = await getToken('cache_universities');
            const cachedCurrs = await getToken('cache_currencies');
            if (cachedUnis && cachedCurrs) {
                setUniversities(JSON.parse(cachedUnis));
                setCurrencies(JSON.parse(cachedCurrs));
                setLoading(false);
            }
            
            // Грузим ВУЗы и Валюты одновременно
            const [uniRes, curRes] = await Promise.all([
                apiClient.get('catalog/universities/'),
                apiClient.get('catalog/currencies/')
            ]);
            
            const uniData = uniRes.data.results || uniRes.data;
            const curData = curRes.data.results || curRes.data;
            
            setUniversities(uniData);
            setCurrencies(curData);
            
            await saveToken('cache_universities', JSON.stringify(uniData));
            await saveToken('cache_currencies', JSON.stringify(curData));
        } catch (error) {
            console.log("Офлайн режим для каталога");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        setVisibleCount(20);
        setExpandedId(null);
    }, [searchQuery, selectedCountry, sortMethod, viewMode]);

    const forceSyncData = async () => {
        setSyncing(true);
        try {
            const [uniRes, curRes] = await Promise.all([
                apiClient.get('catalog/universities/'),
                apiClient.get('catalog/currencies/')
            ]);
            const uniData = uniRes.data.results || uniRes.data;
            const curData = curRes.data.results || curRes.data;
            
            setUniversities(uniData);
            setCurrencies(curData);
            await saveToken('cache_universities', JSON.stringify(uniData));
            await saveToken('cache_currencies', JSON.stringify(curData));
            
            Alert.alert("Успешно", "База данных каталога обновлена");
        } catch (error) {
            Alert.alert("Ошибка", "Нет интернета. Показана локальная база.");
        } finally {
            setSyncing(false);
        }
    };

    const toggleExpand = (id: number | string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(expandedId === id ? null : id);
    };

    // Функция для получения валюты по ID
    const getCurrency = (currencyId: number | null) => {
        if (!currencyId) return { code: 'USD', symbol: '$' };
        const found = currencies.find(c => c.id === currencyId);
        return found || { code: 'USD', symbol: '$' };
    };

    const uniqueCountries = Array.from(new Set(universities.map(u => u.country))).filter(Boolean);

    // =========================================================================
    // ЛОГИКА ФОРМИРОВАНИЯ СПИСКОВ ДЛЯ ДВУХ РЕЖИМОВ
    // =========================================================================

    let listData: any[] = [];

    if (viewMode === 'universities') {
        let processedUnis = universities.map(uni => {
            let progs = uni.programs || [];
            if (searchQuery) {
                progs = progs.filter((p: any) => isFuzzyMatch(p.name, searchQuery));
            }
            const minPrice = progs.length > 0 ? Math.min(...progs.map((p: any) => parseFloat(p.tuition_fee) || Infinity)) : Infinity;
            return { ...uni, displayPrograms: progs, minPrice };
        });

        listData = processedUnis.filter(uni => {
            if (selectedCountry && uni.country !== selectedCountry) return false;
            if (searchQuery) {
                const uniMatch = isFuzzyMatch(uni.name, searchQuery) || isFuzzyMatch(uni.city, searchQuery);
                const progMatch = uni.displayPrograms.length > 0;
                if (!uniMatch && !progMatch) return false;
            }
            return true;
        });

    } else {
        let flatPrograms: any[] = [];
        universities.forEach(uni => {
            if (uni.programs && uni.programs.length > 0) {
                uni.programs.forEach((prog: any) => {
                    flatPrograms.push({ ...prog, uni: uni });
                });
            }
        });

        listData = flatPrograms.filter(prog => {
            if (selectedCountry && prog.uni.country !== selectedCountry) return false;
            if (searchQuery) {
                const matchProg = isFuzzyMatch(prog.name, searchQuery);
                const matchUni = isFuzzyMatch(prog.uni.name, searchQuery) || isFuzzyMatch(prog.uni.city, searchQuery);
                if (!matchProg && !matchUni) return false;
            }
            return true;
        });
    }

    // --- ОБЩАЯ СОРТИРОВКА ---
    listData.sort((a, b) => {
        if (sortMethod === 'name_asc') return a.name.localeCompare(b.name);
        if (sortMethod === 'name_desc') return b.name.localeCompare(a.name);
        
        const priceA = viewMode === 'universities' ? a.minPrice : (parseFloat(a.tuition_fee) || 0);
        const priceB = viewMode === 'universities' ? b.minPrice : (parseFloat(b.tuition_fee) || 0);
        
        if (sortMethod === 'price_asc') return priceA - priceB;
        if (sortMethod === 'price_desc') return priceB - priceA;
        return 0;
    });

    const paginatedData = listData.slice(0, visibleCount);

    const loadMore = () => {
        if (visibleCount < listData.length) {
            setVisibleCount(prev => prev + 20);
        }
    };

    // =========================================================================
    // РЕНДЕР КАРТОЧЕК
    // =========================================================================

    const renderCard = ({ item }: { item: any }) => {
        const isExpanded = expandedId === item.id;

        if (viewMode === 'universities') {
            // Находим валюту ВУЗа
            const cur = getCurrency(item.local_currency);

            // --- КАРТОЧКА ВУЗА ---
            return (
                <View style={styles.cardWrapper}>
                    <TouchableOpacity activeOpacity={0.8} onPress={() => toggleExpand(item.id)}>
                        <BlurView intensity={40} tint="light" style={[styles.card, isExpanded && styles.cardExpanded]}>
                            <View style={styles.cardHeader}>
                                <View style={{flex: 1, paddingRight: 10}}>
                                    <Text style={styles.titleText}>{item.name}</Text>
                                    <View style={styles.locationRow}>
                                        <Ionicons name="location-outline" size={14} color="#64748B" />
                                        <Text style={styles.locationText}>{item.city}, {item.country}</Text>
                                    </View>
                                </View>
                                <View style={styles.expandIcon}>
                                    <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#0D416D" />
                                </View>
                            </View>
                            
                            {!isExpanded && (
                                <View style={styles.cardFooter}>
                                    <View style={styles.infoBadge}>
                                        <Ionicons name="book-outline" size={14} color="#0D416D" />
                                        <Text style={styles.infoBadgeText}>Программ: {item.displayPrograms.length}</Text>
                                    </View>
                                    <View style={styles.infoBadge}>
                                        <Ionicons name="card-outline" size={14} color="#10b981" />
                                        <Text style={[styles.infoBadgeText, {color: '#10b981'}]}>{cur.code}</Text>
                                    </View>
                                </View>
                            )}

                            {isExpanded && (
                                <View style={styles.expandedContainer}>
                                    <TouchableOpacity style={styles.detailsBtn} onPress={() => router.push(`/university/${item.id}` as any)}>
                                        <Ionicons name="document-text-outline" size={18} color="#fff" />
                                        <Text style={styles.detailsBtnText}>Справочник документов ВУЗа</Text>
                                    </TouchableOpacity>
                                    
                                    {item.displayPrograms.length === 0 ? (
                                        <Text style={styles.emptyProgText}>Программы не найдены</Text>
                                    ) : (
                                        item.displayPrograms.map((prog: any) => (
                                            <View key={prog.id} style={styles.innerProgramItem}>
                                                <Text style={styles.innerProgName}>{prog.name}</Text>
                                                <View style={styles.progTagsRow}>
                                                    <View style={styles.progBadge}>
                                                        <Text style={styles.progBadgeText}>{degreeMap[prog.degree] || prog.degree}</Text>
                                                    </View>
                                                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                                        <Ionicons name="time-outline" size={14} color="#64748B" style={{marginRight: 4}} />
                                                        <Text style={styles.progDuration}>{prog.duration}</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.progFinanceRow}>
                                                    <View>
                                                        <Text style={styles.financeLabel}>Контракт</Text>
                                                        <Text style={styles.financeValue}>{parseFloat(prog.tuition_fee).toLocaleString()} {cur.symbol}</Text>
                                                    </View>
                                                    <View style={{alignItems: 'flex-end'}}>
                                                        <Text style={styles.financeLabel}>Услуги (USD)</Text>
                                                        <Text style={[styles.financeValue, {color: '#10b981'}]}>${parseFloat(prog.service_fee).toLocaleString()}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        ))
                                    )}
                                </View>
                            )}
                        </BlurView>
                    </TouchableOpacity>
                </View>
            );
        } else {
            // --- КАРТОЧКА ПРОГРАММЫ ---
            const cur = getCurrency(item.uni.local_currency);

            return (
                <View style={styles.cardWrapper}>
                    <TouchableOpacity activeOpacity={0.8} onPress={() => toggleExpand(item.id)}>
                        <BlurView intensity={40} tint="light" style={[styles.card, isExpanded && styles.cardExpanded]}>
                            
                            <View style={styles.cardHeader}>
                                <View style={{flex: 1, paddingRight: 10}}>
                                    <Text style={styles.titleText}>{item.name}</Text>
                                    <View style={styles.progTagsRow}>
                                        <View style={styles.progBadge}>
                                            <Text style={styles.progBadgeText}>{degreeMap[item.degree] || item.degree}</Text>
                                        </View>
                                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                            <Ionicons name="time-outline" size={14} color="#64748B" style={{marginRight: 4}} />
                                            <Text style={styles.progDuration}>{item.duration}</Text>
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
                                        {parseFloat(item.tuition_fee).toLocaleString()} {cur.symbol}
                                    </Text>
                                </View>
                                <View style={{alignItems: 'flex-end'}}>
                                    <Text style={styles.financeLabel}>Услуги (USD)</Text>
                                    <Text style={[styles.financeValue, {color: '#10b981'}]}>
                                        ${parseFloat(item.service_fee).toLocaleString()}
                                    </Text>
                                </View>
                            </View>

                            {isExpanded && (
                                <View style={styles.expandedContainer}>
                                    <View style={styles.uniInfoBox}>
                                        <View style={styles.uniIconCircle}>
                                            <Ionicons name="school" size={24} color="#0D416D" />
                                        </View>
                                        <View style={{flex: 1}}>
                                            <Text style={styles.uniNameExpanded}>{item.uni.name}</Text>
                                            <Text style={styles.locationText}>
                                                <Ionicons name="location-outline" size={12} color="#475569" /> {item.uni.city}, {item.uni.country}
                                            </Text>
                                        </View>
                                    </View>
                                    
                                    <TouchableOpacity style={styles.detailsBtn} onPress={() => router.push(`/university/${item.uni.id}` as any)}>
                                        <Ionicons name="document-text-outline" size={18} color="#fff" />
                                        <Text style={styles.detailsBtnText}>Открыть справочник ВУЗа</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </BlurView>
                    </TouchableOpacity>
                </View>
            );
        }
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
                    <Text style={styles.pageTitle}>Каталог</Text>
                </View>
                <TouchableOpacity style={styles.toolsBtn} onPress={() => setShowTools(true)}>
                    <Ionicons name="options" size={22} color="#0D416D" />
                </TouchableOpacity>
            </View>

            {/* Вкладки переключения ВУЗы / Программы */}
            <BlurView intensity={50} tint="light" style={styles.tabsContainer}>
                <TouchableOpacity style={[styles.tab, viewMode === 'universities' && styles.activeTab]} onPress={() => setViewMode('universities')}>
                    <Text style={[styles.tabText, viewMode === 'universities' && styles.activeTabText]}>ВУЗы</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, viewMode === 'programs' && styles.activeTab]} onPress={() => setViewMode('programs')}>
                    <Text style={[styles.tabText, viewMode === 'programs' && styles.activeTabText]}>Программы</Text>
                </TouchableOpacity>
            </BlurView>

            <BlurView intensity={50} tint="light" style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#64748B" />
                <TextInput 
                    style={styles.searchInput} 
                    placeholder={viewMode === 'universities' ? "Поиск университета..." : "Поиск специальности..."} 
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

            <FlatList
                data={paginatedData}
                keyExtractor={(item) => (viewMode === 'universities' ? `uni_${item.id}` : `prog_${item.id}`)}
                renderItem={renderCard}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                refreshControl={<RefreshControl refreshing={syncing} onRefresh={forceSyncData} tintColor="#0D416D" />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="folder-open-outline" size={48} color="#94A3B8" />
                        <Text style={styles.emptyText}>По вашему запросу ничего не найдено</Text>
                    </View>
                }
                ListFooterComponent={
                    visibleCount < listData.length ? (
                        <ActivityIndicator size="small" color="#0D416D" style={{ marginVertical: 20 }} />
                    ) : null
                }
            />

            {/* === МОДАЛЬНОЕ ОКНО ИНСТРУМЕНТОВ === */}
            <Modal visible={showTools} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <BlurView intensity={80} tint="light" style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Настройки</Text>
                            <TouchableOpacity onPress={() => setShowTools(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.sectionLabel}>Сортировка</Text>
                            <View style={styles.sortGrid}>
                                <TouchableOpacity style={[styles.sortBtn, sortMethod === 'name_asc' && styles.sortBtnActive]} onPress={() => setSortMethod('name_asc')}>
                                    <Text style={[styles.sortBtnText, sortMethod === 'name_asc' && {color: '#fff'}]}>А - Я</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.sortBtn, sortMethod === 'name_desc' && styles.sortBtnActive]} onPress={() => setSortMethod('name_desc')}>
                                    <Text style={[styles.sortBtnText, sortMethod === 'name_desc' && {color: '#fff'}]}>Я - А</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.sortBtn, sortMethod === 'price_asc' && styles.sortBtnActive]} onPress={() => setSortMethod('price_asc')}>
                                    <Text style={[styles.sortBtnText, sortMethod === 'price_asc' && {color: '#fff'}]}>Дешевые</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.sortBtn, sortMethod === 'price_desc' && styles.sortBtnActive]} onPress={() => setSortMethod('price_desc')}>
                                    <Text style={[styles.sortBtnText, sortMethod === 'price_desc' && {color: '#fff'}]}>Дорогие</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.sectionLabel}>Страна обучения</Text>
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
    
    topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 20, paddingTop: 10 },
    pageTitle: { color: '#0F172A', fontSize: 24, fontWeight: '900' },
    toolsBtn: { backgroundColor: 'rgba(255,255,255,0.7)', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
    
    tabsContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 16, padding: 5, marginBottom: 15, marginHorizontal: 20, borderWidth: 1, borderColor: '#E2E8F0' },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
    activeTab: { backgroundColor: '#0D416D', shadowColor: '#0D416D', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
    tabText: { color: '#64748B', fontWeight: '800', fontSize: 13 },
    activeTabText: { color: '#ffffff' },

    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 18, paddingHorizontal: 15, height: 55, marginBottom: 20, marginHorizontal: 20, borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput: { flex: 1, color: '#1E293B', marginLeft: 10, fontSize: 16, fontWeight: '600', outlineStyle: 'none' },
    
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
    emptyText: { color: '#64748B', textAlign: 'center', marginTop: 15, fontSize: 16, fontWeight: '600' },
    
    cardWrapper: { marginBottom: 15 },
    card: { padding: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(255,255,255,0.5)', overflow: 'hidden' },
    cardExpanded: { borderColor: '#0D416D', backgroundColor: 'rgba(255,255,255,0.8)' },
    
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    titleText: { color: '#0F172A', fontSize: 18, fontWeight: '900', marginBottom: 8, lineHeight: 24 },
    locationRow: { flexDirection: 'row', alignItems: 'center' },
    locationText: { color: '#475569', fontSize: 13, fontWeight: '600', marginLeft: 4 },
    expandIcon: { backgroundColor: 'rgba(255,255,255,0.8)', padding: 10, borderRadius: 14, marginTop: 2 },
    
    cardFooter: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(15,23,42,0.05)', paddingTop: 15, marginTop: 10 },
    infoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    infoBadgeText: { color: '#0D416D', fontSize: 12, fontWeight: '800', marginLeft: 6 },

    progTagsRow: { flexDirection: 'row', alignItems: 'center' },
    progBadge: { backgroundColor: 'rgba(13,65,109,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 15 },
    progBadgeText: { color: '#0D416D', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
    progDuration: { color: '#475569', fontSize: 13, fontWeight: '700' },
    
    progFinanceRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(15,23,42,0.05)', paddingTop: 15, marginTop: 5 },
    financeLabel: { color: '#64748B', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
    financeValue: { color: '#1E293B', fontWeight: '900', fontSize: 16 },

    expandedContainer: { marginTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(15,23,42,0.1)', paddingTop: 20 },
    detailsBtn: { flexDirection: 'row', backgroundColor: '#0D416D', paddingVertical: 14, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#0D416D', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: {width: 0, height: 4} },
    detailsBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, marginLeft: 8 },

    innerProgramItem: { backgroundColor: 'rgba(255,255,255,0.6)', padding: 18, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    innerProgName: { color: '#0F172A', fontSize: 16, fontWeight: '900', marginBottom: 10 },
    emptyProgText: { color: '#94A3B8', fontStyle: 'italic', fontSize: 14, textAlign: 'center', paddingVertical: 10, fontWeight: '600' },

    uniInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)', padding: 15, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    uniIconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(13, 65, 109, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    uniNameExpanded: { color: '#0F172A', fontSize: 16, fontWeight: '800', marginBottom: 4 },

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