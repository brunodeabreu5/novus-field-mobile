import React from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import type { ViewProps } from "react-native";

interface ScreenContainerProps extends ViewProps {
  children: React.ReactNode;
  edges?: Array<"top" | "bottom" | "left" | "right">;
}

export default function ScreenContainer({
  children,
  style,
  edges = ["top", "left", "right"],
  ...props
}: ScreenContainerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      edges={edges}
      style={[
        {
          flex: 1,
          backgroundColor: colors.background,
          paddingBottom: edges.includes("bottom") ? 0 : insets.bottom,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </SafeAreaView>
  );
}
