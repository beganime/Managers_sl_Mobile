import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/cards/Card';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { useAuth } from '../../store/auth';
import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';

type MoreItem = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: string;
  danger?: boolean;
  onPress?: () => void;
};

export function MoreScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const { logout } = useAuth();

  const confirmLogout = () => {
    Alert.alert('Выход', 'Завершить текущую сессию?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: () => {
          void logout().then(() => router.replace('/login' as any));
        },
      },
    ]);
  };

  const items: MoreItem[] = [
    {
      title: 'Задачи',
      subtitle: 'Мои задачи, проекты и командная работа',
      icon: 'checkbox-outline',
      route: '/(app)/(tabs)/tasks',
    },
    {
      title: 'Проекты',
      subtitle: 'Проекты, разделы и командные задачи',
      icon: 'briefcase-outline',
      route: '/(app)/projects-v2',
    },
    {
      title: 'Мои отчёты',
      subtitle: 'История рабочих отчётов за вчера, позавчера и другие дни',
      icon: 'reader-outline',
      route: '/(app)/reports-history',
    },
    {
      title: 'Вузы',
      subtitle: 'Страны, города, университеты и программы',
      icon: 'school-outline',
      route: '/(app)/education',
    },
    {
      title: 'Услуги',
      subtitle: 'Категории, услуги и прайс-листы',
      icon: 'pricetags-outline',
      route: '/(app)/services-v2',
    },
    {
      title: 'Календарь',
      subtitle: 'События, задачи и рабочий день',
      icon: 'calendar-outline',
      route: '/(app)/calendar',
    },
    {
      title: 'Документы',
      subtitle: 'Шаблоны, генерация и согласование',
      icon: 'document-text-outline',
      route: '/(app)/documents-v2',
    },
    {
      title: 'База знаний',
      subtitle: 'Категории, статьи и вложения',
      icon: 'library-outline',
      route: '/(app)/knowledge',
    },
    {
      title: 'Уведомления',
      subtitle: 'Последние события кабинета',
      icon: 'notifications-outline',
      route: '/(app)/notifications',
    },
    {
      title: 'Профиль',
      subtitle: 'Пользователь, должность, офис и сессия',
      icon: 'person-circle-outline',
      route: '/(app)/profile-v2',
    },
    {
      title: 'Настройки',
      subtitle: 'Внешний вид, push и параметры приложения',
      icon: 'settings-outline',
      route: '/(app)/settings',
    },
    {
      title: 'Выход',
      subtitle: 'Завершить сессию на устройстве',
      icon: 'log-out-outline',
      danger: true,
      onPress: confirmLogout,
    },
  ];

  return (
    <ScreenContainer>
      <Header
        title="Ещё"
        eyebrow="Students Life Program for Managers"
        subtitle="Дополнительные разделы ManagerSL ERP/CRM workspace."
      />

      <Card glass style={styles.hero}>
        <Text style={[styles.heroTitle, { color: appTheme.colors.text }]}>ManagerSL mobile cabinet</Text>
        <Text style={[styles.heroText, { color: appTheme.colors.textMuted }]}>
          Управление CRM, задачами, документами, знаниями, отчётами и настройками собрано в одном месте.
        </Text>
      </Card>

      <View style={styles.list}>
        {items.map((item) => (
          <MoreListItem
            key={item.title}
            item={item}
            onPress={() => (item.onPress ? item.onPress() : router.push(item.route as any))}
          />
        ))}
      </View>
    </ScreenContainer>
  );
}

function MoreListItem({ item, onPress }: { item: MoreItem; onPress: () => void }) {
  const appTheme = useAppTheme();

  const content = (
    <>
      <View
        style={[
          styles.icon,
          { backgroundColor: item.danger ? 'rgba(255,255,255,0.16)' : appTheme.colors.primarySoft },
        ]}
      >
        <Ionicons
          name={item.icon}
          size={22}
          color={item.danger ? appTheme.colors.white : appTheme.colors.primary}
        />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.title, { color: item.danger ? appTheme.colors.white : appTheme.colors.text }]}>
          {item.title}
        </Text>
        <Text style={[styles.subtitle, { color: item.danger ? 'rgba(255,255,255,0.78)' : appTheme.colors.textMuted }]}>
          {item.subtitle}
        </Text>
      </View>
      {!item.danger ? (
        <Ionicons name="chevron-forward" size={20} color={appTheme.colors.textMuted} />
      ) : (
        <Ionicons name="log-out-outline" size={20} color={appTheme.colors.white} />
      )}
    </>
  );

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.rowPressed]}>
      {item.danger ? (
        <LinearGradient colors={['#7A1020', '#981B2E', '#B4233A']} style={[styles.row, styles.logoutGradient, appTheme.shadow.card]}>
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.row,
            {
              borderColor: appTheme.colors.border,
              backgroundColor: appTheme.colors.surfaceStrong,
              ...appTheme.shadow.card,
            },
          ]}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: theme.spacing.sm,
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  heroText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  list: {
    gap: theme.spacing.md,
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
    padding: theme.spacing.md,
    ...theme.shadow.card,
  },
  rowPressed: {
    opacity: 0.76,
  },
  rowDanger: {
    borderColor: theme.colors.dangerSoft,
  },
  logoutGradient: {
    borderColor: 'rgba(255,255,255,0.18)',
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  iconDanger: {
    backgroundColor: theme.colors.dangerSoft,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  dangerText: {
    color: theme.colors.danger,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
});
