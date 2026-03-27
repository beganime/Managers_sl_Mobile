import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import ScreenWrapper from '../../components/ScreenWrapper';
import AdminDashboard from '../../components/dashboard/AdminDashboard';
import ManagerDashboard from '../../components/dashboard/ManagerDashboard';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useTheme } from '../../src/context/ThemeContext';

export default function DashboardScreen() {
  const { user, loading, reload } = useCurrentUser();
  const { theme } = useTheme();

  const isAdmin = Boolean(user?.is_superuser || user?.is_staff || user?.role === 'admin');

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.blue} />
        </View>
      </ScreenWrapper>
    );
  }

  if (!user) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <Text style={[styles.empty, { color: theme.text }]}>Не удалось загрузить профиль.</Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            Проверь токен или доступ к серверу.
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  return isAdmin ? (
    <AdminDashboard user={user} onRefresh={reload} />
  ) : (
    <ManagerDashboard user={user} onRefresh={reload} />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  empty: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  sub: { marginTop: 8, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});