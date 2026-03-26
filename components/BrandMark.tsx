import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../src/context/ThemeContext';

export default function BrandMark({ compact = false }: { compact?: boolean }) {
  const { theme } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Svg width={compact ? 36 : 44} height={compact ? 36 : 44} viewBox="0 0 44 44" fill="none">
        <Circle cx="22" cy="22" r="22" fill={theme.white} opacity="0.86" />
        <Path d="M13 28V14h4.2l4.8 7.2 4.8-7.2H31v14h-4v-7.2l-3.8 5.6h-2.3L17 20.8V28h-4Z" fill={theme.blue} />
        <Path d="M34 12a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" fill={theme.red} />
      </Svg>
      <View>
        <Text style={{ fontSize: compact ? 16 : 22, fontWeight: '900', color: theme.text }}>ManagerSL</Text>
        <Text style={{ fontSize: compact ? 12 : 14, fontWeight: '600', color: theme.textSecondary }}>Students Life</Text>
      </View>
    </View>
  );
}
