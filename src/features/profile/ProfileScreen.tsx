import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/ui/Button';
import { Card } from '../../components/cards/Card';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { theme } from '../../theme/theme';
import { useAuth } from '../../store/auth';
import { getUserDisplayName } from '../../utils/format';

export function ProfileScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/login' as any);
  };

  return (
    <ScreenContainer>
      <Header title="Профиль" subtitle="Данные текущего пользователя." />

      <Card style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getUserDisplayName(user).slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{getUserDisplayName(user)}</Text>
          <Text style={styles.meta}>{user?.email || 'Email не указан'}</Text>
          <Text style={styles.meta}>{user?.role || 'Роль не указана'}</Text>
        </View>
      </Card>

      <Button title="Выйти" variant="danger" onPress={handleLogout} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  avatarText: {
    color: theme.colors.primary,
    fontSize: 28,
    fontWeight: '900',
  },
  info: {
    flex: 1,
    gap: 5,
  },
  name: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  meta: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
