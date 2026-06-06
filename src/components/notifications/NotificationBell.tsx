import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { extractCount, extractItems, toApiError } from '../../api/client';
import { listNotifications, markNotificationRead } from '../../api/notifications';
import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { ApiListItem } from '../../types';
import { formatEntityDate, getEntityId, getEntityString, getEntityTitle, stripHtml } from '../../utils/entity';

function isUnread(item: ApiListItem) {
  return getEntityString(item, ['is_read']) !== 'true' && getEntityString(item, ['status']) !== 'read';
}

export function NotificationBell() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ApiListItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [markingId, setMarkingId] = useState<string | number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await listNotifications({ limit: 3 });
      const nextItems = extractItems<ApiListItem>(response).slice(0, 3);
      setItems(nextItems);
      setUnreadCount(nextItems.filter(isUnread).length);
    } catch (requestError) {
      setError(toApiError(requestError).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadBadge = async () => {
      try {
        const response = await listNotifications({ limit: 1, unread: true });
        const count = extractCount<ApiListItem>(response);
        if (mounted) setUnreadCount(count);
      } catch {
        if (mounted) setUnreadCount(0);
      }
    };

    void loadBadge();

    return () => {
      mounted = false;
    };
  }, []);

  const openPanel = () => {
    setOpen(true);
    void load();
  };

  const markRead = async (item: ApiListItem) => {
    const id = getEntityId(item);
    if (!id) return;

    setMarkingId(id);
    try {
      const updated = await markNotificationRead(id);
      setItems((current) => current.map((entry) => (getEntityId(entry) === id ? updated : entry)));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (requestError) {
      setError(toApiError(requestError).message);
    } finally {
      setMarkingId(null);
    }
  };

  const markVisibleRead = async () => {
    const unread = items.filter(isUnread);
    for (const item of unread) {
      await markRead(item);
    }
  };

  const openAll = () => {
    setOpen(false);
    router.push('/(app)/notifications' as any);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Уведомления"
        hitSlop={10}
        onPress={openPanel}
        style={({ pressed }) => [
          styles.bell,
          {
            borderColor: appTheme.colors.glassBorder,
            backgroundColor: appTheme.dark ? 'rgba(255,255,255,0.14)' : appTheme.colors.surfaceStrong,
            ...appTheme.shadow.card,
          },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="notifications-outline"
          size={20}
          color={appTheme.dark ? appTheme.colors.screenText : appTheme.colors.primary}
        />
        {unreadCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: appTheme.colors.accent }]}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={[
            styles.overlay,
            { backgroundColor: appTheme.dark ? 'rgba(0,0,0,0.44)' : 'rgba(7,26,51,0.18)' },
          ]}
          onPress={() => setOpen(false)}
        >
          <BlurView intensity={18} tint={appTheme.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
          <Pressable
            style={[
              styles.panel,
              {
                borderColor: appTheme.colors.glassBorder,
                backgroundColor: appTheme.colors.surfaceStrong,
                ...appTheme.shadow.floating,
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.panelTop}>
              <View>
                <Text style={[styles.panelTitle, { color: appTheme.colors.text }]}>Уведомления</Text>
                <Text style={[styles.panelSubtitle, { color: appTheme.colors.textMuted }]}>Последние события кабинета</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} style={[styles.closeButton, { backgroundColor: appTheme.colors.primarySoft }]}>
                <Ionicons name="close" size={18} color={appTheme.colors.textMuted} />
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={appTheme.colors.primary} />
                <Text style={[styles.muted, { color: appTheme.colors.textMuted }]}>Загружаем уведомления</Text>
              </View>
            ) : null}

            {!loading && error ? <Text style={[styles.error, { color: appTheme.colors.danger }]}>{error}</Text> : null}

            {!loading && !error && items.length === 0 ? (
              <Text style={[styles.muted, { color: appTheme.colors.textMuted }]}>Новых уведомлений пока нет.</Text>
            ) : null}

            {!loading && !error
              ? items.map((item) => {
                  const id = getEntityId(item);
                  const unread = isUnread(item);

                  return (
                    <View
                      key={String(id)}
                      style={[
                        styles.item,
                        {
                          borderColor: unread ? appTheme.colors.accentSoft : appTheme.colors.border,
                          backgroundColor: unread ? appTheme.colors.accentSoft : appTheme.colors.surfaceSoft,
                        },
                      ]}
                    >
                      <View style={[styles.itemIcon, { backgroundColor: appTheme.colors.primarySoft }]}>
                        <Ionicons
                          name={unread ? 'mail-unread-outline' : 'mail-open-outline'}
                          size={18}
                          color={unread ? appTheme.colors.accent : appTheme.colors.textMuted}
                        />
                      </View>
                      <View style={styles.itemText}>
                        <Text style={[styles.itemTitle, { color: appTheme.colors.text }]} numberOfLines={1}>{getEntityTitle(item, 'Уведомление')}</Text>
                        <Text style={[styles.itemBody, { color: appTheme.colors.textMuted }]} numberOfLines={2}>
                          {stripHtml(getEntityString(item, ['body', 'message', 'text'])) || 'Без текста'}
                        </Text>
                        <Text style={[styles.itemDate, { color: appTheme.colors.textSoft }]}>{formatEntityDate(item.created_at) || 'Сегодня'}</Text>
                      </View>
                      {unread ? (
                        <Pressable
                          disabled={markingId === id}
                          onPress={() => markRead(item)}
                          style={[styles.readButton, { backgroundColor: appTheme.colors.accent }]}
                        >
                          {markingId === id ? (
                            <ActivityIndicator size="small" color={appTheme.colors.white} />
                          ) : (
                            <Ionicons name="checkmark" size={17} color={appTheme.colors.white} />
                          )}
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })
              : null}

            <View style={styles.actions}>
              <Pressable onPress={markVisibleRead} style={[styles.secondaryAction, { backgroundColor: appTheme.colors.primarySoft }]}>
                <Text style={[styles.secondaryText, { color: appTheme.colors.primary }]}>Прочитать последние</Text>
              </Pressable>
              <Pressable onPress={openAll} style={[styles.primaryAction, { backgroundColor: appTheme.colors.primary }]}>
                <Text style={[styles.primaryText, { color: appTheme.colors.white }]}>Открыть все</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
    ...theme.shadow.card,
  },
  pressed: {
    opacity: 0.72,
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
  },
  badge: {
    position: 'absolute',
    right: -4,
    top: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 72,
    backgroundColor: 'rgba(7,26,51,0.18)',
  },
  panel: {
    overflow: 'hidden',
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.surfaceStrong,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadow.floating,
  },
  panelTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  panelTitle: {
    color: theme.colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  panelSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  center: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  muted: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  error: {
    color: theme.colors.danger,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
  },
  itemUnread: {
    borderColor: theme.colors.accentSoft,
    backgroundColor: 'rgba(152,27,46,0.06)',
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  itemText: {
    flex: 1,
    gap: 3,
  },
  itemTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  itemBody: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  itemDate: {
    color: theme.colors.textSoft,
    fontSize: 11,
    fontWeight: '800',
  },
  readButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  primaryAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  secondaryText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  primaryText: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
});
