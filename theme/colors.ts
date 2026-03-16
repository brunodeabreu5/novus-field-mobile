export const lightColors = {
  primary: "#1e3a5f",
  primaryForeground: "#ffffff",
  primaryMuted: "rgba(30, 58, 95, 0.15)",
  secondary: "#e4eaf2",
  secondaryForeground: "#0f172a",
  background: "#f5f6f8",
  foreground: "#0f172a",
  muted: "#f1f5f9",
  mutedForeground: "#64748b",
  border: "#e2e8f0",
  card: "#ffffff",
  cardForeground: "#0f172a",
  success: "#22c55e",
  successMuted: "rgba(34, 197, 94, 0.15)",
  warning: "#f59e0b",
  warningMuted: "rgba(245, 158, 11, 0.15)",
  destructive: "#ef4444",
  info: "#3b82f6",
  infoMuted: "rgba(59, 130, 246, 0.15)",
  accent: "#22c55e",
  accentForeground: "#ffffff",
};

export type ThemeColors = typeof lightColors;

export const darkColors = {
  primary: "#3b82f6", // A brighter blue for dark mode
  primaryForeground: "#ffffff",
  primaryMuted: "rgba(59, 130, 246, 0.15)",
  secondary: "#1e293b",
  secondaryForeground: "#ffffff",
  background: "#0f172a",
  foreground: "#f8fafc",
  muted: "#1e293b",
  mutedForeground: "#94a3b8",
  border: "#334155",
  card: "#1e293b",
  cardForeground: "#f8fafc",
  success: "#4ade80",
  successMuted: "rgba(74, 222, 128, 0.15)",
  warning: "#facc15",
  warningMuted: "rgba(250, 204, 21, 0.15)",
  destructive: "#f87171",
  info: "#60a5fa",
  infoMuted: "rgba(96, 165, 250, 0.15)",
  accent: "#4ade80",
  accentForeground: "#0f172a",
};

export const palettes = {
  light: lightColors,
  dark: darkColors,
};

// Default export for legacy components
export const colors = lightColors;
