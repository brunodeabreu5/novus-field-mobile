import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface MapPinProps {
  readonly color: string;
  readonly label?: string;
  readonly size?: "sm" | "md";
}

export default function MapPin({ color, label, size = "md" }: MapPinProps) {
  const compact = size === "sm";

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.pin,
          compact ? styles.pinSmall : styles.pinMedium,
          { backgroundColor: color },
        ]}
      >
        {label ? (
          <Text style={[styles.label, compact ? styles.labelSmall : styles.labelMedium]}>
            {label}
          </Text>
        ) : null}
      </View>
      <View style={[styles.tip, { borderTopColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  pin: {
    alignItems: "center",
    borderColor: "#ffffff",
    borderRadius: 999,
    borderWidth: 3,
    justifyContent: "center",
  },
  pinSmall: {
    height: 22,
    width: 22,
  },
  pinMedium: {
    height: 30,
    width: 30,
  },
  label: {
    color: "#ffffff",
    fontWeight: "700",
  },
  labelSmall: {
    fontSize: 10,
  },
  labelMedium: {
    fontSize: 12,
  },
  tip: {
    borderLeftColor: "transparent",
    borderLeftWidth: 6,
    borderRightColor: "transparent",
    borderRightWidth: 6,
    borderTopWidth: 9,
    marginTop: -2,
  },
});
