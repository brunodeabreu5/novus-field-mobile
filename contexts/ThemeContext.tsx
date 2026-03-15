import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { palettes, lightColors } from "../theme/colors";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  colors: typeof lightColors;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  colors: lightColors,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  // For now, we'll just use the system's color scheme.
  // We could add a state here to allow manual override.
  const theme = colorScheme || "light";
  const colors = palettes[theme];

  const value = useMemo(
    () => ({
      theme,
      colors,
    }),
    [theme, colors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
