import { LinearGradient } from 'expo-linear-gradient';
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
      <Header title="Профиль" subtitle="Students Life Program for Managers" showBack />

      <LinearGradient
        colors={theme.gradients.hero as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getUserDisplayName(user).slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{getUserDisplayName(user)}</Text>
          <Text style={styles.meta}>{user?.email || 'Email не указан'}</Text>
          <Text style={styles.meta}>{user?.role || 'Роль не указана'}</Text>
        </View>
      </LinearGradient>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>ManagerSL ERP/CRM workspace</Text>
        <Text style={styles.cardText}>Профиль синхронизируется через текущий backend endpoint пользователя.</Text>
      </Card>

      <Button title="Выйти" variant="danger" onPress={handleLogout} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    ...theme.shadow.floating,
  },
  card: {
    gap: theme.spacing.sm,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  cardText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarText: {
    color: theme.colors.white,
    fontSize: 28,
    fontWeight: '900',
  },
  info: {
    flex: 1,
    gap: 5,
  },
  name: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: '900',
  },
  meta: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    fontWeight: '700',
  },
});
