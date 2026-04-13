import fs from "node:fs";
import path from "node:path";
import type { ExpoConfig } from "expo/config";

/**
 * Injeta o token Mapbox em `extra` para leitura via expo-constants (além do EXPO_PUBLIC_* no bundle).
 */
function loadEnvFile(fileName: string) {
  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const value = line.slice(separatorIndex + 1).trim();
    process.env[key] = value.replace(/^(["'])(.*)\1$/, "$2");
  }
}

function resolveAppEnv() {
  return (
    process.env.APP_ENV?.trim() ||
    process.env.EXPO_PUBLIC_APP_ENV?.trim() ||
    process.env.NODE_ENV?.trim() ||
    "development"
  );
}

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  const appEnv = resolveAppEnv();
  process.env.NODE_ENV = process.env.NODE_ENV?.trim() || appEnv;
  loadEnvFile(`.env.${appEnv}`);
  loadEnvFile(".env");

  const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN?.trim() ?? "";
  return {
    ...config,
    extra: {
      ...(typeof config.extra === "object" && config.extra !== null ? config.extra : {}),
      appEnv,
      mapboxToken,
    },
  };
};
