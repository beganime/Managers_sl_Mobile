import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

type IconName = 'home' | 'crm' | 'rank' | 'catalog' | 'profile';

type Props = {
  name: IconName;
  color: string;
  focused?: boolean;
  size?: number;
};

export default function AppTabIcon({
  name,
  color,
  focused = false,
  size = 22,
}: Props) {
  const iconSize = focused ? size + 1 : size;

  const renderIcon = () => {
    switch (name) {
      case 'home':
        return (
          <Ionicons
            name={focused ? 'home' : 'home-outline'}
            size={iconSize}
            color={color}
          />
        );

      case 'crm':
        return (
          <MaterialCommunityIcons
            name={focused ? 'account-group' : 'account-group-outline'}
            size={iconSize}
            color={color}
          />
        );

      case 'rank':
        return (
          <Ionicons
            name={focused ? 'trophy' : 'trophy-outline'}
            size={iconSize}
            color={color}
          />
        );

      case 'catalog':
        return (
          <Ionicons
            name={focused ? 'school' : 'school-outline'}
            size={iconSize}
            color={color}
          />
        );

      case 'profile':
      default:
        return (
          <Feather
            name="user"
            size={iconSize}
            color={color}
          />
        );
    }
  };

  return <View style={styles.wrap}>{renderIcon()}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
    minHeight: 28,
  },
});