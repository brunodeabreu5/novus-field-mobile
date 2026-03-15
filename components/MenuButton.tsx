import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMenu } from "../contexts/MenuContext";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

export default function MenuButton() {
  const { openMenu } = useMenu();

  return (
    <Pressable
      onPress={openMenu}
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      hitSlop={8}
      accessibilityLabel="Abrir menu"
      accessibilityRole="button"
    >
      <Ionicons name="menu-outline" size={24} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: spacing.sm,
    marginLeft: spacing.xs,
    borderRadius: 999,
  },
  btnPressed: {
    backgroundColor: colors.primaryMuted,
  },
});
