// app/(app)/catalog.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, LayoutAnimation, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, UIManager, View } from 'react-native';
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

export default function CatalogScreen() {
    const router = useRouter();
    const [universities, setUniversities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    
    const [expandedUniId, setExpandedUniId] = useState<number | string | null>(null);
    
    // Поиск и инструменты
    const [searchQuery, setSearchQuery] = useState('');
    const [showTools, setShowTools] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState('');
    const [sortMethod, setSortMethod] = useState('name_asc'); // name_asc, name_desc, price_asc, price_desc

    const loadData = async () => {
        try {
            const cached = await getToken('cache_universities');
            if (cached) {
                setUniversities(JSON.parse(cached));
                setLoading(false);
            }
            const res = await apiClient.get('/catalog/universities/');
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

    const forceSyncData = async () => {
        setSyncing(true);
        try {
            const res = await apiClient.get('/catalog/universities/');
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
        setExpandedUniId(expandedUniId === id ? null : id);
    };

    const uniqueCountries = Array.from(new Set(universities.map(u => u.country))).filter(Boolean);

    // --- ЛОГИКА ОБРАБОТКИ (ФИЛЬТР + ПОИСК + СОРТИРОВКА) ---
    let displayUnis = universities.map(uni => {
        // Фильтруем программы ВНУТРИ ВУЗа по поисковому запросу
        let progs = uni.programs || [];
        if (searchQuery) {
            progs = progs.filter((p: any) => isFuzzyMatch(p.name, searchQuery));
        }
        
        // Вычисляем минимальную цену для сортировки по цене
        const minPrice = progs.length > 0 
            ? Math.min(...progs.map((p: any) => parseFloat(p.tuition_fee) || Infinity))
            : Infinity;

        return { ...uni, displayPrograms: progs, minPrice };
    });

    displayUnis = displayUnis.filter(uni => {
        // Фильтр по стране
        if (selectedCountry && uni.country !== selectedCountry) return false;
        
        // Фильтр по поиску (ищем по ВУЗу или проверяем, остались ли подходящие программы)
        if (searchQuery) {
            const uniMatch = isFuzzyMatch(uni.name, searchQuery) || isFuzzyMatch(uni.city, searchQuery);
            const progMatch = uni.displayPrograms.length > 0;
            if (!uniMatch && !progMatch) return false;
        }
        return true;
    });

    // Сортировка
    displayUnis.sort((a, b) => {
        if (sortMethod === 'name_asc') return a.name.localeCompare(b.name);
        if (sortMethod === 'name_desc') return b.name.localeCompare(a.name);
        if (sortMethod === 'price_asc') return a.minPrice - b.minPrice;
        if (sortMethod === 'price_desc') return b.minPrice - a.minPrice;
        return 0;
    });

    const degreeMap: any = {
        'bachelor': 'Бакалавриат',
        'master': 'Магистратура',
        'specialist': 'Специалитет',
        'language': 'Языковые курсы'
    };

    if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View></ScreenWrapper>;

    return (
        <ScreenWrapper>
            
            {/* ШАПКА КАТАЛОГА С КНОПКОЙ ИНСТРУМЕНТОВ */}
            <View style={styles.topHeader}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Ionicons name="library" size={26} color="#fff" style={{marginRight: 10}} />
                    <Text style={styles.pageTitle}>Каталог ВУЗов</Text>
                </View>
                <TouchableOpacity style={styles.toolsBtn} onPress={() => setShowTools(true)}>
                    <Ionicons name="options" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* ПОИСКОВАЯ СТРОКА */}
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="rgba(255,255,255,0.4)" />
                <TextInput 
                    style={styles.searchInput} 
                    placeholder="Умный поиск (ВУЗ или программа)..." 
                    placeholderTextColor="rgba(255,255,255,0.3)" 
                    value={searchQuery} 
                    onChangeText={setSearchQuery} 
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                )}
            </View>

            {/* ОСНОВНОЙ СПИСОК */}
            <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={syncing} onRefresh={forceSyncData} tintColor="#fff" />}>
                {displayUnis.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="folder-open-outline" size={48} color="rgba(255,255,255,0.2)" />
                        <Text style={styles.emptyText}>По вашему запросу ничего не найдено</Text>
                    </View>
                ) : (
                    displayUnis.map((uni) => {
                        const isExpanded = expandedUniId === uni.id;
                        
                        return (
                            <View key={uni.id} style={styles.uniWrapper}>
                                <TouchableOpacity activeOpacity={0.8} onPress={() => toggleExpand(uni.id)}>
                                    <BlurView intensity={25} tint="dark" style={[styles.uniCard, isExpanded && styles.uniCardExpanded]}>
                                        <View style={styles.uniHeader}>
                                            <View style={styles.uniTitleBox}>
                                                <Text style={styles.uniName}>{uni.name}</Text>
                                                <View style={styles.locationRow}>
                                                    <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.5)" />
                                                    <Text style={styles.uniLocation}>{uni.city}, {uni.country}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.expandIcon}>
                                                <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="rgba(255,255,255,0.7)" />
                                            </View>
                                        </View>
                                        
                                        {!isExpanded && (
                                            <View style={styles.uniFooter}>
                                                <View style={styles.infoBadge}>
                                                    <Ionicons name="book-outline" size={14} color="#60a5fa" />
                                                    <Text style={styles.infoBadgeText}>Программ: {uni.displayPrograms.length}</Text>
                                                </View>
                                                <View style={styles.infoBadge}>
                                                    <Ionicons name="card-outline" size={14} color="#34d399" />
                                                    <Text style={[styles.infoBadgeText, {color: '#34d399'}]}>{uni.local_currency?.code || 'USD'}</Text>
                                                </View>
                                            </View>
                                        )}

                                        {/* === ВЫПАДАЮЩИЙ СПИСОК ПРОГРАММ === */}
                                        {isExpanded && (
                                            <View style={styles.expandedContainer}>
                                                <TouchableOpacity style={styles.detailsBtn} onPress={() => router.push(`/university/${uni.id}` as any)}>
                                                    <Ionicons name="document-text-outline" size={18} color="#fff" />
                                                    <Text style={styles.detailsBtnText}>Открыть справочник документов</Text>
                                                </TouchableOpacity>
                                                
                                                {uni.displayPrograms.length === 0 ? (
                                                    <Text style={styles.emptyProgText}>Программы не найдены</Text>
                                                ) : (
                                                    uni.displayPrograms.map((prog: any) => (
                                                        <View key={prog.id} style={styles.programItem}>
                                                            <Text style={styles.progName}>{prog.name}</Text>
                                                            
                                                            <View style={styles.progInfoRow}>
                                                                <View style={styles.progBadge}>
                                                                    <Text style={styles.progBadgeText}>{degreeMap[prog.degree] || prog.degree}</Text>
                                                                </View>
                                                                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                                                    <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.5)" style={{marginRight: 4}} />
                                                                    <Text style={styles.progDuration}>{prog.duration}</Text>
                                                                </View>
                                                            </View>
                                                            
                                                            <View style={styles.progFinanceRow}>
                                                                <View>
                                                                    <Text style={styles.financeLabel}>Контракт</Text>
                                                                    <Text style={styles.financeValue}>{parseFloat(prog.tuition_fee).toLocaleString()} {uni.local_currency?.code}</Text>
                                                                </View>
                                                                <View style={{alignItems: 'flex-end'}}>
                                                                    <Text style={styles.financeLabel}>Доход компании</Text>
                                                                    <Text style={[styles.financeValue, {color: '#34d399'}]}>${parseFloat(prog.service_fee).toLocaleString()}</Text>
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
                    })
                )}
                <View style={{height: 100}} />
            </ScrollView>

            {/* === МОДАЛЬНОЕ ОКНО ИНСТРУМЕНТОВ === */}
            <Modal visible={showTools} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <BlurView intensity={80} tint="dark" style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Настройки отображения</Text>
                            <TouchableOpacity onPress={() => setShowTools(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color="#fff" />
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
                                    <Text style={[styles.sortBtnText, sortMethod === 'price_asc' && {color: '#fff'}]}>Сначала дешевые</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.sortBtn, sortMethod === 'price_desc' && styles.sortBtnActive]} onPress={() => setSortMethod('price_desc')}>
                                    <Text style={[styles.sortBtnText, sortMethod === 'price_desc' && {color: '#fff'}]}>Сначала дорогие</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.sectionLabel}>Фильтр по стране</Text>
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
                                <Ionicons name="cloud-download-outline" size={18} color="#fff" style={{marginRight: 8}} />
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
    
    topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 5 },
    pageTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    toolsBtn: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, paddingHorizontal: 15, height: 55, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    searchInput: { flex: 1, color: '#fff', marginLeft: 10, fontSize: 16, outlineStyle: 'none' },
    
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
    emptyText: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 15, fontSize: 16 },
    
    uniWrapper: { marginBottom: 12 },
    uniCard: { padding: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)', overflow: 'hidden' },
    uniCardExpanded: { borderColor: 'rgba(59, 130, 246, 0.4)', backgroundColor: 'rgba(30, 58, 138, 0.1)' },
    
    uniHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    uniTitleBox: { flex: 1, paddingRight: 10 },
    uniName: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8, lineHeight: 24 },
    locationRow: { flexDirection: 'row', alignItems: 'center' },
    uniLocation: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500', marginLeft: 4 },
    expandIcon: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 12 },
    
    uniFooter: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 15, marginTop: 15 },
    infoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    infoBadgeText: { color: '#60a5fa', fontSize: 12, fontWeight: 'bold', marginLeft: 6 },

    expandedContainer: { marginTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 20 },
    detailsBtn: { flexDirection: 'row', backgroundColor: '#3b82f6', paddingVertical: 14, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: {width: 0, height: 4} },
    detailsBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginLeft: 8 },
    
    programItem: { backgroundColor: 'rgba(0,0,0,0.4)', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    progName: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
    progInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    progBadge: { backgroundColor: 'rgba(59, 130, 246, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 15 },
    progBadgeText: { color: '#60a5fa', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
    progDuration: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '500' },
    progFinanceRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 12 },
    financeLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 },
    financeValue: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    emptyProgText: { color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', fontSize: 13, textAlign: 'center', paddingVertical: 10 },

    // Модальное окно инструментов
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
    modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 25, maxHeight: '85%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    closeBtn: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 6, borderRadius: 16 },
    sectionLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 12, marginTop: 10 },
    sortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
    sortBtn: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    sortBtnActive: { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3b82f6' },
    sortBtnText: { color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: 13 },
    applyBtn: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 30 },
    applyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    syncBtn: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 15 },
    syncBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 }
});