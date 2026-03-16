import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import type { ThemeColors } from "../theme/colors";

type EmptyStateProps = {
  title: string;
  message: string;
  action?: {
    label: string;
    onPress: () => void;
  };
};

export default function EmptyState({
  title,
  message,
  action,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = useStyles(colors);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {action ? (
        <TouchableOpacity style={styles.button} onPress={action.onPress}>
          <Text style={styles.buttonText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const useStyles = (colors: ThemeColors) =>
  useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 32,
          gap: 12,
        },
        title: {
          fontSize: 18,
          fontWeight: "600",
          color: colors.foreground,
          textAlign: "center",
        },
        message: {
          fontSize: 14,
          color: colors.mutedForeground,
          textAlign: "center",
          lineHeight: 20,
        },
        button: {
          marginTop: 12,
          paddingHorizontal: 24,
          paddingVertical: 12,
          backgroundColor: colors.primary,
          borderRadius: 12,
        },
        buttonText: {
          color: colors.primaryForeground,
          fontWeight: "600",
          fontSize: 16,
        },
      }),
    [colors]
  );
