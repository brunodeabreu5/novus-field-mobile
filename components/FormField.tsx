import React, { useMemo } from "react";
import { Text, TextInput, StyleSheet, type TextInputProps } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

interface FormFieldProps extends TextInputProps {
  label: string;
  multiline?: boolean;
}

export default function FormField({
  label,
  multiline = false,
  style,
  ...props
}: FormFieldProps) {
  const { colors } = useTheme();
  const styles = useStyles(colors);

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textArea, style]}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        {...props}
      />
    </>
  );
}

const useStyles = (colors) =>
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
        textArea: {
          height: 80,
          paddingTop: 12,
          textAlignVertical: "top",
        },
      }),
    [colors]
  );
