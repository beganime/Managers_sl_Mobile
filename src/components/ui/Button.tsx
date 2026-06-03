import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type ButtonProps = PressableProps & {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
};

export function Button({
  title,
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const appTheme = useAppTheme();
  const variantStyle = getVariantStyle(variant, appTheme);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyle.container,
        fullWidth && styles.fullWidth,
        (pressed || isDisabled) && styles.pressed,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.text.color} />
      ) : (
        <Text style={[styles.text, variantStyle.text]}>{title}</Text>
      )}
    </Pressable>
  );
}

function getVariantStyle(variant: ButtonVariant, appTheme: typeof theme) {
  const primary = {
    container: { backgroundColor: appTheme.colors.primary },
    text: { color: appTheme.colors.white },
  };

  const variants = {
    primary,
    secondary: {
      container: {
        backgroundColor: appTheme.colors.surfaceStrong,
        borderColor: appTheme.colors.border,
        borderWidth: 1,
      },
      text: { color: appTheme.colors.primary },
    },
    danger: {
      container: { backgroundColor: appTheme.colors.accent },
      text: { color: appTheme.colors.white },
    },
    ghost: {
      container: { backgroundColor: 'transparent' },
      text: { color: appTheme.dark ? appTheme.colors.screenText : appTheme.colors.accent },
    },
  };

  return variants[variant] || primary;
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  fullWidth: {
    width: '100%',
  },
  pressed: {
    opacity: 0.72,
  },
  text: {
    fontSize: 15,
    fontWeight: '900',
  },
});
