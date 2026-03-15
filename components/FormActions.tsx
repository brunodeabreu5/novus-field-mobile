import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";

interface FormActionsProps {
  isLoading?: boolean;
  cancelLabel?: string;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: () => void;
}

export default function FormActions({
  isLoading = false,
  cancelLabel = "Cancelar",
  submitLabel,
  onCancel,
  onSubmit,
}: FormActionsProps) {
  const { colors } = useTheme();
  const styles = useStyles(colors);

  return (
    <View style={styles.actions}>
      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
        <Text style={styles.cancelBtnText}>{cancelLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.saveBtn, isLoading && styles.saveBtnDisabled]}
        onPress={onSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <Text style={styles.saveBtnText}>{submitLabel}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const useStyles = (colors) =>
  useMemo(
    () =>
      StyleSheet.create({
        actions: { flexDirection: "row", gap: 12, marginTop: 8 },
        cancelBtn: { flex: 1, padding: 14, alignItems: "center" },
        cancelBtnText: { color: colors.mutedForeground },
        saveBtn: {
          flex: 1,
          padding: 14,
          backgroundColor: colors.primary,
          borderRadius: 12,
          alignItems: "center",
        },
        saveBtnDisabled: { opacity: 0.7 },
        saveBtnText: { color: colors.primaryForeground, fontWeight: "600" },
      }),
    [colors]
  );
