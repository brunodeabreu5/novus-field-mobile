import React from "react";
import { Text, type TextProps } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { fonts } from "../theme/fonts";

interface ThemedTextProps extends TextProps {
  variant?: "body" | "heading" | "label" | "caption";
}

export default function ThemedText({
  variant = "body",
  style,
  ...props
}: ThemedTextProps) {
  const { colors } = useTheme();

  const variantStyle = {
    body: { fontFamily: fonts.sans, fontSize: 14, color: colors.foreground },
    heading: { fontFamily: fonts.display, fontSize: 18, color: colors.foreground },
    label: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.mutedForeground },
    caption: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  };

  return <Text style={[variantStyle[variant], style]} {...props} />;
}
