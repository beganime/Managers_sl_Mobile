import { BlurView } from 'expo-blur';
import { Tabs, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppTabIcon from '../../components/ui/AppTabIcon';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import apiClient from '../../src/api/apiClient';
import { useTheme } from '../../src/context/ThemeContext';
import { ensureWorkdayRemindersScheduled } from '../../src/notifications/workdayReminders';

const TAB_HEIGHT = Platform.OS === 'ios' ? 86 : 74;
const TAB_BOTTOM = Platform.OS === 'ios' ? 18 : 12;
const FAB_SIZE = 64;
const ACTION_SIZE = 54;
const SCREEN = Dimensions.get('window');

function PlusIcon({ color = '#fff', size = 26, rotated = false }: { color?: string; size?: number; rotated?: boolean }) {
  return (
    <Animated.Text
      style={{
        color,
        fontSize: size,
        fontWeight: '900',
        lineHeight: size + 2,
        transform: [{ rotate: rotated ? '45deg' : '0deg' }],
      }}
    >
      +
    </Animated.Text>
  );
}

function MiniActionIcon({
  type,
  color,
}: {
  type: 'income' | 'expense' | 'refresh';
  color: string;
}) {
  if (type === 'income') {
    return <Text style={{ color, fontSize: 18, fontWeight: '900' }}>↗</Text>;
  }
  if (type === 'expense') {
    return <Text style={{ color, fontSize: 18, fontWeight: '900' }}>↘</Text>;
  }
  return <Text style={{ color, fontSize: 18, fontWeight: '900' }}>↻</Text>;
}

export default function AppTabsLayout() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { theme, themeMode } = useTheme();

  const isAdmin = !!user && (user.is_superuser || user.is_staff || user.role === 'admin');
  const dark = themeMode === 'dark';

  const [fabOpen, setFabOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [refreshingStats, setRefreshingStats] = useState(false);

  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCurrencyId, setExpenseCurrencyId] = useState('');

  const startX = SCREEN.width - FAB_SIZE - 18;
  const startY = SCREEN.height - TAB_HEIGHT - TAB_BOTTOM - FAB_SIZE - 26;

  const pan = useRef(new Animated.ValueXY({ x: startX, y: startY })).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const openAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    ensureWorkdayRemindersScheduled();
  }, []);

  const closeFab = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
        tension: 140,
      }),
      Animated.timing(openAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => setFabOpen(false));
  };

  const openFab = () => {
    setFabOpen(true);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1.04,
        useNativeDriver: true,
        friction: 6,
        tension: 140,
      }),
      Animated.timing(openAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const toggleFab = () => {
    if (fabOpen) closeFab();
    else openFab();
  };

  const snapToBounds = (x: number, y: number) => {
    const minX = 10;
    const maxX = SCREEN.width - FAB_SIZE - 10;
    const minY = 90;
    const maxY = SCREEN.height - TAB_HEIGHT - TAB_BOTTOM - FAB_SIZE - 8;

    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    };
  };

  const lastOffset = useRef({ x: startX, y: startY });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
        onPanResponderGrant: () => {
          pan.stopAnimation((value) => {
            lastOffset.current = { x: value.x, y: value.y };
          });
          Animated.spring(scaleAnim, {
            toValue: 1.06,
            useNativeDriver: true,
            friction: 6,
            tension: 150,
          }).start();
        },
        onPanResponderMove: (_, gesture) => {
          const next = snapToBounds(
            lastOffset.current.x + gesture.dx,
            lastOffset.current.y + gesture.dy
          );
          pan.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          const next = snapToBounds(
            lastOffset.current.x + gesture.dx,
            lastOffset.current.y + gesture.dy
          );
          lastOffset.current = next;

          Animated.parallel([
            Animated.spring(pan, {
              toValue: next,
              useNativeDriver: false,
              friction: 7,
              tension: 90,
            }),
            Animated.spring(scaleAnim, {
              toValue: fabOpen ? 1.04 : 1,
              useNativeDriver: true,
              friction: 6,
              tension: 150,
            }),
          ]).start();
        },
      }),
    [fabOpen, pan, scaleAnim]
  );

  const resetExpenseForm = () => {
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseCurrencyId('');
  };

  const openIncomeFlow = () => {
    closeFab();
    router.push('/(app)/payment/create');
  };

  const openExpenseFlow = () => {
    closeFab();
    setExpenseModalOpen(true);
  };

  const refreshCurrentPeriod = async () => {
    try {
      setRefreshingStats(true);
      closeFab();
      await apiClient.get('analytics/periods/current/');
      Alert.alert('Готово', 'Данные периода обновлены.');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.detail || 'Не удалось обновить данные.');
    } finally {
      setRefreshingStats(false);
    }
  };

  const submitExpense = async () => {
    const amount = Number(String(expenseAmount).replace(',', '.'));

    if (!expenseTitle.trim()) {
      Alert.alert('Ошибка', 'Укажи название расхода.');
      return;
    }
    if (!amount || amount <= 0) {
      Alert.alert('Ошибка', 'Укажи корректную сумму.');
      return;
    }
    if (!expenseCurrencyId.trim()) {
      Alert.alert('Ошибка', 'Укажи ID валюты.');
      return;
    }

    try {
      setSavingExpense(true);

      await apiClient.post('analytics/expenses/', {
        title: expenseTitle.trim(),
        amount,
        currency: Number(expenseCurrencyId),
      });

      await apiClient.get('analytics/periods/current/');

      setExpenseModalOpen(false);
      resetExpenseForm();
      Alert.alert('Готово', 'Расход добавлен и данные обновлены.');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.detail || 'Не удалось добавить расход.');
    } finally {
      setSavingExpense(false);
    }
  };

  const actionTranslateUp1 = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, -74],
  });
  const actionTranslateUp2 = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, -140],
  });
  const actionTranslateUp3 = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, -206],
  });

  const actionOpacity = openAnim.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0.4, 1],
  });

  const fabRotate = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: dark ? '#FFFFFF' : theme.text,
          tabBarInactiveTintColor: theme.textMuted,
          tabBarLabelPosition: 'below-icon',
          tabBarStyle: {
            position: 'absolute',
            left: 14,
            right: 14,
            bottom: TAB_BOTTOM,
            height: TAB_HEIGHT,
            borderRadius: 28,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: dark ? 0.28 : 0.12,
            shadowRadius: 20,
            overflow: 'hidden',
          },
          tabBarBackground: () => (
            <View style={StyleSheet.absoluteFillObject}>
              <BlurView
                intensity={dark ? 45 : 90}
                tint={dark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFillObject}
              />
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  styles.tabShell,
                  {
                    backgroundColor: dark ? 'rgba(15,23,35,0.82)' : 'rgba(255,255,255,0.82)',
                    borderColor: theme.border,
                  },
                ]}
              />
              <View
                style={[
                  styles.topHairline,
                  { backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)' },
                ]}
              />
            </View>
          ),
          tabBarItemStyle: {
            paddingTop: 7,
            paddingBottom: Platform.OS === 'ios' ? 11 : 10,
          },
          tabBarIconStyle: {
            marginBottom: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Главная',
            tabBarLabel: ({ color, focused }) => (
              <Text style={{ color, fontSize: 10.5, fontWeight: focused ? '900' : '700' }}>
                Главная
              </Text>
            ),
            tabBarIcon: ({ color, focused }) => (
              <AppTabIcon name="home" color={color} focused={focused} size={22} />
            ),
          }}
        />

        <Tabs.Screen
          name="crm"
          options={{
            title: 'CRM',
            tabBarLabel: ({ color, focused }) => (
              <Text style={{ color, fontSize: 10.5, fontWeight: focused ? '900' : '700' }}>
                CRM
              </Text>
            ),
            tabBarIcon: ({ color, focused }) => (
              <AppTabIcon name="crm" color={color} focused={focused} size={22} />
            ),
          }}
        />

        <Tabs.Screen
          name="leaderboard"
          options={{
            title: isAdmin ? 'Команда' : 'Рейтинг',
            tabBarLabel: ({ color, focused }) => (
              <Text style={{ color, fontSize: 10.5, fontWeight: focused ? '900' : '700' }}>
                {isAdmin ? 'Команда' : 'Рейтинг'}
              </Text>
            ),
            tabBarIcon: ({ color, focused }) => (
              <AppTabIcon name="rank" color={color} focused={focused} size={22} />
            ),
          }}
        />

        <Tabs.Screen
          name="catalog"
          options={{
            title: 'Вузы',
            tabBarLabel: ({ color, focused }) => (
              <Text style={{ color, fontSize: 10.5, fontWeight: focused ? '900' : '700' }}>
                Вузы
              </Text>
            ),
            tabBarIcon: ({ color, focused }) => (
              <AppTabIcon name="catalog" color={color} focused={focused} size={22} />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: 'Профиль',
            tabBarLabel: ({ color, focused }) => (
              <Text style={{ color, fontSize: 10.5, fontWeight: focused ? '900' : '700' }}>
                Профиль
              </Text>
            ),
            tabBarIcon: ({ color, focused }) => (
              <AppTabIcon name="profile" color={color} focused={focused} size={22} />
            ),
          }}
        />

        <Tabs.Screen name="documents" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="client/[id]" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="deal/[id]" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="add-deal" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="create-document" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="add-client" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="payment/create" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="university/[id]" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="knowledge-base" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="admin-staff" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="admin-reports" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="admin-payments" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="tasks" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="workday" options={{ href: null, headerShown: false }} />
      </Tabs>

      <Animated.View
        style={[
          styles.fabLayer,
          {
            transform: [{ translateX: pan.x }, { translateY: pan.y }],
          },
        ]}
        pointerEvents="box-none"
      >
        <Animated.View
          pointerEvents={fabOpen ? 'auto' : 'none'}
          style={[
            styles.actionWrap,
            {
              opacity: actionOpacity,
              transform: [{ translateY: actionTranslateUp3 }],
            },
          ]}
        >
          <Pressable onPress={refreshCurrentPeriod}>
            <BlurView
              intensity={dark ? 32 : 78}
              tint={dark ? 'dark' : 'light'}
              style={[
                styles.actionButton,
                {
                  borderColor: theme.border,
                  backgroundColor: dark ? 'rgba(18,26,38,0.78)' : 'rgba(255,255,255,0.72)',
                },
              ]}
            >
              {refreshingStats ? (
                <ActivityIndicator size="small" color={theme.blue} />
              ) : (
                <MiniActionIcon type="refresh" color={theme.blue} />
              )}
              <Text style={[styles.actionLabel, { color: theme.text }]}>Обновить</Text>
            </BlurView>
          </Pressable>
        </Animated.View>

        <Animated.View
          pointerEvents={fabOpen ? 'auto' : 'none'}
          style={[
            styles.actionWrap,
            {
              opacity: actionOpacity,
              transform: [{ translateY: actionTranslateUp2 }],
            },
          ]}
        >
          <Pressable onPress={openExpenseFlow}>
            <BlurView
              intensity={dark ? 32 : 78}
              tint={dark ? 'dark' : 'light'}
              style={[
                styles.actionButton,
                {
                  borderColor: theme.border,
                  backgroundColor: dark ? 'rgba(18,26,38,0.78)' : 'rgba(255,255,255,0.72)',
                },
              ]}
            >
              <MiniActionIcon type="expense" color="#EF4444" />
              <Text style={[styles.actionLabel, { color: theme.text }]}>Расход</Text>
            </BlurView>
          </Pressable>
        </Animated.View>

        <Animated.View
          pointerEvents={fabOpen ? 'auto' : 'none'}
          style={[
            styles.actionWrap,
            {
              opacity: actionOpacity,
              transform: [{ translateY: actionTranslateUp1 }],
            },
          ]}
        >
          <Pressable onPress={openIncomeFlow}>
            <BlurView
              intensity={dark ? 32 : 78}
              tint={dark ? 'dark' : 'light'}
              style={[
                styles.actionButton,
                {
                  borderColor: theme.border,
                  backgroundColor: dark ? 'rgba(18,26,38,0.78)' : 'rgba(255,255,255,0.72)',
                },
              ]}
            >
              <MiniActionIcon type="income" color="#22C55E" />
              <Text style={[styles.actionLabel, { color: theme.text }]}>Доход</Text>
            </BlurView>
          </Pressable>
        </Animated.View>

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.fabWrap,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Pressable onPress={toggleFab}>
            <BlurView
              intensity={dark ? 30 : 80}
              tint={dark ? 'dark' : 'light'}
              style={[
                styles.fabButton,
                {
                  borderColor: theme.border,
                  backgroundColor: dark ? 'rgba(21,32,48,0.76)' : 'rgba(255,255,255,0.70)',
                  shadowColor: theme.shadow,
                },
              ]}
            >
              <Animated.View style={{ transform: [{ rotate: fabRotate }] }}>
                <PlusIcon color={dark ? '#FFFFFF' : theme.text} size={28} />
              </Animated.View>
            </BlurView>
          </Pressable>
        </Animated.View>
      </Animated.View>

      <Modal
        visible={expenseModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setExpenseModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <BlurView
            intensity={dark ? 26 : 65}
            tint={dark ? 'dark' : 'light'}
            style={[
              styles.modalCard,
              {
                borderColor: theme.border,
                backgroundColor: dark ? 'rgba(19,27,39,0.88)' : 'rgba(255,255,255,0.88)',
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>Быстрый расход</Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
              Добавь расход и сразу обнови текущий период
            </Text>

            <TextInput
              value={expenseTitle}
              onChangeText={setExpenseTitle}
              placeholder="Название расхода"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)',
                },
              ]}
            />

            <TextInput
              value={expenseAmount}
              onChangeText={setExpenseAmount}
              placeholder="Сумма"
              placeholderTextColor={theme.textMuted}
              keyboardType="decimal-pad"
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)',
                },
              ]}
            />

            <TextInput
              value={expenseCurrencyId}
              onChangeText={setExpenseCurrencyId}
              placeholder="ID валюты"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)',
                },
              ]}
            />

            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Для расхода backend ждёт `title`, `amount`, `currency`. 
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setExpenseModalOpen(false);
                  resetExpenseForm();
                }}
                style={[
                  styles.modalSecondaryBtn,
                  {
                    borderColor: theme.border,
                    backgroundColor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.60)',
                  },
                ]}
              >
                <Text style={[styles.modalSecondaryText, { color: theme.text }]}>Отмена</Text>
              </Pressable>

              <Pressable
                onPress={submitExpense}
                style={[styles.modalPrimaryBtn, { backgroundColor: theme.blue }]}
              >
                {savingExpense ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Сохранить</Text>
                )}
              </Pressable>
            </View>
          </BlurView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tabShell: {
    borderRadius: 28,
    borderWidth: 1,
  },
  topHairline: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
    height: 1,
    borderRadius: 999,
  },

  fabLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: FAB_SIZE,
    height: FAB_SIZE,
    zIndex: 80,
    elevation: 80,
  },
  fabWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  fabButton: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
    overflow: 'hidden',
  },

  actionWrap: {
    position: 'absolute',
    left: 5,
    top: 0,
  },
  actionButton: {
    width: 156,
    height: ACTION_SIZE,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '800',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,10,18,0.24)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  modalSub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    marginBottom: 14,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginTop: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalSecondaryBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: {
    fontSize: 14,
    fontWeight: '800',
  },
  modalPrimaryBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
});