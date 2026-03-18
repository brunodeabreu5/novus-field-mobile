import React, { useMemo } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import type { ThemeColors } from "../theme/colors";

interface BottomSheetModalProps {
  readonly visible: boolean;
  readonly title: string;
  readonly onRequestClose: () => void;
  readonly children: React.ReactNode;
  readonly contentStyle?: ViewStyle;
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardContainer}
        >
          <View style={[styles.content, contentStyle]}>
            <Text style={styles.title}>{title}</Text>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const useStyles = (colors: ThemeColors) =>
  useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        },
        keyboardContainer: {
          width: "100%",
        },
        content: {
          backgroundColor: colors.card,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 24,
          paddingBottom: 40,
        },
        scrollView: {
          flexGrow: 0,
        },
        scrollContent: {
          paddingBottom: 8,
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
