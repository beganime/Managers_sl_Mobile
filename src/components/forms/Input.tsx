import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';

type InputProps = TextInputProps & {
  label: string;
  error?: string | null;
};

export function Input({ label, error, style, ...props }: InputProps) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: appTheme.colors.textMuted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={appTheme.colors.textSoft}
        style={[
          styles.input,
          {
            borderColor: appTheme.colors.border,
            backgroundColor: appTheme.colors.surfaceStrong,
            color: appTheme.colors.text,
          },
          Boolean(error) && { borderColor: appTheme.colors.danger },
          style,
        ]}
        {...props}
      />
      {Boolean(error) && <Text style={[styles.error, { color: appTheme.colors.danger }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 7,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    minHeight: 50,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    fontSize: 12,
    fontWeight: '800',
  },
});
