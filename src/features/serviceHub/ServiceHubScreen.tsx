import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/cards/Card';
import { Header } from '../../components/layout/Header';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { SERVICE_URLS } from '../../config/app';
import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';

type HubItem = {
  key: string;
  title: string;
  subtitle: string;
  hint: string;
  image: ImageSourcePropType;
  icon: keyof typeof Ionicons.glyphMap;
  nativeRoute?: string;
  url?: string;
};

const HUB_ITEMS: HubItem[] = [
  {
    key: 'tasks',
    title: 'Task Manager SL',
    subtitle: 'Личные и общие задачи команды',
    hint: 'Откроется защищённая веб-версия',
    image: require('../../../assets/images/service-3d/tasks.png'),
    icon: 'checkbox-outline',
    url: SERVICE_URLS.tasks,
  },
  {
    key: 'translate',
    title: 'TranslateSL',
    subtitle: 'Перевод и подготовка документов',
    hint: 'Шаблоны, распознавание и перевод',
    image: require('../../../assets/images/service-3d/translate.png'),
    icon: 'language-outline',
    url: SERVICE_URLS.translate,
  },
  {
    key: 'disk',
    title: 'DiskSL',
    subtitle: 'Файлы клиентов и договоры',
    hint: 'Центральное защищённое хранилище',
    image: require('../../../assets/images/service-3d/disk.png'),
    icon: 'cloud-outline',
    url: SERVICE_URLS.disk,
  },
  {
    key: 'exams',
    title: 'Экзамены',
    subtitle: 'Назначение экзаменов клиентам',
    hint: 'Мобильный интерфейс и push клиенту',
    image: require('../../../assets/images/service-3d/exams.png'),
    icon: 'school-outline',
    nativeRoute: '/(app)/exams',
  },
];

export function ServiceHubScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();

  const openItem = (item: HubItem) => {
    if (item.nativeRoute) {
      router.push(item.nativeRoute as any);
      return;
    }
    if (item.url) {
      void WebBrowser.openBrowserAsync(item.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
        toolbarColor: appTheme.colors.navy900,
        controlsColor: appTheme.colors.white,
      });
    }
  };

  return (
    <ScreenContainer>
      <Header
        title="Сервисы"
        eyebrow="Students Life ecosystem"
        subtitle="Все рабочие инструменты собраны в одном понятном разделе."
        showBack
        parentFallback="/(app)/(tabs)/more"
      />

      <LinearGradient
        colors={appTheme.gradients.hero as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, appTheme.shadow.floating]}
      >
        <View style={styles.heroCopy}>
          <Text style={styles.heroKicker}>РАБОЧИЙ ЦЕНТР</Text>
          <Text style={styles.heroTitle}>Выберите, что нужно сделать</Text>
          <Text style={styles.heroText}>Не нужно запоминать адреса сайтов — приложение откроет правильный сервис само.</Text>
        </View>
        <Image source={require('../../../assets/images/service-3d/tasks.png')} style={styles.heroImage} resizeMode="contain" />
      </LinearGradient>

      <View style={styles.guideRow}>
        <GuideStep number="1" text="Выберите сервис" />
        <GuideStep number="2" text="Войдите своим аккаунтом" />
        <GuideStep number="3" text="Продолжайте работу" />
      </View>

      <View style={styles.grid}>
        {HUB_ITEMS.map((item) => (
          <Pressable key={item.key} onPress={() => openItem(item)} style={({ pressed }) => [styles.cardPress, pressed && styles.pressed]}>
            <Card style={styles.serviceCard}>
              <View style={[styles.imageShell, { backgroundColor: appTheme.dark ? 'rgba(255,255,255,0.06)' : '#F1F4F8' }]}>
                <Image source={item.image} style={styles.serviceImage} resizeMode="contain" />
                <View style={[styles.iconBadge, { backgroundColor: appTheme.colors.accent }]}>
                  <Ionicons name={item.icon} size={17} color="#FFFFFF" />
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, { color: appTheme.colors.text }]}>{item.title}</Text>
                <Text style={[styles.cardSubtitle, { color: appTheme.colors.textMuted }]}>{item.subtitle}</Text>
                <Text style={[styles.cardHint, { color: appTheme.colors.textSoft }]}>{item.hint}</Text>
              </View>
              <View style={[styles.openRow, { borderTopColor: appTheme.colors.border }]}>
                <Text style={[styles.openText, { color: appTheme.colors.accent }]}>{item.nativeRoute ? 'Открыть в приложении' : 'Открыть сервис'}</Text>
                <Ionicons name={item.nativeRoute ? 'arrow-forward' : 'open-outline'} size={18} color={appTheme.colors.accent} />
              </View>
            </Card>
          </Pressable>
        ))}
      </View>

      <Card glass style={styles.helpCard}>
        <View style={[styles.helpIcon, { backgroundColor: appTheme.colors.successSoft }]}>
          <Ionicons name="shield-checkmark-outline" size={23} color={appTheme.colors.success} />
        </View>
        <View style={styles.helpText}>
          <Text style={[styles.helpTitle, { color: appTheme.colors.text }]}>Безопасный переход</Text>
          <Text style={[styles.helpSubtitle, { color: appTheme.colors.textMuted }]}>В карточках используются только официальные домены Students Life.</Text>
        </View>
      </Card>
    </ScreenContainer>
  );
}

function GuideStep({ number, text }: { number: string; text: string }) {
  const appTheme = useAppTheme();
  return (
    <View style={styles.guideStep}>
      <View style={[styles.guideNumber, { backgroundColor: appTheme.colors.primary }]}>
        <Text style={styles.guideNumberText}>{number}</Text>
      </View>
      <Text style={[styles.guideText, { color: appTheme.colors.screenTextMuted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 184, borderRadius: theme.radius.xl, padding: 20, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' },
  heroCopy: { flex: 1, gap: 8, zIndex: 2 },
  heroKicker: { color: 'rgba(255,255,255,0.72)', fontSize: 10.5, letterSpacing: 1.2, fontWeight: '900' },
  heroTitle: { color: '#FFFFFF', fontSize: 24, lineHeight: 29, fontWeight: '900' },
  heroText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  heroImage: { width: 128, height: 128, marginRight: -22, marginBottom: -18 },
  guideRow: { flexDirection: 'row', gap: 8 },
  guideStep: { flex: 1, minWidth: 0, alignItems: 'center', gap: 7 },
  guideNumber: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  guideNumberText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  guideText: { fontSize: 10.5, lineHeight: 14, textAlign: 'center', fontWeight: '800' },
  grid: { gap: theme.spacing.lg },
  cardPress: { borderRadius: theme.radius.lg },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  serviceCard: { padding: 0, overflow: 'hidden', gap: 0 },
  imageShell: { height: 172, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  serviceImage: { width: '82%', height: '94%' },
  iconBadge: { position: 'absolute', right: 14, bottom: 12, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  cardBody: { gap: 5, paddingHorizontal: 16, paddingTop: 15, paddingBottom: 14 },
  cardTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900' },
  cardSubtitle: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  cardHint: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  openRow: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  openText: { fontSize: 13, fontWeight: '900' },
  helpCard: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  helpIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  helpText: { flex: 1, gap: 3 },
  helpTitle: { fontSize: 14, fontWeight: '900' },
  helpSubtitle: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
});
