// app/(app)/tasks.tsx
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, Animated, KeyboardAvoidingView,
    Modal, Platform, RefreshControl, ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import apiClient from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import { getToken, saveToken } from '../../src/utils/storage';

type Status   = 'todo' | 'process' | 'done';
type Priority = 'low'  | 'medium'  | 'high';

const STATUS_META: Record<Status, { label: string; color: string; icon: string }> = {
    todo:    { label: 'Надо сделать', color: '#94A3B8', icon: 'ellipse-outline'  },
    process: { label: 'В работе',     color: '#3b82f6', icon: 'sync-outline'     },
    done:    { label: 'Готово',       color: '#10b981', icon: 'checkmark-circle' },
};
const PRIORITY_META: Record<Priority, { color: string; label: string }> = {
    low:    { color: '#10b981', label: 'Низкий'  },
    medium: { color: '#f59e0b', label: 'Средний' },
    high:   { color: '#ef4444', label: 'Высокий' },
};

const EMPTY_FORM = { id: '', title: '', description: '', priority: 'medium' as Priority, status: 'todo' as Status };

export default function TasksScreen() {
    const { theme }     = useTheme();
    const router        = useRouter();
    const s             = makeStyles(theme);
    const [tasks,       setTasks]       = useState<any[]>([]);
    const [loading,     setLoading]     = useState(true);
    const [refreshing,  setRefreshing]  = useState(false);
    const [modalOpen,   setModalOpen]   = useState(false);
    const [saving,      setSaving]      = useState(false);
    const [form,        setForm]        = useState({ ...EMPTY_FORM });
    const [deadline,    setDeadline]    = useState<Date | null>(null);
    const [showPicker,  setShowPicker]  = useState(false);
    const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
    const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
    const selMode = selectedIds.size > 0;

    // Анимация FAB
    const fabAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.spring(fabAnim, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
    }, []);

    const load = async () => {
        try {
            const res  = await apiClient.get('tasks/');
            const srv  = res.data.results ?? res.data;
            // Объединяем с офлайн-задачами
            const raw  = await getToken('offline_tasks');
            const off  = raw ? JSON.parse(raw) : [];
            let merged = [...srv];
            off.forEach((ot: any) => {
                if (ot._offlineAction === 'CREATE') merged.push(ot);
                else if (ot._offlineAction === 'UPDATE') {
                    const idx = merged.findIndex(t => t.id === ot.id);
                    if (idx > -1) merged[idx] = { ...merged[idx], ...ot };
                } else if (ot._offlineAction === 'DELETE') {
                    merged = merged.filter(t => t.id !== ot.id);
                }
            });
            setTasks(merged);
        } catch {
            const raw = await getToken('offline_tasks');
            if (raw) setTasks(JSON.parse(raw));
        } finally { setLoading(false); setRefreshing(false); }
    };

    useEffect(() => { load(); }, []);

    const openCreate = () => { setForm({ ...EMPTY_FORM }); setDeadline(null); setModalOpen(true); };
    const openEdit   = (t: any) => {
        setForm({ id: t.id, title: t.title ?? '', description: t.description ?? '', priority: t.priority ?? 'medium', status: t.status ?? 'todo' });
        setDeadline(t.deadline ? new Date(t.deadline) : null);
        setModalOpen(true);
    };

    const saveTask = async () => {
        if (!form.title.trim()) return Alert.alert('Ошибка', 'Введите заголовок задачи');
        setSaving(true);
        const payload = {
            title:       form.title.trim(),
            description: form.description,
            priority:    form.priority,
            status:      form.status,
            deadline:    deadline ? deadline.toISOString() : null,
        };
        try {
            if (form.id) {
                await apiClient.patch(`tasks/${form.id}/`, payload);
            } else {
                await apiClient.post('tasks/', payload);
            }
            setModalOpen(false);
            load();
        } catch {
            // Офлайн
            const raw = await getToken('offline_tasks');
            const off = raw ? JSON.parse(raw) : [];
            if (form.id) {
                const idx = off.findIndex((t: any) => t.id === form.id);
                if (idx > -1) off[idx] = { ...off[idx], ...payload, _offlineAction: 'UPDATE' };
                else off.push({ ...payload, id: form.id, _offlineAction: 'UPDATE', isOffline: true });
            } else {
                off.push({ ...payload, id: `temp_${Date.now()}`, _offlineAction: 'CREATE', isOffline: true });
            }
            await saveToken('offline_tasks', JSON.stringify(off));
            setModalOpen(false);
            load();
        } finally { setSaving(false); }
    };

    const deleteTask = async (id: string | number) => {
        Alert.alert('Удалить задачу?', '', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Удалить', style: 'destructive',
                onPress: async () => {
                    try {
                        if (String(id).startsWith('temp_')) throw new Error('offline');
                        await apiClient.delete(`tasks/${id}/`);
                    } catch {
                        const raw = await getToken('offline_tasks');
                        const off = raw ? JSON.parse(raw) : [];
                        const idx = off.findIndex((t: any) => t.id === id);
                        if (idx > -1) off[idx]._offlineAction = 'DELETE';
                        else off.push({ id, _offlineAction: 'DELETE' });
                        await saveToken('offline_tasks', JSON.stringify(off));
                    }
                    load();
                },
            },
        ]);
    };

    const batchDone = async () => {
        for (const id of selectedIds) {
            try {
                await apiClient.patch(`tasks/${id}/`, { status: 'done' });
            } catch {
                const raw = await getToken('offline_tasks');
                const off = raw ? JSON.parse(raw) : [];
                const idx = off.findIndex((t: any) => t.id === id);
                if (idx > -1) { off[idx].status = 'done'; off[idx]._offlineAction = 'UPDATE'; }
                else off.push({ id, status: 'done', _offlineAction: 'UPDATE' });
                await saveToken('offline_tasks', JSON.stringify(off));
            }
        }
        setSelectedIds(new Set());
        load();
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };

    const filteredTasks = tasks.filter(t =>
        filterStatus === 'all' ? true : t.status === filterStatus
    );
    const grouped = (['todo', 'process', 'done'] as Status[]).map(st => ({
        status:  st,
        tasks:   filteredTasks.filter(t => t.status === st),
    }));

    if (loading) return (
        <ScreenWrapper>
            <View style={s.center}><ActivityIndicator size="large" color={theme.primaryDeep} /></View>
        </ScreenWrapper>
    );

    return (
        <ScreenWrapper>
            {/* Шапка */}
            <View style={s.header}>
                <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[s.headerTitle, { color: theme.text }]}>Задачи</Text>
                <TouchableOpacity style={[s.addBtn, { backgroundColor: theme.primaryDeep }]} onPress={openCreate}>
                    <Ionicons name="add" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Фильтры статуса */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={s.filterScroll} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
            >
                {(['all', 'todo', 'process', 'done'] as const).map(st => {
                    const active = filterStatus === st;
                    const color  = st === 'all' ? theme.primary : STATUS_META[st].color;
                    const count  = st === 'all' ? tasks.length : tasks.filter(t => t.status === st).length;
                    return (
                        <TouchableOpacity key={st}
                            style={[s.filterChip, { backgroundColor: active ? color : theme.bgChip, borderColor: active ? color : theme.border }]}
                            onPress={() => setFilterStatus(st)}
                        >
                            {st !== 'all' && <Ionicons name={STATUS_META[st].icon as any} size={13} color={active ? '#fff' : color} />}
                            <Text style={[s.filterChipText, { color: active ? '#fff' : theme.textSub }]}>
                                {st === 'all' ? 'Все' : STATUS_META[st].label}
                            </Text>
                            <View style={[s.chipCount, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : theme.border }]}>
                                <Text style={[s.chipCountText, { color: active ? '#fff' : theme.textSub }]}>{count}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Список */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.container}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />
                }
            >
                {grouped.map(({ status: st, tasks: list }) => {
                    if (list.length === 0 && filterStatus !== 'all') return null;
                    if (list.length === 0) return null;
                    const meta = STATUS_META[st];
                    return (
                        <View key={st} style={s.group}>
                            <View style={s.groupHeader}>
                                <Ionicons name={meta.icon as any} size={16} color={meta.color} />
                                <Text style={[s.groupTitle, { color: meta.color }]}>
                                    {meta.label}
                                </Text>
                                <Text style={[s.groupCount, { color: theme.textMuted }]}>{list.length}</Text>
                            </View>

                            {list.map(t => {
                                const pMeta    = PRIORITY_META[t.priority as Priority] ?? PRIORITY_META.medium;
                                const dl       = t.deadline ? new Date(t.deadline) : null;
                                const expired  = dl && dl < new Date() && t.status !== 'done';
                                const soon     = dl && dl > new Date() && t.status !== 'done';
                                const selected = selectedIds.has(String(t.id));

                                return (
                                    <TouchableOpacity key={t.id} activeOpacity={0.85}
                                        onPress={() => selMode ? toggleSelect(String(t.id)) : openEdit(t)}
                                        onLongPress={() => toggleSelect(String(t.id))}
                                    >
                                        <BlurView intensity={50} tint={theme.mode === 'dark' ? 'dark' : 'light'}
                                            style={[
                                                s.taskCard,
                                                { borderColor: selected ? theme.primaryDeep : theme.borderGlass },
                                                selected && s.taskCardSelected,
                                            ]}
                                        >
                                            {/* Полоска приоритета */}
                                            <View style={[s.priorityBar, { backgroundColor: pMeta.color }]} />

                                            <View style={s.taskBody}>
                                                <View style={s.taskTop}>
                                                    <Text style={[
                                                        s.taskTitle,
                                                        { color: theme.text },
                                                        t.status === 'done' && s.taskTitleDone,
                                                    ]} numberOfLines={2}>
                                                        {t.title}
                                                    </Text>
                                                    <TouchableOpacity onPress={() => deleteTask(t.id)} hitSlop={12}>
                                                        <Ionicons name="trash-outline" size={16} color={theme.danger} />
                                                    </TouchableOpacity>
                                                </View>

                                                {t.description ? (
                                                    <Text style={[s.taskDesc, { color: theme.textSub }]} numberOfLines={2}>
                                                        {t.description.replace(/<[^>]*>/g, '')}
                                                    </Text>
                                                ) : null}

                                                <View style={s.taskMeta}>
                                                    <View style={[s.priorityPill, { backgroundColor: pMeta.color + '20' }]}>
                                                        <Text style={[s.priorityPillText, { color: pMeta.color }]}>
                                                            {pMeta.label}
                                                        </Text>
                                                    </View>
                                                    {dl && (
                                                        <View style={s.dlRow}>
                                                            <Ionicons
                                                                name={soon ? 'notifications' : 'time-outline'}
                                                                size={12}
                                                                color={expired ? theme.danger : soon ? theme.accent : theme.textMuted}
                                                            />
                                                            <Text style={[s.dlText, { color: expired ? theme.danger : soon ? theme.accent : theme.textMuted }]}>
                                                                {dl.toLocaleDateString()} {String(dl.getHours()).padStart(2,'0')}:{String(dl.getMinutes()).padStart(2,'0')}
                                                            </Text>
                                                        </View>
                                                    )}
                                                    {t.isOffline && (
                                                        <Ionicons name="cloud-offline-outline" size={14} color={theme.warning} />
                                                    )}
                                                </View>
                                            </View>
                                        </BlurView>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    );
                })}

                {filteredTasks.length === 0 && (
                    <View style={s.empty}>
                        <Ionicons name="checkmark-done-circle-outline" size={52} color={theme.textMuted} />
                        <Text style={[s.emptyText, { color: theme.textMuted }]}>Задач нет</Text>
                        <TouchableOpacity style={[s.emptyBtn, { backgroundColor: theme.primaryDeep }]} onPress={openCreate}>
                            <Text style={s.emptyBtnText}>Создать первую задачу</Text>
                        </TouchableOpacity>
                    </View>
                )}
                <View style={{ height: 20 }} />
            </ScrollView>

            {/* Панель выбора */}
            {selMode && (
                <BlurView intensity={80} tint="dark" style={s.batchBar}>
                    <Text style={s.batchCount}>{selectedIds.size} выбрано</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity style={[s.batchBtn, { backgroundColor: theme.accent }]} onPress={batchDone}>
                            <Ionicons name="checkmark" size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.batchBtn, { backgroundColor: theme.danger }]}
                            onPress={() => {
                                Alert.alert('Удалить?', `${selectedIds.size} задач(и)`, [
                                    { text: 'Отмена', style: 'cancel' },
                                    { text: 'Удалить', style: 'destructive', onPress: async () => {
                                        for (const id of selectedIds) await deleteTask(id);
                                        setSelectedIds(new Set());
                                    }},
                                ]);
                            }}
                        >
                            <Ionicons name="trash" size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.batchBtn, { backgroundColor: theme.bgChip }]}
                            onPress={() => setSelectedIds(new Set())}
                        >
                            <Ionicons name="close" size={20} color={theme.text} />
                        </TouchableOpacity>
                    </View>
                </BlurView>
            )}

            {/* Модалка создания/редактирования */}
            <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
                    <BlurView intensity={90} tint={theme.mode === 'dark' ? 'dark' : 'light'}
                        style={[s.modalContent, { backgroundColor: theme.bgGlass }]}
                    >
                        <View style={s.modalHeader}>
                            <Text style={[s.modalTitle, { color: theme.text }]}>
                                {form.id ? 'Редактировать' : 'Новая задача'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalOpen(false)}>
                                <Ionicons name="close-circle" size={28} color={theme.textSub} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            {/* Заголовок */}
                            <Text style={[s.fieldLabel, { color: theme.textSub }]}>Заголовок *</Text>
                            <TextInput
                                style={[s.fieldInput, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
                                placeholder="Что нужно сделать?"
                                placeholderTextColor={theme.textMuted}
                                value={form.title}
                                onChangeText={v => setForm(f => ({ ...f, title: v }))}
                            />

                            {/* Описание */}
                            <Text style={[s.fieldLabel, { color: theme.textSub }]}>Описание</Text>
                            <TextInput
                                style={[s.fieldInput, s.fieldTextarea, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]}
                                placeholder="Детали задачи..."
                                placeholderTextColor={theme.textMuted}
                                value={form.description}
                                onChangeText={v => setForm(f => ({ ...f, description: v }))}
                                multiline
                            />

                            {/* Дедлайн */}
                            <Text style={[s.fieldLabel, { color: theme.textSub }]}>Дедлайн</Text>
                            <TouchableOpacity
                                style={[s.fieldInput, s.deadlineRow, { backgroundColor: theme.bgInput, borderColor: theme.border }]}
                                onPress={() => setShowPicker(true)}
                            >
                                <Ionicons name="calendar-outline" size={18} color={deadline ? theme.primary : theme.textMuted} />
                                <Text style={{ flex: 1, marginLeft: 10, color: deadline ? theme.text : theme.textMuted, fontWeight: '700', fontSize: 15 }}>
                                    {deadline
                                        ? `${deadline.toLocaleDateString()} ${String(deadline.getHours()).padStart(2,'0')}:${String(deadline.getMinutes()).padStart(2,'0')}`
                                        : 'Без дедлайна'
                                    }
                                </Text>
                                {deadline && (
                                    <TouchableOpacity onPress={() => setDeadline(null)}>
                                        <Ionicons name="close-circle" size={18} color={theme.danger} />
                                    </TouchableOpacity>
                                )}
                            </TouchableOpacity>
                            {showPicker && (
                                <DateTimePicker
                                    value={deadline ?? new Date()}
                                    mode="datetime"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(_, d) => {
                                        if (Platform.OS === 'android') setShowPicker(false);
                                        if (d) setDeadline(d);
                                    }}
                                    textColor={theme.text}
                                />
                            )}
                            {showPicker && Platform.OS === 'ios' && (
                                <TouchableOpacity style={[s.pickerDone, { backgroundColor: theme.primaryDeep }]} onPress={() => setShowPicker(false)}>
                                    <Text style={{ color: '#fff', fontWeight: '900' }}>Готово</Text>
                                </TouchableOpacity>
                            )}

                            {/* Приоритет */}
                            <Text style={[s.fieldLabel, { color: theme.textSub }]}>Приоритет</Text>
                            <View style={s.chipRow}>
                                {(['low', 'medium', 'high'] as Priority[]).map(p => {
                                    const pm = PRIORITY_META[p];
                                    const active = form.priority === p;
                                    return (
                                        <TouchableOpacity key={p}
                                            style={[s.selChip, { backgroundColor: active ? pm.color : theme.bgChip, borderColor: active ? pm.color : theme.border }]}
                                            onPress={() => setForm(f => ({ ...f, priority: p }))}
                                        >
                                            <Text style={[s.selChipText, { color: active ? '#fff' : theme.textSub }]}>{pm.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Статус */}
                            <Text style={[s.fieldLabel, { color: theme.textSub }]}>Статус</Text>
                            <View style={s.chipRow}>
                                {(['todo', 'process', 'done'] as Status[]).map(st => {
                                    const sm = STATUS_META[st];
                                    const active = form.status === st;
                                    return (
                                        <TouchableOpacity key={st}
                                            style={[s.selChip, { backgroundColor: active ? sm.color : theme.bgChip, borderColor: active ? sm.color : theme.border }]}
                                            onPress={() => setForm(f => ({ ...f, status: st }))}
                                        >
                                            <Text style={[s.selChipText, { color: active ? '#fff' : theme.textSub }]}>{sm.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.primaryDeep }]}
                                onPress={saveTask} disabled={saving}
                            >
                                {saving
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={s.saveBtnText}>{form.id ? 'Сохранить' : 'Создать задачу'}</Text>
                                }
                            </TouchableOpacity>
                            <View style={{ height: 30 }} />
                        </ScrollView>
                    </BlurView>
                </KeyboardAvoidingView>
            </Modal>
        </ScreenWrapper>
    );
}

function makeStyles(t: any) {
    return StyleSheet.create({
        center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
        container: { paddingHorizontal: 20, paddingBottom: 20 },
        header: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10,
        },
        backBtn:     { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
        headerTitle: { fontSize: 20, fontWeight: '900' },
        addBtn:      { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

        filterScroll: { marginBottom: 14, flexGrow: 0 },
        filterChip:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, gap: 5 },
        filterChipText: { fontSize: 12, fontWeight: '800' },
        chipCount:    { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
        chipCountText: { fontSize: 10, fontWeight: '900' },

        group:       { marginBottom: 8 },
        groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 16 },
        groupTitle:  { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, flex: 1 },
        groupCount:  { fontSize: 12, fontWeight: '700' },

        taskCard: {
            flexDirection: 'row', borderRadius: 20, marginBottom: 10,
            borderWidth: 1, overflow: 'hidden',
        },
        taskCardSelected: { shadowColor: '#0D416D', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
        priorityBar: { width: 5 },
        taskBody:    { flex: 1, padding: 14 },
        taskTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
        taskTitle:   { flex: 1, fontSize: 15, fontWeight: '800', lineHeight: 20, marginBottom: 4 },
        taskTitleDone: { textDecorationLine: 'line-through', opacity: 0.5 },
        taskDesc:    { fontSize: 12, fontWeight: '500', lineHeight: 17, marginBottom: 8 },
        taskMeta:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
        priorityPill:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
        priorityPillText: { fontSize: 10, fontWeight: '900' },
        dlRow:       { flexDirection: 'row', alignItems: 'center', gap: 3 },
        dlText:      { fontSize: 11, fontWeight: '700' },

        empty:       { alignItems: 'center', paddingTop: 60 },
        emptyText:   { marginTop: 12, fontSize: 15, fontWeight: '600', fontStyle: 'italic', marginBottom: 20 },
        emptyBtn:    { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
        emptyBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },

        batchBar: {
            position: 'absolute', bottom: 30, left: 20, right: 20,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            padding: 16, paddingHorizontal: 22, borderRadius: 28,
            backgroundColor: 'rgba(15,23,42,0.9)', overflow: 'hidden',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        },
        batchCount: { color: '#fff', fontWeight: '900', fontSize: 15 },
        batchBtn:   { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

        modalOverlay:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.5)' },
        modalContent:  { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 26, maxHeight: '92%', overflow: 'hidden' },
        modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
        modalTitle:    { fontSize: 21, fontWeight: '900' },
        fieldLabel:    { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7, marginLeft: 4 },
        fieldInput:    { borderRadius: 16, paddingHorizontal: 16, height: 52, fontSize: 15, fontWeight: '700', borderWidth: 1, marginBottom: 18 },
        fieldTextarea: { height: 90, textAlignVertical: 'top', paddingTop: 14 },
        deadlineRow:   { flexDirection: 'row', alignItems: 'center' },
        pickerDone:    { alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 16 },
        chipRow:       { flexDirection: 'row', gap: 8, marginBottom: 18, flexWrap: 'wrap' },
        selChip:       { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
        selChipText:   { fontSize: 13, fontWeight: '800' },
        saveBtn:       { paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 6 },
        saveBtnText:   { color: '#fff', fontWeight: '900', fontSize: 15 },
    });
}