// app/(app)/catalog.tsx
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, LayoutAnimation, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, UIManager, View } from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Colors, Layout } from '../../constants/theme';
import apiClient from '../../src/api/apiClient';
import { getToken, saveToken } from '../../src/utils/storage';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Утилита для нечеткого поиска
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
    const [universities, setUniversities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [expandedProgId, setExpandedProgId] = useState<number | string | null>(null);
    
    // Поиск
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [showTools, setShowTools] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState('');
    const [sortMethod, setSortMethod] = useState('name_asc');
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

    // Debounce для поиска: ждем 400мс после ввода, чтобы не лагало
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedQuery(searchQuery);
            setVisibleCount(20); // сбрасываем пагинацию при новом поиске
        }, 400);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    useEffect(() => {
        setVisibleCount(20);
    }, [selectedCountry, sortMethod]);

    const forceSyncData = async () => {
        setSyncing(true);
        try {
            const res = await apiClient.get('catalog/universities/');
            const data = res.data.results || res.data;
            setUniversities(data);
            await saveToken('cache_universities', JSON.stringify(data));
            Alert.alert("Успешно", "База данных обновлена");
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

    const uniqueCountries = useMemo(() => Array.from(new Set(universities.map(u => u.country))).filter(Boolean), [universities]);

    // МЕМОИЗАЦИЯ 1: Единожды распаковываем ВУЗы
    const allPrograms = useMemo(() => {
        let display: any[] = [];
        universities.forEach(uni => {
            if (uni.programs && uni.programs.length > 0) {
                uni.programs.forEach((prog: any) => {
                    display.push({ ...prog, uni: uni });
                });
            }
        });
        return display;
    }, [universities]);

    // МЕМОИЗАЦИЯ 2: Фильтрация и сортировка (зависит от Debounced запроса)
    const filteredPrograms = useMemo(() => {
        let result = allPrograms;

        if (selectedCountry) {
            result = result.filter(prog => prog.uni.country === selectedCountry);
        }
        
        if (debouncedQuery) {
            result = result.filter(prog => 
                isFuzzyMatch(prog.name, debouncedQuery) || 
                isFuzzyMatch(prog.uni.name, debouncedQuery) || 
                isFuzzyMatch(prog.uni.city, debouncedQuery)
            );
        }

        result.sort((a, b) => {
            if (sortMethod === 'name_asc') return a.name.localeCompare(b.name);
            if (sortMethod === 'name_desc') return b.name.localeCompare(a.name);
            const priceA = parseFloat(a.tuition_fee) || 0;
            const priceB = parseFloat(b.tuition_fee) || 0;
            if (sortMethod === 'price_asc') return priceA - priceB;
            if (sortMethod === 'price_desc') return priceB - priceA;
            return 0;
        });

        return result;
    }, [allPrograms, selectedCountry, debouncedQuery, sortMethod]);

    const paginatedPrograms = useMemo(() => filteredPrograms.slice(0, visibleCount), [filteredPrograms, visibleCount]);

    const loadMore = () => {
        if (visibleCount < filteredPrograms.length) {
            setVisibleCount(prev => prev + 20);
        }
    };

    const renderProgramCard = ({ item: prog }: { item: any }) => {
        const isExpanded = expandedProgId === prog.id;
        
        return (
            <View style={styles.progWrapper}>
                <TouchableOpacity activeOpacity={0.8} onPress={() => toggleExpand(prog.id)}>
                    <View style={[styles.progCard, isExpanded && styles.progCardExpanded]}>
                        <View style={styles.progHeader}>
                            <View style={{flex: 1, paddingRight: 10}}>
                                <Text style={styles.progName}>{prog.name}</Text>
                                <View style={styles.progTagsRow}>
                                    <View style={styles.progBadge}>
                                        <Text style={styles.progBadgeText}>{degreeMap[prog.degree] || prog.degree}</Text>
                                    </View>
                                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                        <Ionicons name="time-outline" size={14} color={Colors.light.textSecondary} style={{marginRight: 4}} />
                                        <Text style={styles.progDuration}>{prog.duration}</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.expandIcon}>
                                <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={Colors.light.primary} />
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
                                <Text style={[styles.financeValue, {color: Colors.light.success}]}>
                                    ${parseFloat(prog.service_fee).toLocaleString()}
                                </Text>
                            </View>
                        </View>

                        {isExpanded && (
                            <View style={styles.expandedUniContainer}>
                                <View style={styles.uniInfoBox}>
                                    <View style={styles.uniIconCircle}>
                                        <Ionicons name="school" size={24} color={Colors.light.primary} />
                                    </View>
                                    <View style={{flex: 1}}>
                                        <Text style={styles.uniNameExpanded}>{prog.uni.name}</Text>
                                        <Text style={styles.uniLocationExpanded}>
                                            <Ionicons name="location-outline" size={12} color={Colors.light.textSecondary} /> {prog.uni.city}, {prog.uni.country}
                                        </Text>
                                    </View>
                                </View>
                                
                                <TouchableOpacity style={styles.detailsBtn} onPress={() => router.push(`/university/${prog.uni.id}` as any)}>
                                    <Ionicons name="document-text-outline" size={18} color="#fff" />
                                    <Text style={styles.detailsBtnText}>Справочник ВУЗа</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    if (loading) return <ScreenWrapper><View style={styles.center}><ActivityIndicator size="large" color={Colors.light.primary} /></View></ScreenWrapper>;

    return (
        <ScreenWrapper>
            <View style={styles.topHeader}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Ionicons name="library" size={28} color={Colors.light.primary} style={{marginRight: 10}} />
                    <Text style={styles.pageTitle}>Каталог</Text>
                </View>
                <TouchableOpacity style={styles.toolsBtn} onPress={() => setShowTools(true)}>
                    <Ionicons name="options" size={22} color={Colors.light.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={Colors.light.textSecondary} />
                <TextInput 
                    style={styles.searchInput} 
                    placeholder="ВУЗ или специальность..." 
                    placeholderTextColor={Colors.light.textSecondary} 
                    value={searchQuery} 
                    onChangeText={setSearchQuery} 
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color={Colors.light.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={paginatedPrograms}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderProgramCard}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={Platform.OS === 'android'}
                refreshControl={<RefreshControl refreshing={syncing} onRefresh={forceSyncData} tintColor={Colors.light.primary} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="folder-open-outline" size={48} color={Colors.light.textSecondary} />
                        <Text style={styles.emptyText}>Ничего не найдено</Text>
                    </View>
                }
                ListFooterComponent={
                    visibleCount < filteredPrograms.length ? (
                        <ActivityIndicator size="small" color={Colors.light.primary} style={{ marginVertical: 20 }} />
                    ) : null
                }
            />

            <Modal visible={showTools} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <BlurView intensity={90} tint="light" style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Фильтры</Text>
                            <TouchableOpacity onPress={() => setShowTools(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color={Colors.light.text} />
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

                            <Text style={styles.sectionLabel}>Страна</Text>
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
    pageTitle: { color: Colors.light.text, fontSize: 28, fontWeight: '900', letterSpacing: 0.5 },
    toolsBtn: { backgroundColor: 'rgba(255,255,255,0.8)', padding: 10, borderRadius: Layout.radius.medium, ...Layout.shadows.light },
    
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: Layout.radius.medium, paddingHorizontal: 15, height: 50, marginBottom: 20, marginHorizontal: 20, ...Layout.shadows.light },
    searchInput: { flex: 1, color: Colors.light.text, marginLeft: 10, fontSize: 16, fontWeight: '500', outlineStyle: 'none' },
    
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
    emptyText: { color: Colors.light.textSecondary, textAlign: 'center', marginTop: 15, fontSize: 16, fontWeight: '600' },
    
    progWrapper: { marginBottom: 15 },
    progCard: { padding: 20, borderRadius: Layout.radius.large, backgroundColor: '#FFFFFF', ...Layout.shadows.light },
    progCardExpanded: { borderWidth: 1, borderColor: Colors.light.primary },
    
    progHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
    progName: { color: Colors.light.text, fontSize: 18, fontWeight: '800', marginBottom: 8, lineHeight: 22 },
    progTagsRow: { flexDirection: 'row', alignItems: 'center' },
    progBadge: { backgroundColor: 'rgba(0, 122, 255, 0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 15 },
    progBadgeText: { color: Colors.light.primary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
    progDuration: { color: Colors.light.textSecondary, fontSize: 13, fontWeight: '600' },
    expandIcon: { backgroundColor: '#F2F2F7', padding: 8, borderRadius: 12 },
    
    progFinanceRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.light.border, paddingTop: 15 },
    financeLabel: { color: Colors.light.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
    financeValue: { color: Colors.light.text, fontWeight: '900', fontSize: 16 },

    expandedUniContainer: { marginTop: 20, borderTopWidth: 1, borderTopColor: Colors.light.border, paddingTop: 20 },
    uniInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', padding: 15, borderRadius: Layout.radius.medium, marginBottom: 15 },
    uniIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0, 122, 255, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    uniNameExpanded: { color: Colors.light.text, fontSize: 15, fontWeight: '800', marginBottom: 2 },
    uniLocationExpanded: { color: Colors.light.textSecondary, fontSize: 13, fontWeight: '500' },

    detailsBtn: { flexDirection: 'row', backgroundColor: Colors.light.primary, paddingVertical: 14, borderRadius: Layout.radius.medium, justifyContent: 'center', alignItems: 'center', ...Layout.shadows.medium },
    detailsBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, marginLeft: 8 },

    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '90%', backgroundColor: 'rgba(255, 255, 255, 0.95)' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    modalTitle: { color: Colors.light.text, fontSize: 22, fontWeight: '900' },
    closeBtn: { backgroundColor: '#F2F2F7', padding: 8, borderRadius: 16 },
    sectionLabel: { color: Colors.light.textSecondary, fontSize: 12, textTransform: 'uppercase', fontWeight: '800', marginBottom: 12, marginTop: 10 },
    sortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
    sortBtn: { backgroundColor: '#F2F2F7', paddingHorizontal: 16, paddingVertical: 12, borderRadius: Layout.radius.small },
    sortBtnActive: { backgroundColor: Colors.light.primary },
    sortBtnText: { color: Colors.light.text, fontWeight: '600', fontSize: 13 },
    applyBtn: { backgroundColor: Colors.light.primary, padding: 16, borderRadius: Layout.radius.medium, alignItems: 'center', marginTop: 20, ...Layout.shadows.medium },
    applyBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 }
});