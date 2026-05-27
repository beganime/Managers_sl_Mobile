import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { listApplications, listClients, listLeads } from '../../api/crm';
import { extractCount } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/cards/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Header } from '../../components/layout/Header';
import { LoadingState } from '../../components/ui/LoadingState';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { StatCard } from '../../components/cards/StatCard';
import { theme } from '../../theme/theme';
import { useAsyncResource } from '../../hooks/useAsyncResource';

type CrmData = {
  counts: {
    leads: number;
    clients: number;
    incoming: number;
    applications: number;
  };
};

const sections = [
  {
    title: 'Лиды',
    subtitle: 'Поиск, статусы, карточка лида и конвертация',
    icon: 'radio-outline',
    route: '/(app)/crm/leads',
  },
  {
    title: 'Клиенты',
    subtitle: 'База клиентов, карточка, создание и редактирование',
    icon: 'people-outline',
    route: '/(app)/crm/clients',
  },
  {
    title: 'Входящие',
    subtitle: 'Потенциальные клиенты и ответственность',
    icon: 'file-tray-full-outline',
    route: '/(app)/crm/incoming',
  },
  {
    title: 'Заявки',
    subtitle: 'Заявки на поступление и их статусы',
    icon: 'document-text-outline',
    route: '/(app)/crm/applications',
  },
] as const;

export function CrmScreen() {
  const router = useRouter();

  const loadCrm = useCallback(async (): Promise<CrmData> => {
    const [leads, clients, incoming, applications] = await Promise.all([
      listLeads({ limit: 1 }),
      listClients({ limit: 1 }),
      listLeads({ status: 'new', limit: 1 }),
      listApplications({ limit: 1 }),
    ]);

    return {
      counts: {
        leads: extractCount(leads),
        clients: extractCount(clients),
        incoming: extractCount(incoming),
        applications: extractCount(applications),
      },
    };
  }, []);

  const { data, loading, error, reload } = useAsyncResource(loadCrm);

  return (
    <ScreenContainer>
      <Header
        title="CRM"
        eyebrow="Students Life Program for Managers"
        subtitle="Лиды, клиенты, входящие заявки и поступления в одном мобильном рабочем пространстве."
      />

      {loading && !data ? <LoadingState /> : null}
      {error && !data ? <ErrorState message={error} actionTitle="Повторить" onAction={reload} /> : null}

      {data ? (
        <View style={styles.stats}>
          <StatCard label="Лиды" value={data.counts.leads} tone="accent" />
          <StatCard label="Клиенты" value={data.counts.clients} tone="primary" />
          <StatCard label="Входящие" value={data.counts.incoming} tone="warning" />
          <StatCard label="Заявки" value={data.counts.applications} tone="success" />
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button title="Добавить клиента" onPress={() => router.push('/(app)/crm/clients/create' as any)} />
        <Button
          title="Добавить лид"
          variant="secondary"
          onPress={() => router.push('/(app)/crm/leads/create' as any)}
        />
      </View>

      <SectionTitle title="Разделы CRM" subtitle="Sprint 2 подключает реальные /api/v1/crm endpoints." />

      <View style={styles.sections}>
        {sections.map((section) => (
          <Pressable
            key={section.title}
            onPress={() => router.push(section.route as any)}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Card style={styles.sectionCard}>
              <View style={styles.sectionIcon}>
                <Ionicons name={section.icon} size={22} color={theme.colors.accent} />
              </View>
              <View style={styles.sectionBody}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </Card>
          </Pressable>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  actions: {
    gap: theme.spacing.md,
  },
  sections: {
    gap: theme.spacing.md,
  },
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  sectionIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentSoft,
  },
  sectionBody: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.78,
  },
});
