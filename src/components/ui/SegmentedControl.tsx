import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';

export type SegmentOption = {
  label: string;
  value: string;
};

type SegmentedControlProps = {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
};

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  const appTheme = useAppTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: appTheme.colors.border,
          backgroundColor: appTheme.dark ? 'rgba(255,255,255,0.16)' : appTheme.colors.surfaceSoft,
        },
      ]}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.item,
              active && { backgroundColor: appTheme.colors.primary },
              pressed && styles.itemPressed,
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: appTheme.dark && !active ? appTheme.colors.screenTextMuted : appTheme.colors.textMuted },
                active && styles.labelActive,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.sm,
  },
  item: {
    flexGrow: 1,
    minHeight: 38,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
  },
  itemPressed: {
    opacity: 0.72,
  },
  label: {
    fontSize: 13,
    fontWeight: '900',
  },
  labelActive: {
    color: theme.colors.white,
  },
});
