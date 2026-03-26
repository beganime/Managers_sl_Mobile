import React from 'react';
import { Text, View } from 'react-native';
import PremiumCard from './PremiumCard';
import { useTheme } from '../src/context/ThemeContext';

export default function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  const { theme } = useTheme();
  return (
    <PremiumCard>
      <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: theme.blueSoft, marginBottom: 12 }} />
        <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text }}>{title}</Text>
        {subtitle ? (
          <Text style={{ marginTop: 6, textAlign: 'center', color: theme.textSecondary, lineHeight: 20 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </PremiumCard>
  );
}
