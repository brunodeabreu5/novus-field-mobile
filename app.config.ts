import type { ExpoConfig } from "expo/config";

/**
 * Injeta o token Mapbox em `extra` para leitura via expo-constants (além do EXPO_PUBLIC_* no bundle).
 */
export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN?.trim() ?? "";
  return {
    ...config,
    extra: {
      ...(typeof config.extra === "object" && config.extra !== null ? config.extra : {}),
      mapboxToken,
    },
  };
};
