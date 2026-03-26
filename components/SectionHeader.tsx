import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../src/context/ThemeContext';

export default function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onPress,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text }}>{title}</Text>
        {subtitle ? <Text style={{ marginTop: 4, color: theme.textSecondary, fontSize: 13 }}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onPress ? (
        <TouchableOpacity onPress={onPress}>
          <Text style={{ color: theme.blue, fontWeight: '800' }}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
