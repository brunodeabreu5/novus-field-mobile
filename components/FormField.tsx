import React, { useMemo } from "react";
import { Text, TextInput, StyleSheet, type TextInputProps } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import type { ThemeColors } from "../theme/colors";

interface FormFieldProps extends TextInputProps {
  label: string;
  multiline?: boolean;
  error?: string | null;
  helpText?: string | null;
}

export default function FormField({
  label,
  multiline = false,
  error,
  helpText,
  style,
  ...props
}: FormFieldProps) {
  const { colors } = useTheme();
  const styles = useStyles(colors);

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null, multiline && styles.textArea, style]}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : helpText ? <Text style={styles.helpText}>{helpText}</Text> : null}
    </>
  );
}

const useStyles = (colors: ThemeColors) =>
  useMemo(
    () =>
      StyleSheet.create({
        label: {
          fontSize: 14,
          fontWeight: "500",
          marginBottom: 8,
          color: colors.foreground,
        },
        input: {
          height: 48,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: 16,
          marginBottom: 16,
          fontSize: 16,
          color: colors.foreground,
          backgroundColor: colors.card,
        },
        inputError: {
          borderColor: colors.destructive,
        },
        helpText: {
          marginTop: -10,
          marginBottom: 16,
          fontSize: 12,
          color: colors.mutedForeground,
        },
        errorText: {
          marginTop: -10,
          marginBottom: 16,
          fontSize: 12,
          color: colors.destructive,
        },
        textArea: {
          height: 80,
          paddingTop: 12,
          textAlignVertical: "top",
        },
      }),
    [colors]
  );
