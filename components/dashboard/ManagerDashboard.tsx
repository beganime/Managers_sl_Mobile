import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';

import LeadCard, { LeadItem, LeadStatus } from '../../components/dashboard/LeadCard';
import { CurrentUser } from '../../hooks/useCurrentUser';
import apiClient, { fetchAllPages } from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import { getToken, saveToken } from '../../src/utils/storage';
import ScreenWrapper from '../ScreenWrapper';

interface Props {
  user: CurrentUser;
  onRefresh: () => void;
}

type LocalNote = {
  id: string;
  title: string;
  body?: string;
  is_pinned?: boolean;
  created_at: string;
  updated_at: string;
};

type OfficeDashboardData = {
  office: {
    id: number;
    city?: string;
    address?: string;
    phone?: string;
  };
  total_income_usd?: string | number;
  total_expense_usd?: string | number;
  net_usd?: string | number;
  monthly_revenue_usd?: string | number;
  monthly_plan_usd?: string | number;
  plan_progress_percent?: string | number;
  managers?: {
    id: number;
    full_name?: string;
    email?: string;
    revenue_usd?: string | number;
    plan_usd?: string | number;
    progress_percent?: string | number;
  }[];
};

type QuickOfficeEntryType = 'income' | 'expense';

const LOCAL_NOTES_KEY = 'manager_dashboard_notes_v2';

const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'converted', 'rejected'];

const PREMIUM_TEXT = '#231F3A';
const PREMIUM_MUTED = '#766F91';
const GREEN = '#1AAE6F';
const RED = '#EF4444';
const ORANGE = '#F59E0B';
const PURPLE = '#7B61FF';
const BLUE = '#3A7AFE';

function money(v: number) {
  return `$${Math.round(v || 0).toLocaleString('ru-RU')}`;
}

function compactMoney(v: number) {
  const value = Number(v || 0);

  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }

  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }

  return money(value);
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isMineOrShared(client: any, userId: number) {
  if (!client) return false;
  if (client.manager === userId) return true;

  if (Array.isArray(client.shared_with) && client.shared_with.includes(userId)) {
    return true;
  }

  if (
    Array.isArray(client.shared_with_data) &&
    client.shared_with_data.some((u: any) => u.id === userId)
  ) {
    return true;
  }

  return false;
}

function sortNotes(items: LocalNote[]) {
  return [...items].sort((a, b) => {
    if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

function statusTitle(status: LeadStatus) {
  switch (status) {
    case 'new':
      return 'Новая';
    case 'contacted':
      return 'В работе';
    case 'converted':
      return 'Клиент';
    case 'rejected':
      return 'Отказ';
    default:
      return status;
  }
}

function directionTitle(direction?: string) {
  if (!direction) return '—';

  const map: Record<string, string> = {
    admission: 'Поступление',
    translation: 'Переводы',
    umrah: 'Умра / Хадж',
    visa: 'Виза',
    tickets: 'Билеты',
    tours: 'Туры',
    work_visa: 'Рабочая виза',
  };

  return map[direction] || direction;
}

function employeeInitials(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);

  if (!parts.length) return 'SL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function balanceColor(value: number, positive = GREEN, negative = RED) {
  return value >= 0 ? positive : negative;
}

function MiniIcon({
  icon,
  tint,
  bg,
  size = 38,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  bg: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.iconBubble,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size / 2.7),
          backgroundColor: bg,
        },
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={tint} />
    </View>
  );
}

function EmployeeAvatar({ name }: { name: string }) {
  return (
    <LinearGradient
      colors={['rgba(123,97,255,0.22)', 'rgba(58,122,254,0.12)']}
      style={styles.employeeAvatar}
    >
      <Text style={styles.employeeAvatarText}>{employeeInitials(name)}</Text>
    </LinearGradient>
  );
}

function InfoRow({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: any;
}) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: theme.divider || theme.border }]}>
      <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

export default function ManagerDashboard({ user, onRefresh }: Props) {
  const { theme } = useTheme();
  const router = useRouter();

  const POSITIVE = theme.success || GREEN;
  const NEGATIVE = theme.red || RED;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [hasReport, setHasReport] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const [officeDashboard, setOfficeDashboard] = useState<OfficeDashboardData | null>(null);
  const [officeEntryOpen, setOfficeEntryOpen] = useState(false);
  const [officeEntryType, setOfficeEntryType] = useState<QuickOfficeEntryType>('income');
  const [officeEntryTitle, setOfficeEntryTitle] = useState('');
  const [officeEntryAmount, setOfficeEntryAmount] = useState('');
  const [officeEntryComment, setOfficeEntryComment] = useState('');
  const [officeEntrySaving, setOfficeEntrySaving] = useState(false);

  const [officeExpanded, setOfficeExpanded] = useState(false);
  const [leadsExpanded, setLeadsExpanded] = useState(true);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [clientsExpanded, setClientsExpanded] = useState(false);

  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadSaving, setLeadSaving] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteForm, setNoteForm] = useState<LocalNote>({
    id: '',
    title: '',
    body: '',
    is_pinned: false,
    created_at: '',
    updated_at: '',
  });

  const readLocalNotes = useCallback(async () => {
    try {
      const raw = await getToken(LOCAL_NOTES_KEY);
      return raw ? (JSON.parse(raw) as LocalNote[]) : [];
    } catch {
      return [];
    }
  }, []);

  const persistNotes = useCallback(async (items: LocalNote[]) => {
    const sorted = sortNotes(items);
    setNotes(sorted);
    await saveToken(LOCAL_NOTES_KEY, JSON.stringify(sorted));
  }, []);

  const load = useCallback(async () => {
    try {
      const [storedNotes, clientsResponse, reportResponse, leadsResponse, officeDashboardResponse] =
        await Promise.all([
          readLocalNotes(),
          fetchAllPages('clients/').catch(() => []),
          apiClient.get('reports/daily/today/').catch(() => null),
          fetchAllPages('leads/mobile/').catch(() => []),
          apiClient.get('users/users/me/office_dashboard/').catch(() => null),
        ]);

      const myClients = (clientsResponse || [])
        .filter((c: any) => isMineOrShared(c, user.id))
        .slice(0, 8);

      setNotes(sortNotes(storedNotes));
      setClients(myClients);
      setHasReport(!!reportResponse?.data);
      setLeads((leadsResponse || []).slice(0, 12));
      setOfficeDashboard((officeDashboardResponse?.data || null) as OfficeDashboardData | null);
    } catch (e) {
      console.log('Manager dashboard load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [readLocalNotes, user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const revenue = useMemo(
    () => parseFloat(String(user.managersalary?.current_month_revenue || 0)),
    [user.managersalary]
  );

  const plan = useMemo(
    () => parseFloat(String(user.managersalary?.monthly_plan || 0)),
    [user.managersalary]
  );

  const balance = useMemo(
    () => parseFloat(String(user.managersalary?.current_balance || 0)),
    [user.managersalary]
  );

  const progress = plan > 0 ? Math.min(Math.round((revenue / plan) * 100), 100) : 0;

  const officeIncome = useMemo(() => num(officeDashboard?.total_income_usd), [officeDashboard]);

  const officeExpense = useMemo(() => num(officeDashboard?.total_expense_usd), [officeDashboard]);

  const officeNet = useMemo(() => num(officeDashboard?.net_usd), [officeDashboard]);

  const officePlan = useMemo(() => num(officeDashboard?.monthly_plan_usd), [officeDashboard]);

  const officeRevenue = useMemo(
    () => num(officeDashboard?.monthly_revenue_usd),
    [officeDashboard]
  );

  const officeProgress = useMemo(
    () => Math.min(num(officeDashboard?.plan_progress_percent), 100),
    [officeDashboard]
  );

  const officeManagers = useMemo(() => {
    return [...(officeDashboard?.managers || [])].sort(
      (a, b) => num(b.progress_percent) - num(a.progress_percent)
    );
  }, [officeDashboard]);

  const leadStats = useMemo(() => {
    const total = leads.length;
    const fresh = leads.filter((l) => l.status === 'new').length;
    const inWork = leads.filter((l) => l.status === 'contacted').length;
    const converted = leads.filter((l) => l.status === 'converted').length;
    const rejected = leads.filter((l) => l.status === 'rejected').length;

    return {
      total,
      fresh,
      inWork,
      converted,
      rejected,
    };
  }, [leads]);

  const topOfficeManagers = useMemo(() => {
    return officeManagers.slice(0, 3);
  }, [officeManagers]);

  const openCreateNote = () => {
    const now = new Date().toISOString();

    setNoteForm({
      id: '',
      title: '',
      body: '',
      is_pinned: false,
      created_at: now,
      updated_at: now,
    });

    setNoteModalOpen(true);
  };

  const openEditNote = (note: LocalNote) => {
    setNoteForm({ ...note });
    setNoteModalOpen(true);
  };

  const saveNote = async () => {
    if (!noteForm.title.trim()) {
      Alert.alert('Ошибка', 'Название заметки обязательно.');
      return;
    }

    const current = await readLocalNotes();
    const now = new Date().toISOString();

    if (noteForm.id) {
      const updated = current.map((item) =>
        item.id === noteForm.id
          ? {
              ...item,
              title: noteForm.title.trim(),
              body: noteForm.body?.trim() || '',
              is_pinned: !!noteForm.is_pinned,
              updated_at: now,
            }
          : item
      );

      await persistNotes(updated);
    } else {
      const created: LocalNote = {
        id: `note_${Date.now()}`,
        title: noteForm.title.trim(),
        body: noteForm.body?.trim() || '',
        is_pinned: !!noteForm.is_pinned,
        created_at: now,
        updated_at: now,
      };

      await persistNotes([created, ...current]);
    }

    setNoteModalOpen(false);
  };

  const togglePinNote = async (note: LocalNote) => {
    const current = await readLocalNotes();

    const updated = current.map((item) =>
      item.id === note.id
        ? {
            ...item,
            is_pinned: !item.is_pinned,
            updated_at: new Date().toISOString(),
          }
        : item
    );

    await persistNotes(updated);
  };

  const removeNote = async (note: LocalNote) => {
    Alert.alert('Удаление', `Удалить заметку "${note.title}"?`, [
      {
        text: 'Отмена',
        style: 'cancel',
      },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          const current = await readLocalNotes();
          await persistNotes(current.filter((item) => item.id !== note.id));
        },
      },
    ]);
  };

  const renderDeleteAction = (note: LocalNote) => (
    <Pressable onPress={() => removeNote(note)} style={styles.swipeDelete}>
      <Ionicons name="trash-outline" size={20} color="#fff" />
      <Text style={styles.swipeText}>Удалить</Text>
    </Pressable>
  );

  const renderPinAction = (note: LocalNote) => (
    <Pressable
      onPress={() => togglePinNote(note)}
      style={[
        styles.swipePin,
        {
          backgroundColor: note.is_pinned ? '#8B8FA3' : theme.blue,
        },
      ]}
    >
      <Ionicons name={note.is_pinned ? 'pin' : 'pin-outline'} size={20} color="#fff" />
      <Text style={styles.swipeText}>{note.is_pinned ? 'Открепить' : 'Закрепить'}</Text>
    </Pressable>
  );

  const patchLead = useCallback(async (leadId: number, payload: Partial<LeadItem>) => {
    const response = await apiClient.patch(`leads/mobile/${leadId}/`, payload);
    return response.data as LeadItem;
  }, []);

  const updateLeadInList = useCallback((updatedLead: LeadItem) => {
    setLeads((prev) =>
      prev.map((item) => (item.id === updatedLead.id ? { ...item, ...updatedLead } : item))
    );

    setSelectedLead((prev) =>
      prev && prev.id === updatedLead.id ? { ...prev, ...updatedLead } : prev
    );
  }, []);

  const handleOpenLead = useCallback(
    async (lead: LeadItem) => {
      setSelectedLead(lead);
      setLeadModalOpen(true);

      if (lead.status === 'new') {
        try {
          setLeadSaving(true);

          const optimistic: LeadItem = {
            ...lead,
            status: 'contacted',
          };

          updateLeadInList(optimistic);

          const updated = await patchLead(lead.id, {
            status: 'contacted',
          });

          updateLeadInList(updated);
        } catch (e) {
          console.log('Lead auto-contact failed', e);
          updateLeadInList(lead);
          Alert.alert('Ошибка', 'Не удалось автоматически обновить статус заявки.');
        } finally {
          setLeadSaving(false);
        }
      }
    },
    [patchLead, updateLeadInList]
  );

  const handleChangeLeadStatus = useCallback(
    async (status: LeadStatus) => {
      if (!selectedLead) return;

      const prev = selectedLead;

      const optimistic = {
        ...selectedLead,
        status,
      };

      try {
        setLeadSaving(true);
        updateLeadInList(optimistic);

        const updated = await patchLead(selectedLead.id, {
          status,
        });

        updateLeadInList(updated);
      } catch (e) {
        console.log('Lead status update error', e);
        updateLeadInList(prev);
        Alert.alert('Ошибка', 'Не удалось изменить статус заявки.');
      } finally {
        setLeadSaving(false);
      }
    },
    [patchLead, selectedLead, updateLeadInList]
  );

  const openAddClientFromLead = useCallback(() => {
    if (!selectedLead) return;

    setLeadModalOpen(false);

    router.push({
      pathname: '/(app)/add-client',
      params: {
        full_name: selectedLead.full_name || '',
        phone: selectedLead.phone || '',
        email: selectedLead.email || '',
        city: selectedLead.country || '',
        comments: [
          '--- ДАННЫЕ ИЗ ЗАЯВКИ С САЙТА ---',
          `Направление: ${directionTitle(selectedLead.direction)}`,
          `ФИО студента: ${selectedLead.student_name || '-'}`,
          `ФИО родителя: ${selectedLead.parent_name || '-'}`,
          `Возраст: ${selectedLead.age || '-'}`,
          `Образование: ${selectedLead.education || '-'}`,
          `Текущее образование: ${selectedLead.current_education || '-'}`,
          `Текущий университет: ${selectedLead.current_university || '-'}`,
          `Текущая страна: ${selectedLead.current_country || '-'}`,
          `Наличие паспорта: ${selectedLead.has_passport || '-'}`,
          `Срок действия паспорта: ${selectedLead.passport_expiry || '-'}`,
          `Месяц поездки: ${selectedLead.travel_month || '-'}`,
          `Дата поездки: ${selectedLead.travel_date || '-'}`,
          `Город вылета: ${selectedLead.departure_city || '-'}`,
          `Город прибытия: ${selectedLead.arrival_city || '-'}`,
          `Багаж: ${selectedLead.luggage || '-'}`,
        ].join('\n'),
      } as any,
    });
  }, [router, selectedLead]);

  const openOfficeEntry = (type: QuickOfficeEntryType) => {
    if (!officeDashboard?.office?.id) {
      Alert.alert('Нет доступа', 'Для тебя не настроен офисный дашборд.');
      return;
    }

    setOfficeEntryType(type);
    setOfficeEntryTitle(type === 'income' ? 'Доход офиса' : 'Расход офиса');
    setOfficeEntryAmount('');
    setOfficeEntryComment('');
    setOfficeEntryOpen(true);
  };

  const createOfficeEntry = async () => {
    if (!officeDashboard?.office?.id) {
      Alert.alert('Ошибка', 'Офис не найден.');
      return;
    }

    if (!officeEntryTitle.trim()) {
      Alert.alert('Ошибка', 'Укажи название операции.');
      return;
    }

    if (!officeEntryAmount.trim() || Number(officeEntryAmount) <= 0) {
      Alert.alert('Ошибка', 'Сумма должна быть больше нуля.');
      return;
    }

    try {
      setOfficeEntrySaving(true);

      await apiClient.post('analytics/cashflow/', {
        office: officeDashboard.office.id,
        entry_type: officeEntryType,
        title: officeEntryTitle.trim(),
        amount: officeEntryAmount,
        comment: officeEntryComment.trim(),
        category: '',
        entry_date: new Date().toISOString().slice(0, 10),
      });

      setOfficeEntryOpen(false);
      await load();

      Alert.alert(
        'Готово',
        officeEntryType === 'income'
          ? 'Доход по офису добавлен.'
          : 'Расход по офису добавлен.'
      );
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.office?.[0] ||
        error?.response?.data?.currency?.[0] ||
        error?.response?.data?.title?.[0] ||
        error?.response?.data?.amount?.[0] ||
        'Не удалось создать офисную операцию.';

      Alert.alert('Ошибка', detail);
    } finally {
      setOfficeEntrySaving(false);
    }
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.blue} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
              onRefresh();
            }}
            tintColor={theme.blue}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[theme.blue, '#6D5DFB', '#8F66FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />

          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <View style={styles.heroCaptionRow}>
                <Ionicons name="sparkles-outline" size={15} color="rgba(255,255,255,0.86)" />
                <Text style={styles.heroCaption}>Менеджерская панель</Text>
              </View>

              <Text style={styles.heroTitle}>
                {user.first_name} {user.last_name}
              </Text>

              <Text style={styles.heroSub}>
                Клиенты, заявки, офисный баланс и рабочий день без лишнего шума
              </Text>
            </View>

            <Pressable onPress={() => setFabOpen(true)} style={styles.heroPlus}>
              <Ionicons name="add" size={24} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <View style={styles.heroStatTop}>
                <Ionicons name="cash-outline" size={17} color="rgba(255,255,255,0.86)" />
                <Text style={styles.heroLabel}>Выручка</Text>
              </View>
              <Text style={styles.heroValue}>{compactMoney(revenue)}</Text>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.heroStat}>
              <View style={styles.heroStatTop}>
                <Ionicons name="wallet-outline" size={17} color="rgba(255,255,255,0.86)" />
                <Text style={styles.heroLabel}>Бонус</Text>
              </View>
              <Text style={styles.heroValue}>{compactMoney(balance)}</Text>
            </View>
          </View>

          <View style={styles.heroFooter}>
            <View style={styles.heroChip}>
              <Ionicons name="reader-outline" size={14} color="#fff" />
              <Text style={styles.heroChipText}>{leadStats.fresh} новых заявок</Text>
            </View>

            <View style={styles.heroChip}>
              <Ionicons name="people-outline" size={14} color="#fff" />
              <Text style={styles.heroChipText}>{clients.length} клиентов</Text>
            </View>

            <View style={styles.heroChip}>
              <Ionicons
                name={hasReport ? 'checkmark-done-outline' : 'alert-circle-outline'}
                size={14}
                color="#fff"
              />
              <Text style={styles.heroChipText}>
                {hasReport ? 'Отчёт сдан' : 'Отчёт не сдан'}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.section, { color: theme.text }]}>Быстрые действия</Text>
            <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
              Самые частые операции менеджера
            </Text>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <Pressable onPress={() => router.push('/(app)/workday' as any)} style={styles.quickMainPress}>
            <LinearGradient
              colors={['#EAF2FF', '#F5F0FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.quickMainCard}
            >
              <MiniIcon icon="time-outline" tint={BLUE} bg="rgba(58,122,254,0.13)" />

              <View style={{ flex: 1 }}>
                <Text style={styles.quickMainTitle}>Рабочий день</Text>
                <Text style={styles.quickMainSub}>Начать, завершить и проверить смену</Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color={PREMIUM_MUTED} />
            </LinearGradient>
          </Pressable>

          <View style={styles.quickSmallRow}>
            <Pressable
              onPress={() => router.push('/(app)/tasks' as any)}
              style={[
                styles.quickSmallCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <MiniIcon icon="checkbox-outline" tint={PURPLE} bg="rgba(123,97,255,0.13)" />
              <Text style={[styles.quickSmallTitle, { color: theme.text }]}>Задачи</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/(app)/crm' as any)}
              style={[
                styles.quickSmallCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <MiniIcon icon="people-outline" tint={GREEN} bg="rgba(26,174,111,0.13)" />
              <Text style={[styles.quickSmallTitle, { color: theme.text }]}>Клиенты</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/(app)/payment/create' as any)}
              style={[
                styles.quickSmallCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <MiniIcon icon="card-outline" tint={ORANGE} bg="rgba(245,158,11,0.14)" />
              <Text style={[styles.quickSmallTitle, { color: theme.text }]}>Платёж</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <View
            style={[
              styles.kpiCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <View style={styles.kpiTop}>
              <MiniIcon icon="trending-up-outline" tint={GREEN} bg="rgba(26,174,111,0.13)" />
              <Text style={[styles.kpiTitle, { color: theme.textSecondary }]}>Выручка</Text>
            </View>

            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(revenue)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>за текущий месяц</Text>
          </View>

          <View
            style={[
              styles.kpiCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <View style={styles.kpiTop}>
              <MiniIcon icon="wallet-outline" tint={PURPLE} bg="rgba(123,97,255,0.13)" />
              <Text style={[styles.kpiTitle, { color: theme.textSecondary }]}>Баланс</Text>
            </View>

            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(balance)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>бонус к выплате</Text>
          </View>
        </View>

        <View
          style={[
            styles.progressCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View style={styles.progressHeader}>
            <View style={styles.progressTitleRow}>
              <MiniIcon icon="flag-outline" tint={theme.blue} bg={theme.blueSoft} size={34} />
              <View>
                <Text style={[styles.progressTitle, { color: theme.text }]}>Личный план</Text>
                <Text style={[styles.progressSub, { color: theme.textSecondary }]}>
                  {money(revenue)} из {money(plan)}
                </Text>
              </View>
            </View>

            <Text style={[styles.progressValue, { color: theme.blue }]}>{progress}%</Text>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSoft }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress}%`,
                  backgroundColor: theme.blue,
                },
              ]}
            />
          </View>
        </View>

        {officeDashboard ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.section, { color: theme.text }]}>Офис</Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                  Нажми на карточку, чтобы раскрыть подробности
                </Text>
              </View>
            </View>

            <LinearGradient
              colors={['#F4F7FF', '#FFF3F7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.officeCard}
            >
              <Pressable
                onPress={() => setOfficeExpanded((v) => !v)}
                style={styles.officeHeader}
              >
                <View style={styles.officeHeaderLeft}>
                  <MiniIcon icon="business-outline" tint={PURPLE} bg="rgba(123,97,255,0.13)" size={44} />

                  <View style={{ flex: 1 }}>
                    <Text style={styles.officeTitle} numberOfLines={1}>
                      {officeDashboard.office?.city || 'Офис'}
                    </Text>
                    <Text style={styles.officeMeta} numberOfLines={1}>
                      {officeDashboard.office?.address || officeDashboard.office?.phone || 'Адрес не указан'}
                    </Text>
                  </View>
                </View>

                <View style={styles.officeRight}>
                  <Text style={[styles.officeNet, { color: balanceColor(officeNet, POSITIVE, NEGATIVE) }]}>
                    {compactMoney(officeNet)}
                  </Text>

                  <View style={styles.expandBadge}>
                    <Ionicons
                      name={officeExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={PREMIUM_MUTED}
                    />
                  </View>
                </View>
              </Pressable>

              <View style={styles.officeCompactStats}>
                <View style={styles.officeCompactItem}>
                  <Ionicons name="arrow-up-circle-outline" size={16} color={GREEN} />
                  <Text style={styles.officeCompactLabel}>Доход</Text>
                  <Text style={styles.officeCompactValue}>{compactMoney(officeIncome)}</Text>
                </View>

                <View style={styles.officeCompactItem}>
                  <Ionicons name="arrow-down-circle-outline" size={16} color={NEGATIVE} />
                  <Text style={styles.officeCompactLabel}>Расход</Text>
                  <Text style={[styles.officeCompactValue, { color: NEGATIVE }]}>
                    {compactMoney(officeExpense)}
                  </Text>
                </View>

                <View style={styles.officeCompactItem}>
                  <Ionicons name="flag-outline" size={16} color={BLUE} />
                  <Text style={styles.officeCompactLabel}>План</Text>
                  <Text style={[styles.officeCompactValue, { color: BLUE }]}>
                    {Math.round(officeProgress)}%
                  </Text>
                </View>
              </View>

              {officeExpanded && (
                <View style={styles.officeExpanded}>
                  <View style={styles.officeInfoStrip}>
                    <View style={styles.officeInfoItem}>
                      <Ionicons name="location-outline" size={16} color={PREMIUM_MUTED} />
                      <Text style={styles.officeInfoText} numberOfLines={2}>
                        {officeDashboard.office?.address || 'Адрес не указан'}
                      </Text>
                    </View>

                    <View style={styles.officeInfoItem}>
                      <Ionicons name="call-outline" size={16} color={PREMIUM_MUTED} />
                      <Text style={styles.officeInfoText}>
                        {officeDashboard.office?.phone || 'Телефон не указан'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.officeSummaryGrid}>
                    <View style={styles.officeSummaryCard}>
                      <MiniIcon icon="cash-outline" tint={GREEN} bg="rgba(26,174,111,0.13)" size={34} />
                      <Text style={styles.officeSummaryValue}>{money(officeIncome)}</Text>
                      <Text style={styles.officeSummaryLabel}>Общий доход</Text>
                    </View>

                    <View style={styles.officeSummaryCard}>
                      <MiniIcon icon="cart-outline" tint={NEGATIVE} bg="rgba(239,68,68,0.11)" size={34} />
                      <Text style={[styles.officeSummaryValue, { color: NEGATIVE }]}>
                        {money(officeExpense)}
                      </Text>
                      <Text style={styles.officeSummaryLabel}>Общий расход</Text>
                    </View>

                    <View style={styles.officeSummaryCard}>
                      <MiniIcon icon="ribbon-outline" tint={BLUE} bg="rgba(58,122,254,0.13)" size={34} />
                      <Text style={styles.officeSummaryValue}>{money(officeRevenue)}</Text>
                      <Text style={styles.officeSummaryLabel}>Выручка офиса</Text>
                    </View>

                    <View style={styles.officeSummaryCard}>
                      <MiniIcon icon="flag-outline" tint={PURPLE} bg="rgba(123,97,255,0.13)" size={34} />
                      <Text style={[styles.officeSummaryValue, { color: PURPLE }]}>
                        {money(officePlan)}
                      </Text>
                      <Text style={styles.officeSummaryLabel}>План офиса</Text>
                    </View>
                  </View>

                  <View style={styles.officeProgressCard}>
                    <View style={styles.progressHeader}>
                      <View>
                        <Text style={styles.officeProgressTitle}>Выполнение плана офиса</Text>
                        <Text style={styles.officeProgressSub}>
                          {money(officeRevenue)} из {money(officePlan)}
                        </Text>
                      </View>

                      <Text style={[styles.progressValue, { color: BLUE }]}>
                        {Math.round(officeProgress)}%
                      </Text>
                    </View>

                    <View style={styles.officeProgressTrack}>
                      <View
                        style={[
                          styles.officeProgressFill,
                          {
                            width: `${Math.min(officeProgress, 100)}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.officeQuickRow}>
                    <Pressable
                      onPress={() => openOfficeEntry('income')}
                      style={[styles.officeQuickBtn, { backgroundColor: '#EAF7EF', borderColor: '#CBE9D5' }]}
                    >
                      <MiniIcon icon="add-circle-outline" tint={GREEN} bg="rgba(26,174,111,0.13)" size={32} />
                      <Text style={[styles.officeQuickBtnTitle, { color: '#157347' }]}>Доход</Text>
                      <Text style={[styles.officeQuickBtnSub, { color: '#157347' }]}>
                        Добавить доход
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => openOfficeEntry('expense')}
                      style={[styles.officeQuickBtn, { backgroundColor: '#FDECEC', borderColor: '#F6CACA' }]}
                    >
                      <MiniIcon icon="remove-circle-outline" tint={NEGATIVE} bg="rgba(239,68,68,0.11)" size={32} />
                      <Text style={[styles.officeQuickBtnTitle, { color: NEGATIVE }]}>Расход</Text>
                      <Text style={[styles.officeQuickBtnSub, { color: NEGATIVE }]}>
                        Добавить расход
                      </Text>
                    </Pressable>
                  </View>

                  {topOfficeManagers.length > 0 && (
                    <View style={styles.officeManagersBlock}>
                      <View style={styles.blockTitleRow}>
                        <Text style={styles.blockTitle}>Команда офиса</Text>
                        <Ionicons name="trophy-outline" size={17} color={ORANGE} />
                      </View>

                      {topOfficeManagers.map((manager, index) => {
                        const name = manager.full_name || manager.email || `ID ${manager.id}`;

                        return (
                          <View key={`${manager.id}-${index}`} style={styles.managerRow}>
                            <View style={styles.managerRank}>
                              <Text style={styles.managerRankText}>#{index + 1}</Text>
                            </View>

                            <EmployeeAvatar name={name} />

                            <View style={{ flex: 1 }}>
                              <Text style={styles.managerName} numberOfLines={1}>
                                {name}
                              </Text>
                              <Text style={styles.managerMeta} numberOfLines={1}>
                                {money(num(manager.revenue_usd))} из {money(num(manager.plan_usd))}
                              </Text>
                            </View>

                            <Text style={[styles.managerProgress, { color: BLUE }]}>
                              {Math.round(num(manager.progress_percent))}%
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </LinearGradient>
          </>
        ) : null}

        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.section, { color: theme.text }]}>Заявки с сайта</Text>
            <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
              Новые лиды и заявки в работе
            </Text>
          </View>

          <Pressable
            onPress={() => setLeadsExpanded((v) => !v)}
            style={[styles.sectionIconBtn, { backgroundColor: theme.backgroundSoft }]}
          >
            <Ionicons
              name={leadsExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.blue}
            />
          </Pressable>
        </View>

        <View
          style={[
            styles.leadsPanel,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View style={styles.leadStatsRow}>
            <View style={styles.leadStatChip}>
              <Ionicons name="reader-outline" size={15} color={BLUE} />
              <Text style={styles.leadStatText}>{leadStats.total} всего</Text>
            </View>

            <View style={styles.leadStatChip}>
              <Ionicons name="flash-outline" size={15} color={ORANGE} />
              <Text style={styles.leadStatText}>{leadStats.fresh} новых</Text>
            </View>

            <View style={styles.leadStatChip}>
              <Ionicons name="checkmark-done-outline" size={15} color={GREEN} />
              <Text style={styles.leadStatText}>{leadStats.converted} клиентов</Text>
            </View>
          </View>

          {leadsExpanded && (
            <View style={styles.leadsList}>
              {leads.length === 0 ? (
                <View style={styles.emptyPremiumCard}>
                  <MiniIcon icon="mail-open-outline" tint={BLUE} bg="rgba(58,122,254,0.13)" />
                  <Text style={styles.emptyPremiumTitle}>Пока нет заявок</Text>
                  <Text style={styles.emptyPremiumSub}>
                    Когда с сайта придёт новая заявка, она появится здесь.
                  </Text>
                </View>
              ) : (
                leads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} theme={theme} onPress={handleOpenLead} />
                ))
              )}
            </View>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.section, { color: theme.text }]}>Мои заметки</Text>
            <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
              Локально на устройстве
            </Text>
          </View>

          <View style={styles.sectionActions}>
            <Pressable
              onPress={openCreateNote}
              style={[styles.sectionIconBtn, { backgroundColor: theme.blue }]}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </Pressable>

            <Pressable
              onPress={() => setNotesExpanded((v) => !v)}
              style={[styles.sectionIconBtn, { backgroundColor: theme.backgroundSoft }]}
            >
              <Ionicons
                name={notesExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.blue}
              />
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.panel,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          {!notesExpanded ? (
            <View style={styles.collapsedSummary}>
              <MiniIcon icon="document-text-outline" tint={PURPLE} bg="rgba(123,97,255,0.13)" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.collapsedTitle, { color: theme.text }]}>
                  {notes.length ? `${notes.length} заметок` : 'Нет заметок'}
                </Text>
                <Text style={[styles.collapsedSub, { color: theme.textSecondary }]}>
                  {notes[0]?.title || 'Добавь первую заметку через плюс'}
                </Text>
              </View>
            </View>
          ) : notes.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>
              Пока нет заметок. Нажми плюс и добавь первую.
            </Text>
          ) : (
            notes.map((note, index) => (
              <Swipeable
                key={note.id}
                overshootLeft={false}
                overshootRight={false}
                renderLeftActions={() => renderDeleteAction(note)}
                renderRightActions={() => renderPinAction(note)}
              >
                <Pressable
                  onPress={() => openEditNote(note)}
                  style={[
                    styles.noteRow,
                    {
                      backgroundColor: theme.surface,
                      borderBottomColor: theme.divider,
                      borderBottomWidth: index === notes.length - 1 ? 0 : 1,
                    },
                  ]}
                >
                  <View style={styles.noteIcon}>
                    <Ionicons
                      name={note.is_pinned ? 'pin' : 'document-text-outline'}
                      size={18}
                      color={note.is_pinned ? ORANGE : theme.blue}
                    />
                  </View>

                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <View style={styles.noteTopRow}>
                      <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                        {note.title}
                      </Text>

                      {note.is_pinned ? (
                        <View style={[styles.pinBadge, { backgroundColor: theme.blueSoft }]}>
                          <Text style={[styles.pinBadgeText, { color: theme.blue }]}>PIN</Text>
                        </View>
                      ) : null}
                    </View>

                    {!!note.body && (
                      <Text
                        style={[styles.rowMeta, { color: theme.textSecondary }]}
                        numberOfLines={2}
                      >
                        {note.body}
                      </Text>
                    )}

                    <Text style={[styles.noteTime, { color: theme.textMuted || theme.textSecondary }]}>
                      Изменено: {new Date(note.updated_at).toLocaleString('ru-RU')}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                </Pressable>
              </Swipeable>
            ))
          )}
        </View>

        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.section, { color: theme.text }]}>Мои клиенты</Text>
            <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
              Последние клиенты в видимой базе
            </Text>
          </View>

          <Pressable
            onPress={() => setClientsExpanded((v) => !v)}
            style={[styles.sectionIconBtn, { backgroundColor: theme.backgroundSoft }]}
          >
            <Ionicons
              name={clientsExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.blue}
            />
          </Pressable>
        </View>

        <View
          style={[
            styles.panel,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          {!clientsExpanded ? (
            <View style={styles.collapsedSummary}>
              <MiniIcon icon="people-outline" tint={GREEN} bg="rgba(26,174,111,0.13)" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.collapsedTitle, { color: theme.text }]}>
                  {clients.length ? `${clients.length} клиентов` : 'Нет клиентов'}
                </Text>
                <Text style={[styles.collapsedSub, { color: theme.textSecondary }]}>
                  {clients[0]?.full_name || 'Клиенты появятся после добавления'}
                </Text>
              </View>

              <Pressable
                onPress={() => router.push('/(app)/add-client' as any)}
                style={[styles.smallAddBtn, { backgroundColor: theme.blue }]}
              >
                <Ionicons name="add" size={18} color="#fff" />
              </Pressable>
            </View>
          ) : clients.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>
              Нет клиентов в видимой базе.
            </Text>
          ) : (
            clients.map((client, index) => (
              <Pressable
                key={String(client.id)}
                onPress={() => router.push(`/(app)/client/${client.id}` as any)}
                style={[
                  styles.clientRow,
                  {
                    borderBottomColor: theme.divider,
                    borderBottomWidth: index === clients.length - 1 ? 0 : 1,
                  },
                ]}
              >
                <EmployeeAvatar name={client.full_name || 'Клиент'} />

                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                    {client.full_name}
                  </Text>

                  <Text style={[styles.rowMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {client.phone || 'Без телефона'} · {client.city || 'Без города'}
                  </Text>
                </View>

                <View style={[styles.statusPill, { backgroundColor: theme.backgroundSoft }]}>
                  <Text style={[styles.statusPillText, { color: theme.blue }]}>
                    {client.status || 'new'}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>

        <View
          style={[
            styles.portalCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <MiniIcon icon="checkbox-outline" tint={PURPLE} bg="rgba(123,97,255,0.13)" />

          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.portalTitle, { color: theme.text }]}>Общий портал задач</Text>
            <Text style={[styles.portalSub, { color: theme.textSecondary }]}>
              Серверные задачи для всей команды: создание, выполнение и контроль.
            </Text>
          </View>

          <Pressable
            onPress={() => router.push('/(app)/tasks' as any)}
            style={[styles.portalButton, { backgroundColor: theme.blueSoft }]}
          >
            <Text style={[styles.portalButtonText, { color: theme.blue }]}>Открыть</Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.reportCard,
            {
              backgroundColor: hasReport ? 'rgba(26,174,111,0.10)' : 'rgba(245,158,11,0.11)',
              borderColor: hasReport ? 'rgba(26,174,111,0.22)' : 'rgba(245,158,11,0.22)',
            },
          ]}
        >
          <MiniIcon
            icon={hasReport ? 'checkmark-done-outline' : 'alert-circle-outline'}
            tint={hasReport ? GREEN : ORANGE}
            bg={hasReport ? 'rgba(26,174,111,0.13)' : 'rgba(245,158,11,0.14)'}
          />

          <View style={{ flex: 1 }}>
            <Text style={styles.reportTitle}>
              {hasReport ? 'Отчёт за сегодня уже отправлен' : 'Отчёт за сегодня ещё не отправлен'}
            </Text>

            <Pressable onPress={() => router.push('/(app)/profile' as any)}>
              <Text style={[styles.reportAction, { color: hasReport ? GREEN : ORANGE }]}>
                {hasReport ? 'Проверить' : 'Открыть и заполнить'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <Modal visible={fabOpen} transparent animationType="fade" onRequestClose={() => setFabOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setFabOpen(false)}>
          <View style={[styles.fabMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable
              onPress={() => {
                setFabOpen(false);
                router.push('/(app)/workday' as any);
              }}
              style={styles.fabAction}
            >
              <MiniIcon icon="time-outline" tint={BLUE} bg="rgba(58,122,254,0.13)" size={34} />
              <Text style={[styles.fabActionText, { color: theme.text }]}>Учет времени</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setFabOpen(false);
                router.push('/(app)/payment/create' as any);
              }}
              style={styles.fabAction}
            >
              <MiniIcon icon="card-outline" tint={GREEN} bg="rgba(26,174,111,0.13)" size={34} />
              <Text style={[styles.fabActionText, { color: theme.text }]}>Быстрый платёж</Text>
            </Pressable>

            {officeDashboard ? (
              <>
                <Pressable
                  onPress={() => {
                    setFabOpen(false);
                    openOfficeEntry('income');
                  }}
                  style={styles.fabAction}
                >
                  <MiniIcon icon="add-circle-outline" tint={GREEN} bg="rgba(26,174,111,0.13)" size={34} />
                  <Text style={[styles.fabActionText, { color: theme.text }]}>Доход офиса</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setFabOpen(false);
                    openOfficeEntry('expense');
                  }}
                  style={styles.fabAction}
                >
                  <MiniIcon icon="remove-circle-outline" tint={NEGATIVE} bg="rgba(239,68,68,0.11)" size={34} />
                  <Text style={[styles.fabActionText, { color: theme.text }]}>Расход офиса</Text>
                </Pressable>
              </>
            ) : null}

            <Pressable
              onPress={() => {
                setFabOpen(false);
                openCreateNote();
              }}
              style={styles.fabAction}
            >
              <MiniIcon icon="document-text-outline" tint={PURPLE} bg="rgba(123,97,255,0.13)" size={34} />
              <Text style={[styles.fabActionText, { color: theme.text }]}>Новая заметка</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setFabOpen(false);
                router.push('/(app)/add-client' as any);
              }}
              style={styles.fabAction}
            >
              <MiniIcon icon="person-add-outline" tint={ORANGE} bg="rgba(245,158,11,0.14)" size={34} />
              <Text style={[styles.fabActionText, { color: theme.text }]}>Добавить клиента</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={officeEntryOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setOfficeEntryOpen(false)}
      >
        <View style={styles.modalWrap}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <MiniIcon
                  icon={officeEntryType === 'income' ? 'add-circle-outline' : 'remove-circle-outline'}
                  tint={officeEntryType === 'income' ? GREEN : NEGATIVE}
                  bg={
                    officeEntryType === 'income'
                      ? 'rgba(26,174,111,0.13)'
                      : 'rgba(239,68,68,0.11)'
                  }
                  size={38}
                />

                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    {officeEntryType === 'income' ? 'Быстрый доход офиса' : 'Быстрый расход офиса'}
                  </Text>

                  <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                    Офис: {officeDashboard?.office?.city || '—'}
                  </Text>
                </View>
              </View>

              <Pressable onPress={() => setOfficeEntryOpen(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Название</Text>

            <TextInput
              value={officeEntryTitle}
              onChangeText={setOfficeEntryTitle}
              placeholder="Название"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSoft,
                },
              ]}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Сумма</Text>

            <TextInput
              value={officeEntryAmount}
              onChangeText={setOfficeEntryAmount}
              placeholder="Сумма"
              keyboardType="numeric"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSoft,
                },
              ]}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Комментарий</Text>

            <TextInput
              value={officeEntryComment}
              onChangeText={setOfficeEntryComment}
              placeholder="Комментарий"
              placeholderTextColor={theme.textMuted}
              multiline
              style={[
                styles.input,
                styles.textarea,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSoft,
                },
              ]}
            />

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setOfficeEntryOpen(false)}
                style={[
                  styles.secondaryBtn,
                  {
                    backgroundColor: theme.backgroundSoft,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Отмена</Text>
              </Pressable>

              <Pressable
                onPress={createOfficeEntry}
                disabled={officeEntrySaving}
                style={[
                  styles.primaryBtn,
                  {
                    backgroundColor: officeEntryType === 'income' ? POSITIVE : NEGATIVE,
                    opacity: officeEntrySaving ? 0.7 : 1,
                  },
                ]}
              >
                {officeEntrySaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Сохранить</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={leadModalOpen} transparent animationType="slide" onRequestClose={() => setLeadModalOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.leadModalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.leadModalHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {selectedLead?.full_name || 'Заявка'}
                </Text>

                <Text style={[styles.leadModalSubTitle, { color: theme.textSecondary }]}>
                  {selectedLead?.phone || 'Без телефона'}
                  {selectedLead?.country ? ` · ${selectedLead.country}` : ''}
                </Text>
              </View>

              {leadSaving ? (
                <ActivityIndicator color={theme.blue} />
              ) : (
                <Pressable onPress={() => setLeadModalOpen(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={20} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              <View style={styles.statusRowWrap}>
                {LEAD_STATUSES.map((status) => {
                  const active = selectedLead?.status === status;

                  return (
                    <Pressable
                      key={status}
                      onPress={() => handleChangeLeadStatus(status)}
                      style={[
                        styles.statusChip,
                        {
                          backgroundColor: active ? theme.blue : theme.backgroundSoft,
                          borderColor: active ? theme.blue : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          {
                            color: active ? '#fff' : theme.textSecondary,
                          },
                        ]}
                      >
                        {statusTitle(status)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.infoBox, { backgroundColor: theme.backgroundSoft }]}>
                <InfoRow label="Направление" value={directionTitle(selectedLead?.direction)} theme={theme} />
                <InfoRow label="Email" value={selectedLead?.email || '—'} theme={theme} />
                <InfoRow label="Возраст" value={selectedLead?.age ? String(selectedLead.age) : '—'} theme={theme} />
                <InfoRow label="Родство" value={selectedLead?.relation || '—'} theme={theme} />
                <InfoRow label="Образование" value={selectedLead?.education || '—'} theme={theme} />
                <InfoRow label="ФИО студента" value={selectedLead?.student_name || '—'} theme={theme} />
                <InfoRow label="ФИО родителя" value={selectedLead?.parent_name || '—'} theme={theme} />
                <InfoRow label="Наличие паспорта" value={selectedLead?.has_passport || '—'} theme={theme} />
                <InfoRow
                  label="Срок действия паспорта"
                  value={selectedLead?.passport_expiry || '—'}
                  theme={theme}
                />
                <InfoRow label="Месяц поездки" value={selectedLead?.travel_month || '—'} theme={theme} />
                <InfoRow label="Дата поездки" value={selectedLead?.travel_date || '—'} theme={theme} />
                <InfoRow label="Город вылета" value={selectedLead?.departure_city || '—'} theme={theme} />
                <InfoRow label="Город прибытия" value={selectedLead?.arrival_city || '—'} theme={theme} />
                <InfoRow label="Багаж" value={selectedLead?.luggage || '—'} theme={theme} />
                <InfoRow
                  label="Текущее образование"
                  value={selectedLead?.current_education || '—'}
                  theme={theme}
                />
                <InfoRow
                  label="Текущий университет"
                  value={selectedLead?.current_university || '—'}
                  theme={theme}
                />
                <InfoRow
                  label="Текущая страна"
                  value={selectedLead?.current_country || '—'}
                  theme={theme}
                />
              </View>

              <View style={styles.leadActions}>
                <Pressable onPress={openAddClientFromLead} style={[styles.primaryWideBtn, { backgroundColor: theme.blue }]}>
                  <Text style={styles.primaryWideBtnText}>Добавить как клиента</Text>
                </Pressable>

                <Pressable
                  onPress={() => setLeadModalOpen(false)}
                  style={[
                    styles.secondaryWideBtn,
                    {
                      backgroundColor: theme.backgroundSoft,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.secondaryWideBtnText, { color: theme.text }]}>Закрыть</Text>
                  <Ionicons name="arrow-forward-outline" size={18} color={theme.textSecondary} />
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={noteModalOpen} transparent animationType="slide" onRequestClose={() => setNoteModalOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <MiniIcon icon="document-text-outline" tint={PURPLE} bg="rgba(123,97,255,0.13)" size={38} />

                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    {noteForm.id ? 'Редактировать заметку' : 'Новая заметка'}
                  </Text>

                  <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                    Заметка хранится локально на устройстве
                  </Text>
                </View>
              </View>

              <Pressable onPress={() => setNoteModalOpen(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Название</Text>

            <TextInput
              value={noteForm.title}
              onChangeText={(v) => setNoteForm((prev) => ({ ...prev, title: v }))}
              placeholder="Название"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSoft,
                },
              ]}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Текст</Text>

            <TextInput
              value={noteForm.body}
              onChangeText={(v) => setNoteForm((prev) => ({ ...prev, body: v }))}
              placeholder="Текст заметки"
              placeholderTextColor={theme.textMuted}
              multiline
              style={[
                styles.input,
                styles.textarea,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSoft,
                },
              ]}
            />

            <Pressable
              onPress={() =>
                setNoteForm((prev) => ({
                  ...prev,
                  is_pinned: !prev.is_pinned,
                }))
              }
              style={[styles.pinToggle, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}
            >
              <Ionicons
                name={noteForm.is_pinned ? 'pin' : 'pin-outline'}
                size={18}
                color={noteForm.is_pinned ? ORANGE : theme.textSecondary}
              />

              <Text style={[styles.pinToggleText, { color: theme.text }]}>
                {noteForm.is_pinned ? 'Закреплено' : 'Закрепить заметку'}
              </Text>
            </Pressable>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setNoteModalOpen(false)}
                style={[
                  styles.secondaryBtn,
                  {
                    backgroundColor: theme.backgroundSoft,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Отмена</Text>
              </Pressable>

              <Pressable onPress={saveNote} style={[styles.primaryBtn, { backgroundColor: theme.blue }]}>
                <Text style={styles.primaryBtnText}>Сохранить</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  container: {
    padding: 18,
    paddingBottom: 124,
  },

  hero: {
    borderRadius: 30,
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#3A2F8F',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },

  heroGlowOne: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    right: -50,
    top: -42,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },

  heroGlowTwo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    left: -38,
    bottom: -38,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },

  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },

  heroCaptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  heroCaption: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  heroTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 7,
  },

  heroSub: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },

  heroPlus: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },

  heroStats: {
    marginTop: 22,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  heroStat: {
    flex: 1,
  },

  heroStatTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  heroDivider: {
    width: 1,
    height: 48,
    marginHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  heroValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 7,
  },

  heroLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '800',
  },

  heroFooter: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },

  heroChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  sectionHeader: {
    marginTop: 26,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },

  section: {
    fontSize: 19,
    fontWeight: '900',
  },

  sectionSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },

  sectionActions: {
    flexDirection: 'row',
    gap: 8,
  },

  sectionIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconBubble: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickGrid: {
    gap: 12,
  },

  quickMainPress: {
    borderRadius: 24,
  },

  quickMainCard: {
    minHeight: 96,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  quickMainTitle: {
    color: PREMIUM_TEXT,
    fontSize: 16,
    fontWeight: '900',
  },

  quickMainSub: {
    marginTop: 4,
    color: PREMIUM_MUTED,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },

  quickSmallRow: {
    flexDirection: 'row',
    gap: 10,
  },

  quickSmallCard: {
    flex: 1,
    minHeight: 102,
    borderWidth: 1,
    borderRadius: 22,
    padding: 13,
    justifyContent: 'space-between',
  },

  quickSmallTitle: {
    fontSize: 13,
    fontWeight: '900',
  },

  kpiGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },

  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    padding: 15,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },

  kpiTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  kpiTitle: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  kpiValue: {
    marginTop: 14,
    fontSize: 21,
    fontWeight: '900',
  },

  kpiLabel: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },

  progressCard: {
    marginTop: 14,
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.055,
    shadowRadius: 14,
    elevation: 2,
  },

  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },

  progressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  progressTitle: {
    fontSize: 15,
    fontWeight: '900',
  },

  progressValue: {
    fontSize: 15,
    fontWeight: '900',
  },

  progressSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
  },

  progressTrack: {
    marginTop: 14,
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },

  progressFill: {
    height: 10,
    borderRadius: 999,
  },

  officeCard: {
    borderRadius: 26,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.08)',
  },

  officeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  officeHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  officeRight: {
    alignItems: 'flex-end',
    gap: 7,
  },

  officeTitle: {
    color: PREMIUM_TEXT,
    fontSize: 18,
    fontWeight: '900',
  },

  officeMeta: {
    marginTop: 4,
    color: PREMIUM_MUTED,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },

  officeNet: {
    fontSize: 18,
    fontWeight: '900',
  },

  expandBadge: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.76)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  officeCompactStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },

  officeCompactItem: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.72)',
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.06)',
  },

  officeCompactLabel: {
    marginTop: 5,
    color: PREMIUM_MUTED,
    fontSize: 10.5,
    fontWeight: '800',
  },

  officeCompactValue: {
    marginTop: 3,
    color: PREMIUM_TEXT,
    fontSize: 13,
    fontWeight: '900',
  },

  officeExpanded: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(47,42,69,0.08)',
  },

  officeInfoStrip: {
    gap: 8,
  },

  officeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.68)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  officeInfoText: {
    flex: 1,
    color: PREMIUM_MUTED,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },

  officeSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },

  officeSummaryCard: {
    width: '48%',
    borderRadius: 20,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.06)',
  },

  officeSummaryValue: {
    marginTop: 10,
    color: PREMIUM_TEXT,
    fontSize: 16,
    fontWeight: '900',
  },

  officeSummaryLabel: {
    marginTop: 5,
    color: PREMIUM_MUTED,
    fontSize: 11.5,
    fontWeight: '800',
    lineHeight: 16,
  },

  officeProgressCard: {
    marginTop: 12,
    borderRadius: 20,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.70)',
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.06)',
  },

  officeProgressTitle: {
    color: PREMIUM_TEXT,
    fontSize: 14,
    fontWeight: '900',
  },

  officeProgressSub: {
    marginTop: 4,
    color: PREMIUM_MUTED,
    fontSize: 12,
    fontWeight: '700',
  },

  officeProgressTrack: {
    marginTop: 12,
    height: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(58,122,254,0.12)',
    overflow: 'hidden',
  },

  officeProgressFill: {
    height: 9,
    borderRadius: 999,
    backgroundColor: BLUE,
  },

  officeQuickRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },

  officeQuickBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
  },

  officeQuickBtnTitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '900',
  },

  officeQuickBtnSub: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },

  officeManagersBlock: {
    marginTop: 16,
  },

  blockTitleRow: {
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  blockTitle: {
    color: PREMIUM_TEXT,
    fontSize: 15,
    fontWeight: '900',
  },

  managerRow: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.72)',
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  managerRank: {
    width: 32,
    height: 32,
    borderRadius: 13,
    backgroundColor: 'rgba(245,158,11,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  managerRankText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '900',
  },

  employeeAvatar: {
    width: 42,
    height: 42,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  employeeAvatarText: {
    color: PREMIUM_TEXT,
    fontSize: 13,
    fontWeight: '900',
  },

  managerName: {
    color: PREMIUM_TEXT,
    fontSize: 14,
    fontWeight: '900',
  },

  managerMeta: {
    marginTop: 3,
    color: PREMIUM_MUTED,
    fontSize: 11.5,
    fontWeight: '700',
  },

  managerProgress: {
    fontSize: 14,
    fontWeight: '900',
  },

  leadsPanel: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.055,
    shadowRadius: 14,
    elevation: 2,
  },

  leadStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  leadStatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(123,97,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  leadStatText: {
    color: PREMIUM_TEXT,
    fontSize: 11,
    fontWeight: '900',
  },

  leadsList: {
    marginTop: 10,
  },

  emptyPremiumCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.70)',
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.06)',
    alignItems: 'flex-start',
  },

  emptyPremiumTitle: {
    marginTop: 10,
    color: PREMIUM_TEXT,
    fontSize: 16,
    fontWeight: '900',
  },

  emptyPremiumSub: {
    marginTop: 6,
    color: PREMIUM_MUTED,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },

  panel: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.055,
    shadowRadius: 14,
    elevation: 2,
  },

  collapsedSummary: {
    minHeight: 74,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  collapsedTitle: {
    fontSize: 15,
    fontWeight: '900',
  },

  collapsedSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },

  smallAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noteRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  noteIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    backgroundColor: 'rgba(58,122,254,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  rowTitle: {
    fontSize: 15,
    fontWeight: '900',
  },

  rowMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },

  noteTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  pinBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  pinBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },

  noteTime: {
    marginTop: 7,
    fontSize: 10.5,
    fontWeight: '700',
  },

  swipeDelete: {
    width: 112,
    backgroundColor: RED,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },

  swipePin: {
    width: 126,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },

  swipeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },

  clientRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  statusPillText: {
    fontSize: 11,
    fontWeight: '900',
  },

  empty: {
    padding: 16,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },

  portalCard: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.055,
    shadowRadius: 14,
    elevation: 2,
  },

  portalTitle: {
    fontSize: 15,
    fontWeight: '900',
  },

  portalSub: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },

  portalButton: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  portalButtonText: {
    fontSize: 13,
    fontWeight: '900',
  },

  reportCard: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  reportTitle: {
    color: PREMIUM_TEXT,
    fontSize: 15,
    fontWeight: '900',
  },

  reportAction: {
    marginTop: 7,
    fontSize: 13,
    fontWeight: '900',
  },

  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(7, 12, 20, 0.38)',
    justifyContent: 'flex-end',
    padding: 16,
  },

  fabMenu: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 8,
    marginBottom: 88,
  },

  fabAction: {
    minHeight: 62,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  fabActionText: {
    fontSize: 15,
    fontWeight: '900',
  },

  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(7, 12, 20, 0.38)',
    justifyContent: 'flex-end',
    padding: 16,
  },

  modalCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },

  modalTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
  },

  modalSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
  },

  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  inputLabel: {
    marginTop: 12,
    marginBottom: 7,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },

  input: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: '700',
  },

  textarea: {
    minHeight: 104,
    textAlignVertical: 'top',
  },

  pinToggle: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  pinToggleText: {
    fontSize: 14,
    fontWeight: '900',
  },

  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },

  secondaryBtn: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },

  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '900',
  },

  primaryBtn: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },

  leadModalCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    maxHeight: '86%',
  },

  leadModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },

  leadModalSubTitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
  },

  statusRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },

  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
  },

  statusChipText: {
    fontSize: 12,
    fontWeight: '900',
  },

  infoBox: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  infoRow: {
    paddingVertical: 11,
    borderBottomWidth: 1,
  },

  infoLabel: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  infoValue: {
    marginTop: 5,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },

  leadActions: {
    gap: 10,
    marginTop: 16,
  },

  primaryWideBtn: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },

  primaryWideBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },

  secondaryWideBtn: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  secondaryWideBtnText: {
    fontSize: 14,
    fontWeight: '900',
  },
});
