import React, { useMemo } from "react";
import { Modal, View, Text, StyleSheet, type ViewStyle } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

interface BottomSheetModalProps {
  visible: boolean;
  title: string;
  onRequestClose: () => void;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
}

export default function BottomSheetModal({
  visible,
  title,
  onRequestClose,
  children,
  contentStyle,
}: BottomSheetModalProps) {
  const { colors } = useTheme();
  const styles = useStyles(colors);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onRequestClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.content, contentStyle]}>
          <Text style={styles.title}>{title}</Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const useStyles = (colors) =>
  useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        },
        content: {
          backgroundColor: colors.card,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 24,
          paddingBottom: 40,
        },
        title: {
          fontSize: 20,
          fontWeight: "700",
          marginBottom: 20,
          color: colors.foreground,
        },
      }),
    [colors]
  );
