// app/(app)/deal/[id].tsx
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import ScreenWrapper from '../../../components/ScreenWrapper';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import apiClient from '../../../src/api/apiClient';
import { useTheme } from '../../../src/context/ThemeContext';
import { getToken } from '../../../src/utils/storage';

function money(v: any) {
  const n = Number(v || 0);
  return `$${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}`;
}

function safeValue(value: any) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function paymentStatusLabel(status?: string) {
  const map: Record<string, string> = {
    new: 'Новая',
    unpaid: 'Не оплачено',
    partial: 'Частично оплачено',
    paid: 'Оплачено',
    paid_partial: 'Частично оплачено',
    paid_full: 'Оплачено полностью',
    closed: 'Закрыта',
  };
  return map[status || ''] || status || '—';
}

function dealTypeLabel(type?: string) {
  const map: Record<string, string> = {
    university: 'Поступление',
    service: 'Услуга',
  };
  return map[type || ''] || type || '—';
}

function methodLabel(method?: string) {
  const map: Record<string, string> = {
    cash: 'Наличные',
    card: 'Карта',
    bank: 'Банковский перевод',
  };
  return map[method || ''] || method || '—';
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusTone(status: string | undefined, theme: any) {
  if (status === 'paid' || status === 'paid_full') {
    return { bg: '#EAF8EF', color: theme.success };
  }
  if (status === 'partial' || status === 'paid_partial') {
    return { bg: '#FFF4E8', color: theme.warning };
  }
  return { bg: theme.blueSoft, color: theme.blue };
}

function paymentTone(isConfirmed: boolean, theme: any) {
  return isConfirmed
    ? { bg: '#EAF8EF', color: theme.success, label: 'CONFIRMED' }
    : { bg: '#FFF4E8', color: theme.warning, label: 'PENDING' };
}

function InfoRow({
  theme,
  icon,
  label,
  value,
  divider = true,
}: {
  theme: any;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        divider && { borderBottomWidth: 1, borderBottomColor: theme.divider },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: theme.backgroundSoft, borderColor: theme.border },
        ]}
      >
        <Ionicons name={icon} size={18} color={theme.blue} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: theme.text }]}>{value}</Text>
      </View>
    </View>
  );
}

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useCurrentUser();

  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');

  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const loadDeal = useCallback(async () => {
    try {
      if (id && String(id).startsWith('temp_')) {
        const offlineDeals = JSON.parse((await getToken('offline_deals')) || '[]');
        const found = offlineDeals.find((d: any) => String(d.id) === String(id));
        if (found) {
          setDeal(found);
          return;
        }
      }

      const response = await apiClient.get(`analytics/deals/${id}/`);
      setDeal(response.data);
    } catch (error) {
      console.error('Ошибка загрузки сделки', error);
      Alert.alert('Ошибка', 'Не удалось загрузить карточку сделки.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadDeal();
  }, [loadDeal]);

  useFocusEffect(
    useCallback(() => {
      loadDeal();
    }, [loadDeal])
  );

  const outstanding = useMemo(() => {
    if (!deal) return 0;
    return Math.max(
      0,
      Number(deal.total_to_pay_usd || 0) - Number(deal.paid_amount_usd || 0)
    );
  }, [deal]);

  const progressPercent = useMemo(() => {
    if (!deal) return 0;
    const total = Number(deal.total_to_pay_usd || 0);
    const paid = Number(deal.paid_amount_usd || 0);
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, (paid / total) * 100));
  }, [deal]);

  const confirmedPayments = useMemo(() => {
    const list = Array.isArray(deal?.payments) ? deal.payments : [];
    return list.filter((p: any) => !!p.is_confirmed);
  }, [deal]);

  const pendingPayments = useMemo(() => {
    const list = Array.isArray(deal?.payments) ? deal.payments : [];
    return list.filter((p: any) => !p.is_confirmed);
  }, [deal]);

  const confirmPayment = async (paymentId: number | string) => {
    if (!isAdmin) return;

    setConfirmingId(String(paymentId));
    try {
      await apiClient.post(`analytics/payments/${paymentId}/confirm/`, {});
      await loadDeal();
      Alert.alert('Готово', 'Платёж подтверждён.');
    } catch (error: any) {
      Alert.alert(
        'Ошибка',
        error?.response?.data?.detail || 'Не удалось подтвердить платёж.'
      );
    } finally {
      setConfirmingId(null);
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

  if (!deal) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.red }]}>Сделка не найдена</Text>
        </View>
      </ScreenWrapper>
    );
  }

  const mainTone = statusTone(deal.payment_status, theme);

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace('/(app)/crm' as any)}
          style={[
            styles.backBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: theme.text }]}>Карточка сделки</Text>

        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadDeal();
            }}
            tintColor={theme.blue}
          />
        }
      >
        <View style={[styles.mainCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: theme.blueSoft }]}>
            <Ionicons
              name={deal.deal_type === 'university' ? 'school' : 'briefcase'}
              size={28}
              color={theme.blue}
            />
          </View>

          <Text style={[styles.dealTitle, { color: theme.text }]}>Сделка #{safeValue(deal.id)}</Text>
          <Text style={[styles.dealSubtitle, { color: theme.textSecondary }]}>
            {deal.client_data?.full_name || 'Клиент'} · {dealTypeLabel(deal.deal_type)}
          </Text>

          <View style={styles.heroBadges}>
            <View style={[styles.badge, { backgroundColor: mainTone.bg }]}>
              <Text style={[styles.badgeText, { color: mainTone.color }]}>
                {paymentStatusLabel(deal.payment_status)}
              </Text>
            </View>
          </View>

          <View style={[styles.progressWrap, { backgroundColor: theme.backgroundSoft, borderColor: theme.border }]}>
            <View style={styles.progressHead}>
              <Text style={[styles.progressLabel, { color: theme.text }]}>Оплата</Text>
              <Text style={[styles.progressPercent, { color: theme.blue }]}>
                {progressPercent.toFixed(0)}%
              </Text>
            </View>

            <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progressPercent}%`,
                    backgroundColor: progressPercent >= 100 ? theme.success : theme.blue,
                  },
                ]}
              />
            </View>

            <View style={styles.progressStats}>
              <Text style={[styles.progressStatText, { color: theme.textSecondary }]}>
                Подтверждено: {confirmedPayments.length}
              </Text>
              <Text style={[styles.progressStatText, { color: theme.textSecondary }]}>
                Ожидают: {pendingPayments.length}
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Основная информация</Text>
        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <InfoRow theme={theme} icon="person" label="Клиент" value={safeValue(deal.client_data?.full_name)} />
          <InfoRow theme={theme} icon="briefcase" label="Тип сделки" value={dealTypeLabel(deal.deal_type)} />
          <InfoRow theme={theme} icon="person-circle" label="Менеджер" value={safeValue(deal.manager_data?.full_name || deal.manager)} />
          <InfoRow theme={theme} icon="calendar" label="Создана" value={formatDate(deal.created_at)} divider={false} />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Финансы</Text>
        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <InfoRow theme={theme} icon="wallet" label="Всего к оплате" value={money(deal.total_to_pay_usd)} />
          <InfoRow theme={theme} icon="card" label="Оплачено" value={money(deal.paid_amount_usd)} />
          <InfoRow theme={theme} icon="hourglass" label="Остаток" value={money(outstanding)} divider={false} />
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Платежи</Text>
        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {!deal.payments || !deal.payments.length ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Платежей пока нет.</Text>
            </View>
          ) : (
            deal.payments.map((p: any, index: number) => {
              const tone = paymentTone(!!p.is_confirmed, theme);
              const busy = confirmingId === String(p.id);

              return (
                <View
                  key={String(p.id)}
                  style={[
                    styles.paymentRowWrap,
                    index !== deal.payments.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: theme.divider,
                    },
                  ]}
                >
                  <View style={styles.paymentRowTop}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={[styles.paymentTitle, { color: theme.text }]}>
                        {money(p.amount_usd || p.amount)}
                      </Text>
                      <Text style={[styles.paymentMeta, { color: theme.textSecondary }]}>
                        {methodLabel(p.method)} · {formatDate(p.payment_date || p.updated_at)}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={[styles.payBadge, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.payBadgeText, { color: tone.color }]}>{tone.label}</Text>
                      </View>
                    </View>
                  </View>

                  {isAdmin && !p.is_confirmed ? (
                    <Pressable
                      onPress={() => confirmPayment(p.id)}
                      disabled={busy}
                      style={[styles.confirmBtn, { backgroundColor: theme.success }]}
                    >
                      {busy ? <ActivityIndicator color="#fff" /> : (
                        <>
                          <Ionicons name="checkmark-circle" size={18} color="#fff" />
                          <Text style={styles.confirmBtnText}>Подтвердить платёж</Text>
                        </>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        <View style={styles.actionsWrap}>
          {!String(deal.id).startsWith('temp_') && (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(app)/payment/create',
                  params: { dealId: String(deal.id) },
                } as any)
              }
              style={[styles.actionBtn, { backgroundColor: theme.success }]}
            >
              <Ionicons name="card" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Добавить платёж</Text>
            </Pressable>
          )}
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  errorText: { fontSize: 16, textAlign: 'center', fontWeight: '700' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  mainCard: { alignItems: 'center', padding: 24, borderRadius: 28, marginBottom: 20, borderWidth: 1 },
  heroIcon: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  dealTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  dealSubtitle: { marginTop: 8, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  heroBadges: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' },
  badge: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  progressWrap: { width: '100%', marginTop: 18, borderWidth: 1, borderRadius: 20, padding: 14 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 14, fontWeight: '800' },
  progressPercent: { fontSize: 16, fontWeight: '900' },
  progressBar: { height: 10, borderRadius: 999, overflow: 'hidden', marginTop: 12 },
  progressFill: { height: 10, borderRadius: 999 },
  progressStats: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  progressStatText: { fontSize: 12, fontWeight: '700' },
  sectionTitle: { fontSize: 12, fontWeight: '900', marginBottom: 10, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 },
  infoCard: { borderRadius: 24, marginBottom: 20, overflow: 'hidden', borderWidth: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 16 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  infoLabel: { fontSize: 11, marginBottom: 4, fontWeight: '800', textTransform: 'uppercase' },
  infoValue: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  emptyState: { padding: 18, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600' },
  paymentRowWrap: { padding: 16 },
  paymentRowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  paymentTitle: { fontSize: 15, fontWeight: '900' },
  paymentMeta: { marginTop: 6, fontSize: 12, fontWeight: '600' },
  payBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  payBadgeText: { fontSize: 11, fontWeight: '900' },
  confirmBtn: { marginTop: 12, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  actionsWrap: { gap: 12 },
  actionBtn: { flexDirection: 'row', padding: 18, borderRadius: 18, justifyContent: 'center', alignItems: 'center', gap: 10 },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});