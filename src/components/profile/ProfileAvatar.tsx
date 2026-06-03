import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { theme } from '../../theme/theme';
import { AppUser } from '../../types';
import { getUserDisplayName } from '../../utils/format';

type ProfileAvatarProps = {
  user?: AppUser | null;
  size?: number;
  style?: ViewStyle;
};

export function ProfileAvatar({ user, size = 76, style }: ProfileAvatarProps) {
  const avatarUrl = user?.avatar_url || user?.avatar || null;
  const initials = getUserDisplayName(user)
    .split(' ')
    .map((part) => part.slice(0, 1))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.max(20, size * 0.34) }]}>
          {initials || 'MS'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.68)',
    backgroundColor: 'rgba(255,255,255,0.18)',
    ...theme.shadow.card,
  },
  initials: {
    color: theme.colors.white,
    fontWeight: '900',
  },
});
