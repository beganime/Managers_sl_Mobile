import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { theme } from '../../theme/theme';
import { useAppTheme } from '../../theme/useAppTheme';

type InputProps = TextInputProps & {
  label: string;
  error?: string | null;
  rightElement?: React.ReactNode;
};

export function Input({ label, error, style, rightElement, multiline, ...props }: InputProps) {
  const appTheme = useAppTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: appTheme.colors.textMuted }]}>{label}</Text>
      <View
        style={[
          styles.inputShell,
          {
            borderColor: appTheme.colors.border,
            backgroundColor: appTheme.colors.surfaceStrong,
          },
          Boolean(error) && { borderColor: appTheme.colors.danger },
        ]}
      >
        <TextInput
          placeholderTextColor={appTheme.colors.textSoft}
          selectionColor={appTheme.colors.primary}
          cursorColor={appTheme.colors.primary}
          keyboardAppearance={appTheme.dark ? 'dark' : 'light'}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[
            styles.input,
            multiline && styles.multiline,
            rightElement ? styles.withRightElement : null,
            { color: appTheme.colors.text },
            style,
          ]}
          {...props}
        />
        {rightElement ? <View style={styles.rightElement}>{rightElement}</View> : null}
      </View>
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
  inputShell: {
    minHeight: 50,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  input: {
    minHeight: 50,
    paddingHorizontal: theme.spacing.lg,
    fontSize: 16,
    fontWeight: '700',
  },
  multiline: {
    minHeight: 108,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  withRightElement: {
    paddingRight: 54,
  },
  rightElement: {
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: theme.spacing.sm,
    top: 0,
  },
  error: {
    fontSize: 12,
    fontWeight: '800',
  },
});
