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
import Svg, { Circle, Path, Rect } from 'react-native-svg';

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
  managers?: Array<{
    id: number;
    full_name?: string;
    email?: string;
    revenue_usd?: string | number;
    plan_usd?: string | number;
    progress_percent?: string | number;
  }>;
};

type QuickOfficeEntryType = 'income' | 'expense';

const LOCAL_NOTES_KEY = 'manager_dashboard_notes_v2';
const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'converted', 'rejected'];

function money(v: number) {
  return `$${Math.round(v || 0).toLocaleString('ru-RU')}`;
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isMineOrShared(client: any, userId: number) {
  if (!client) return false;
  if (client.manager === userId) return true;
  if (Array.isArray(client.shared_with) && client.shared_with.includes(userId)) return true;
  if (Array.isArray(client.shared_with_data) && client.shared_with_data.some((u: any) => u.id === userId)) {
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

function QuickSvgIcon({
  name,
  color,
}: {
  name: 'workday' | 'tasks' | 'clients' | 'payments' | 'leads';
  color: string;
}) {
  const common = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {name === 'workday' && (
        <>
          <Circle cx="12" cy="12" r="8" {...common} />
          <Path d="M12 8v4l2.8 1.8" {...common} />
        </>
      )}

      {name === 'tasks' && (
        <>
          <Rect x="5" y="4" width="14" height="16" rx="2.5" {...common} />
          <Path d="M9 9h6M9 13h6M9 17h4" {...common} />
        </>
      )}

      {name === 'clients' && (
        <>
          <Circle cx="9" cy="10" r="2.5" {...common} />
          <Circle cx="16.5" cy="11" r="2" {...common} />
          <Path d="M5.5 17.2c.8-2 2.5-3 3.5-3 1.4 0 2.8.7 3.8 2" {...common} />
          <Path d="M14 17c.5-1.3 1.5-2 2.5-2 .8 0 1.6.3 2.2 1" {...common} />
        </>
      )}

      {name === 'payments' && (
        <>
          <Rect x="4" y="6" width="16" height="12" rx="3" {...common} />
          <Path d="M8 12h8M8 9.2h2.5M8 14.8h3" {...common} />
        </>
      )}

      {name === 'leads' && (
        <>
          <Rect x="4" y="4.5" width="16" height="15" rx="3.5" {...common} />
          <Path d="M8 9h8M8 12.5h8M8 16h4" {...common} />
        </>
      )}
    </Svg>
  );
}

function ActionSvgIcon({
  name,
  color,
}: {
  name: 'plus' | 'edit' | 'pin' | 'trash' | 'chevron' | 'arrowUpRight';
  color: string;
}) {
  const common = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...common} />}
      {name === 'edit' && (
        <>
          <Path d="M4 20h4l10-10-4-4L4 16v4Z" {...common} />
          <Path d="M12.5 5.5l4 4" {...common} />
        </>
      )}
      {name === 'pin' && (
        <>
          <Path d="M9 4h6l-1.5 5 3 3H7.5l3-3L9 4Z" {...common} />
          <Path d="M12 12v8" {...common} />
        </>
      )}
      {name === 'trash' && (
        <>
          <Path d="M4 7h16" {...common} />
          <Path d="M9 7V5h6v2" {...common} />
          <Path d="M7 7l1 12h8l1-12" {...common} />
          <Path d="M10 11v5M14 11v5" {...common} />
        </>
      )}
      {name === 'chevron' && <Path d="M9 6l6 6-6 6" {...common} />}
      {name === 'arrowUpRight' && (
        <>
          <Path d="M7 17L17 7" {...common} />
          <Path d="M9 7h8v8" {...common} />
        </>
      )}
    </Svg>
  );
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

export default function ManagerDashboard({ user, onRefresh }: Props) {
  const { theme, themeMode } = useTheme();
  const router = useRouter();
  const dark = themeMode === 'dark';

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

      const myClients = (clientsResponse || []).filter((c: any) => isMineOrShared(c, user.id)).slice(0, 5);

      setNotes(sortNotes(storedNotes));
      setClients(myClients);
      setHasReport(!!reportResponse?.data);
      setLeads((leadsResponse || []).slice(0, 10));
      setOfficeDashboard((officeDashboardResponse?.data || null) as OfficeDashboardData | null);
    } catch (e) {
      console.log('Manager dashboard load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [readLocalNotes, user.id]);

  useEffect(() => {
    load();
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

  const officeIncome = useMemo(
    () => num(officeDashboard?.total_income_usd),
    [officeDashboard]
  );
  const officeExpense = useMemo(
    () => num(officeDashboard?.total_expense_usd),
    [officeDashboard]
  );
  const officeNet = useMemo(
    () => num(officeDashboard?.net_usd),
    [officeDashboard]
  );
  const officePlan = useMemo(
    () => num(officeDashboard?.monthly_plan_usd),
    [officeDashboard]
  );
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
    return { total, fresh, inWork, converted };
  }, [leads]);

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
        ? { ...item, is_pinned: !item.is_pinned, updated_at: new Date().toISOString() }
        : item
    );
    await persistNotes(updated);
  };

  const removeNote = async (note: LocalNote) => {
    Alert.alert('Удаление', `Удалить заметку "${note.title}"?`, [
      { text: 'Отмена', style: 'cancel' },
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
      <ActionSvgIcon name="trash" color="#fff" />
      <Text style={styles.swipeText}>Удалить</Text>
    </Pressable>
  );

  const renderPinAction = (note: LocalNote) => (
    <Pressable
      onPress={() => togglePinNote(note)}
      style={[styles.swipePin, { backgroundColor: note.is_pinned ? '#8B8FA3' : theme.blue }]}
    >
      <ActionSvgIcon name="pin" color="#fff" />
      <Text style={styles.swipeText}>{note.is_pinned ? 'Открепить' : 'Закрепить'}</Text>
    </Pressable>
  );

  const patchLead = useCallback(
    async (leadId: number, payload: Partial<LeadItem>) => {
      const response = await apiClient.patch(`leads/mobile/${leadId}/`, payload);
      return response.data as LeadItem;
    },
    []
  );

  const updateLeadInList = useCallback((updatedLead: LeadItem) => {
    setLeads((prev) =>
      prev.map((item) => (item.id === updatedLead.id ? { ...item, ...updatedLead } : item))
    );
    setSelectedLead((prev) => (prev && prev.id === updatedLead.id ? { ...prev, ...updatedLead } : prev));
  }, []);

  const handleOpenLead = useCallback(
    async (lead: LeadItem) => {
      setSelectedLead(lead);
      setLeadModalOpen(true);

      if (lead.status === 'new') {
        try {
          setLeadSaving(true);

          const optimistic: LeadItem = { ...lead, status: 'contacted' };
          updateLeadInList(optimistic);

          const updated = await patchLead(lead.id, { status: 'contacted' });
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
      const optimistic = { ...selectedLead, status };

      try {
        setLeadSaving(true);
        updateLeadInList(optimistic);
        const updated = await patchLead(selectedLead.id, { status });
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
        officeEntryType === 'income' ? 'Доход по офису добавлен.' : 'Расход по офису добавлен.'
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
              load();
              onRefresh();
            }}
            tintColor={theme.blue}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: dark ? 'rgba(18,24,36,0.92)' : '#FFFFFF',
              borderColor: theme.border,
              shadowColor: '#000',
            },
          ]}
        >
          <View style={styles.top}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.caption, { color: theme.textSecondary }]}>Менеджерская панель</Text>
              <Text style={[styles.title, { color: theme.text }]}>
                {user.first_name} {user.last_name}
              </Text>
              <Text style={[styles.heroSub, { color: theme.textSecondary }]}>
                Премиальный дашборд по клиентам, заявкам и ежедневной работе
              </Text>
            </View>

            <Pressable
              onPress={() => setFabOpen(true)}
              style={[
                styles.fabMini,
                {
                  backgroundColor: dark ? 'rgba(255,255,255,0.06)' : theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.fabMiniText, { color: theme.text }]}>＋</Text>
            </Pressable>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={[styles.heroStat, { backgroundColor: theme.backgroundSoft }]}>
              <Text style={[styles.heroStatValue, { color: theme.text }]}>{leadStats.fresh}</Text>
              <Text style={[styles.heroStatLabel, { color: theme.textSecondary }]}>Новых заявок</Text>
            </View>

            <View style={[styles.heroStat, { backgroundColor: theme.backgroundSoft }]}>
              <Text style={[styles.heroStatValue, { color: theme.text }]}>{clients.length}</Text>
              <Text style={[styles.heroStatLabel, { color: theme.textSecondary }]}>Моих клиентов</Text>
            </View>

            <View style={[styles.heroStat, { backgroundColor: theme.backgroundSoft }]}>
              <Text style={[styles.heroStatValue, { color: theme.text }]}>{leadStats.converted}</Text>
              <Text style={[styles.heroStatLabel, { color: theme.textSecondary }]}>Конверсий</Text>
            </View>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <Pressable
            onPress={() => router.push('/(app)/workday' as any)}
            style={[styles.quickCardPrimary, { backgroundColor: theme.blue }]}
          >
            <View style={styles.quickIconBoxDark}>
              <QuickSvgIcon name="workday" color="#fff" />
            </View>
            <Text style={styles.quickPrimaryTitle}>Быстрый вход в Workday</Text>
            <Text style={styles.quickPrimarySub}>Отметиться о приходе, уходе и проверить смены</Text>
          </Pressable>

          <View style={styles.quickRow}>
            <Pressable
              onPress={() => router.push('/(app)/tasks' as any)}
              style={[styles.quickCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={[styles.quickIconBox, { backgroundColor: theme.blueSoft }]}>
                <QuickSvgIcon name="tasks" color={theme.blue} />
              </View>
              <Text style={[styles.quickTitle, { color: theme.text }]}>Портал задач</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/(app)/crm' as any)}
              style={[styles.quickCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={[styles.quickIconBox, { backgroundColor: theme.blueSoft }]}>
                <QuickSvgIcon name="clients" color={theme.blue} />
              </View>
              <Text style={[styles.quickTitle, { color: theme.text }]}>Клиенты</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(revenue)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Выручка за месяц</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{money(balance)}</Text>
            <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Бонусный баланс</Text>
          </View>
        </View>

        <View style={[styles.progressCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.progressRow}>
            <Text style={[styles.progressTitle, { color: theme.text }]}>План</Text>
            <Text style={[styles.progressValue, { color: theme.blue }]}>{progress}%</Text>
          </View>

          <View style={[styles.progressBarBg, { backgroundColor: theme.backgroundSoft }]}>
            <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: theme.blue }]} />
          </View>

          <Text style={[styles.progressSub, { color: theme.textSecondary }]}>
            {money(revenue)} из {money(plan)}
          </Text>
        </View>

        {officeDashboard ? (
          <>
            <View style={styles.sectionHead}>
              <View>
                <Text style={[styles.section, { color: theme.text }]}>Баланс офиса</Text>
                <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
                  Видно только сотрудникам, кому админ включил доступ к офисному дашборду
                </Text>
              </View>
            </View>

            <View style={[styles.officeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.officeCardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.officeName, { color: theme.text }]}>
                    {officeDashboard.office?.city || 'Офис'}
                  </Text>
                  <Text style={[styles.officeMeta, { color: theme.textSecondary }]}>
                    {officeDashboard.office?.address || 'Адрес не указан'}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.officeNet,
                    { color: officeNet >= 0 ? (theme.success || '#1AAE6F') : theme.red },
                  ]}
                >
                  {money(officeNet)}
                </Text>
              </View>

              <View style={styles.officeKpiGrid}>
                <View style={[styles.officeKpiItem, { backgroundColor: theme.backgroundSoft }]}>
                  <Text style={[styles.officeKpiValue, { color: theme.text }]}>{money(officeIncome)}</Text>
                  <Text style={[styles.officeKpiLabel, { color: theme.textSecondary }]}>Доход</Text>
                </View>

                <View style={[styles.officeKpiItem, { backgroundColor: theme.backgroundSoft }]}>
                  <Text style={[styles.officeKpiValue, { color: theme.text }]}>{money(officeExpense)}</Text>
                  <Text style={[styles.officeKpiLabel, { color: theme.textSecondary }]}>Расход</Text>
                </View>

                <View style={[styles.officeKpiItem, { backgroundColor: theme.backgroundSoft }]}>
                  <Text style={[styles.officeKpiValue, { color: theme.text }]}>{money(officeRevenue)}</Text>
                  <Text style={[styles.officeKpiLabel, { color: theme.textSecondary }]}>Выручка</Text>
                </View>

                <View style={[styles.officeKpiItem, { backgroundColor: theme.backgroundSoft }]}>
                  <Text style={[styles.officeKpiValue, { color: theme.blue }]}>{Math.round(officeProgress)}%</Text>
                  <Text style={[styles.officeKpiLabel, { color: theme.textSecondary }]}>План офиса</Text>
                </View>
              </View>

              <View style={[styles.officeProgressCard, { backgroundColor: theme.backgroundSoft }]}>
                <View style={styles.progressRow}>
                  <Text style={[styles.progressTitle, { color: theme.text }]}>План офиса</Text>
                  <Text style={[styles.progressValue, { color: theme.blue }]}>
                    {Math.round(officeProgress)}%
                  </Text>
                </View>

                <View style={[styles.progressBarBg, { backgroundColor: '#DDE7FF' }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(officeProgress, 100)}%`,
                        backgroundColor: theme.blue,
                      },
                    ]}
                  />
                </View>

                <Text style={[styles.progressSub, { color: theme.textSecondary }]}>
                  {money(officeRevenue)} из {money(officePlan)}
                </Text>
              </View>

              <View style={styles.officeQuickRow}>
                <Pressable
                  onPress={() => openOfficeEntry('income')}
                  style={[styles.officeQuickBtn, { backgroundColor: '#EAF7EF', borderColor: '#CBE9D5' }]}
                >
                  <Text style={[styles.officeQuickBtnTitle, { color: '#157347' }]}>+ Доход офиса</Text>
                  <Text style={[styles.officeQuickBtnSub, { color: '#157347' }]}>
                    Быстро добавить офисный доход
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => openOfficeEntry('expense')}
                  style={[styles.officeQuickBtn, { backgroundColor: '#FDECEC', borderColor: '#F6CACA' }]}
                >
                  <Text style={[styles.officeQuickBtnTitle, { color: theme.red }]}>− Расход офиса</Text>
                  <Text style={[styles.officeQuickBtnSub, { color: theme.red }]}>
                    Быстро добавить офисный расход
                  </Text>
                </Pressable>
              </View>

              {officeManagers.length > 0 && (
                <View style={styles.officeManagersWrap}>
                  <Text style={[styles.officeManagersTitle, { color: theme.text }]}>
                    Команда офиса
                  </Text>

                  {officeManagers.map((manager, index) => (
                    <View
                      key={`${manager.id}-${index}`}
                      style={[
                        styles.officeManagerRow,
                        {
                          borderBottomColor: theme.divider,
                          borderBottomWidth: index === officeManagers.length - 1 ? 0 : 1,
                        },
                      ]}
                    >
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={[styles.officeManagerName, { color: theme.text }]}>
                          {manager.full_name || manager.email || `ID ${manager.id}`}
                        </Text>
                        <Text style={[styles.officeManagerMeta, { color: theme.textSecondary }]}>
                          {money(num(manager.revenue_usd))} из {money(num(manager.plan_usd))}
                        </Text>
                      </View>

                      <Text style={[styles.officeManagerProgress, { color: theme.blue }]}>
                        {Math.round(num(manager.progress_percent))}%
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}

        <View style={styles.sectionHead}>
          <View>
            <Text style={[styles.section, { color: theme.text }]}>Заявки с сайта</Text>
            <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
              Новые лиды падают сюда. При открытии заявка автоматически берётся в работу.
            </Text>
          </View>

          <View style={styles.leadCounters}>
            <View style={[styles.leadCounterChip, { backgroundColor: theme.blueSoft }]}>
              <QuickSvgIcon name="leads" color={theme.blue} />
              <Text style={[styles.leadCounterChipText, { color: theme.blue }]}>
                {leadStats.total}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.leadsGrid}>
          {leads.length === 0 ? (
            <View style={[styles.emptyPremiumCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.emptyPremiumTitle, { color: theme.text }]}>Пока нет заявок</Text>
              <Text style={[styles.emptyPremiumSub, { color: theme.textSecondary }]}>
                Когда с сайта придёт новая заявка, она появится здесь.
              </Text>
            </View>
          ) : (
            leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                theme={theme}
                onPress={handleOpenLead}
              />
            ))
          )}
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={[styles.section, { color: theme.text }]}>Мои заметки</Text>
            <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>
              Локально на устройстве, без сервера
            </Text>
          </View>

          <Pressable onPress={openCreateNote} style={[styles.iconButton, { backgroundColor: theme.blue }]}>
            <ActionSvgIcon name="plus" color="#fff" />
          </Pressable>
        </View>

        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {notes.length === 0 ? (
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
                    styles.row,
                    {
                      backgroundColor: theme.surface,
                      borderBottomColor: theme.divider,
                      borderBottomWidth: index === notes.length - 1 ? 0 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
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
                      <Text style={[styles.rowMeta, { color: theme.textSecondary }]} numberOfLines={2}>
                        {note.body}
                      </Text>
                    )}

                    <Text style={[styles.noteTime, { color: theme.textMuted || theme.textSecondary }]}>
                      Изменено: {new Date(note.updated_at).toLocaleString('ru-RU')}
                    </Text>
                  </View>

                  <View style={styles.rowIcons}>
                    <Pressable onPress={() => openEditNote(note)} style={styles.rowIconBtn}>
                      <ActionSvgIcon name="edit" color={theme.blue} />
                    </Pressable>
                    <ActionSvgIcon name="chevron" color={theme.textSecondary} />
                  </View>
                </Pressable>
              </Swipeable>
            ))
          )}
        </View>

        <View style={[styles.portalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.portalTitle, { color: theme.text }]}>Общий портал задач</Text>
            <Text style={[styles.portalSub, { color: theme.textSecondary }]}>
              Здесь уже серверные задачи для всей команды: создание, выполнение, закрепление и удаление.
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/(app)/tasks' as any)}
            style={[styles.portalButton, { backgroundColor: theme.blueSoft }]}
          >
            <Text style={[styles.portalButtonText, { color: theme.blue }]}>Открыть</Text>
          </Pressable>
        </View>

        <Text style={[styles.section, { color: theme.text, marginTop: 18 }]}>Мои клиенты</Text>
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {clients.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>Нет клиентов в видимой базе.</Text>
          ) : (
            clients.map((client, index) => (
              <Pressable
                key={String(client.id)}
                onPress={() => router.push(`/(app)/client/${client.id}` as any)}
                style={[
                  styles.row,
                  {
                    borderBottomColor: theme.divider,
                    borderBottomWidth: index === clients.length - 1 ? 0 : 1,
                  },
                ]}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>{client.full_name}</Text>
                  <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                    {client.phone || 'Без телефона'} · {client.city || 'Без города'}
                  </Text>
                </View>

                <Text style={[styles.rowValue, { color: theme.blue }]}>{client.status || 'new'}</Text>
              </Pressable>
            ))
          )}
        </View>

        <View style={[styles.reportCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.reportTitle, { color: theme.text }]}>
            {hasReport ? 'Отчёт за сегодня уже отправлен' : 'Отчёт за сегодня ещё не отправлен'}
          </Text>
          <Pressable onPress={() => router.push('/(app)/profile' as any)}>
            <Text style={[styles.reportAction, { color: theme.blue }]}>
              {hasReport ? 'Проверить' : 'Открыть и заполнить'}
            </Text>
          </Pressable>
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
              <Text style={[styles.fabActionText, { color: theme.text }]}>Учет времени</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setFabOpen(false);
                router.push('/(app)/payment/create' as any);
              }}
              style={styles.fabAction}
            >
              <Text style={[styles.fabActionText, { color: theme.text }]}>Быстрый доход / платёж</Text>
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
                  <Text style={[styles.fabActionText, { color: theme.text }]}>Быстрый доход офиса</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setFabOpen(false);
                    openOfficeEntry('expense');
                  }}
                  style={styles.fabAction}
                >
                  <Text style={[styles.fabActionText, { color: theme.text }]}>Быстрый расход офиса</Text>
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
              <Text style={[styles.fabActionText, { color: theme.text }]}>Новая локальная заметка</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setFabOpen(false);
                router.push('/(app)/tasks' as any);
              }}
              style={styles.fabAction}
            >
              <Text style={[styles.fabActionText, { color: theme.text }]}>Открыть портал задач</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setFabOpen(false);
                router.push('/(app)/add-client' as any);
              }}
              style={styles.fabAction}
            >
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
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {officeEntryType === 'income' ? 'Быстрый доход офиса' : 'Быстрый расход офиса'}
            </Text>

            <Text style={[styles.officeFormLabel, { color: theme.textSecondary }]}>
              Офис: {officeDashboard?.office?.city || '—'}
            </Text>

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
                  { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
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
                    backgroundColor: officeEntryType === 'income' ? (theme.success || '#1AAE6F') : theme.red,
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
                <Pressable onPress={() => setLeadModalOpen(false)} style={styles.closeBtn}>
                  <Text style={[styles.closeBtnText, { color: theme.textSecondary }]}>✕</Text>
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
                          { color: active ? '#fff' : theme.textSecondary },
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
                <Pressable
                  onPress={openAddClientFromLead}
                  style={[styles.primaryWideBtn, { backgroundColor: theme.blue }]}
                >
                  <Text style={styles.primaryWideBtnText}>Добавить как клиента</Text>
                </Pressable>

                <Pressable
                  onPress={() => setLeadModalOpen(false)}
                  style={[
                    styles.secondaryWideBtn,
                    { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.secondaryWideBtnInner}>
                    <Text style={[styles.secondaryWideBtnText, { color: theme.text }]}>
                      Закрыть
                    </Text>
                    <ActionSvgIcon name="arrowUpRight" color={theme.textSecondary} />
                  </View>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={noteModalOpen} transparent animationType="slide" onRequestClose={() => setNoteModalOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {noteForm.id ? 'Редактировать заметку' : 'Новая заметка'}
            </Text>

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

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setNoteModalOpen(false)}
                style={[
                  styles.secondaryBtn,
                  { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
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

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  container: { padding: 20, paddingBottom: 120 },

  heroCard: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 18,
    marginBottom: 18,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 3,
  },
  heroSub: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  heroStatsRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  heroStat: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  heroStatLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
  },

  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  caption: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '900', marginTop: 4 },

  fabMini: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  fabMiniText: { fontSize: 24, fontWeight: '900', marginTop: -2 },

  quickGrid: { gap: 12 },
  quickCardPrimary: { borderRadius: 24, padding: 18 },
  quickIconBoxDark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPrimaryTitle: { marginTop: 14, color: '#fff', fontSize: 18, fontWeight: '900' },
  quickPrimarySub: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  quickRow: { flexDirection: 'row', gap: 12 },
  quickCard: { flex: 1, borderWidth: 1, borderRadius: 22, padding: 16 },
  quickIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTitle: { marginTop: 12, fontSize: 15, fontWeight: '800' },

  kpiGrid: { flexDirection: 'row', gap: 12, marginTop: 22 },
  kpiCard: { flex: 1, borderRadius: 22, borderWidth: 1, padding: 18 },
  kpiValue: { fontSize: 22, fontWeight: '900' },
  kpiLabel: { marginTop: 8, fontSize: 13, fontWeight: '700' },

  progressCard: { marginTop: 14, borderRadius: 22, borderWidth: 1, padding: 18 },
  officeProgressCard: { marginTop: 12, borderRadius: 20, padding: 14 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle: { fontSize: 15, fontWeight: '900' },
  progressValue: { fontSize: 14, fontWeight: '900' },
  progressBarBg: { marginTop: 12, height: 10, borderRadius: 999, overflow: 'hidden' },
  progressBarFill: { height: 10, borderRadius: 999 },
  progressSub: { marginTop: 10, fontSize: 13, fontWeight: '700' },

  officeCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 4,
  },
  officeCardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  officeName: {
    fontSize: 18,
    fontWeight: '900',
  },
  officeMeta: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  officeNet: {
    fontSize: 18,
    fontWeight: '900',
  },
  officeKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  officeKpiItem: {
    width: '48%',
    borderRadius: 18,
    padding: 14,
  },
  officeKpiValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  officeKpiLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
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
    padding: 14,
  },
  officeQuickBtnTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  officeQuickBtnSub: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  officeManagersWrap: {
    marginTop: 16,
  },
  officeManagersTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
  },
  officeManagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
  },
  officeManagerName: {
    fontSize: 14,
    fontWeight: '800',
  },
  officeManagerMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  officeManagerProgress: {
    fontSize: 14,
    fontWeight: '900',
  },

  sectionHead: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  section: { fontSize: 18, fontWeight: '900' },
  sectionSub: { marginTop: 4, fontSize: 12, fontWeight: '600', lineHeight: 17 },

  leadCounters: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leadCounterChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leadCounterChipText: {
    fontSize: 12,
    fontWeight: '900',
  },

  leadsGrid: {
    gap: 0,
  },
  emptyPremiumCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
  },
  emptyPremiumTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  emptyPremiumSub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },

  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  panel: { borderWidth: 1, borderRadius: 22, overflow: 'hidden' },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowMeta: { marginTop: 4, fontSize: 12, fontWeight: '600' },
  rowValue: { fontSize: 13, fontWeight: '900' },
  rowIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowIconBtn: { padding: 4 },

  noteTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pinBadgeText: { fontSize: 10, fontWeight: '900' },
  noteTime: { marginTop: 8, fontSize: 11, fontWeight: '600' },

  swipeDelete: {
    width: 112,
    backgroundColor: '#E5484D',
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
  swipeText: { color: '#fff', fontSize: 12, fontWeight: '900' },

  portalCard: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  portalTitle: { fontSize: 15, fontWeight: '900' },
  portalSub: { marginTop: 6, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  portalButton: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  portalButtonText: { fontSize: 13, fontWeight: '900' },

  empty: { padding: 16, fontSize: 14, lineHeight: 20 },

  reportCard: { marginTop: 20, borderWidth: 1, borderRadius: 22, padding: 16 },
  reportTitle: { fontSize: 15, fontWeight: '900' },
  reportAction: { marginTop: 8, fontSize: 14, fontWeight: '900' },

  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(10,20,30,0.28)',
    justifyContent: 'flex-end',
    padding: 20,
  },
  fabMenu: {
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 8,
    marginBottom: 90,
  },
  fabAction: { paddingHorizontal: 16, paddingVertical: 16 },
  fabActionText: { fontSize: 15, fontWeight: '800' },

  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(7, 12, 20, 0.35)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalCard: { borderWidth: 1, borderRadius: 24, padding: 18 },
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
    fontWeight: '600',
  },
  modalTitle: { fontSize: 18, fontWeight: '900' },

  officeFormLabel: {
    marginTop: 10,
    marginBottom: 2,
    fontSize: 12,
    fontWeight: '800',
  },

  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 17,
    fontWeight: '800',
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
    fontWeight: '800',
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
  },
  secondaryWideBtnInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  secondaryWideBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },

  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 10,
  },
  textarea: { minHeight: 110, textAlignVertical: 'top' as const },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  secondaryBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '800' },
  primaryBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});