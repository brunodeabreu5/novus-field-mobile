import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme/colors";

// Lazy load the map library
let MapLibreModule: typeof import("@maplibre/maplibre-react-native") | null =
  null;
let loadError: Error | null = null;

function loadMapLibre() {
  if (MapLibreModule !== null || loadError) {
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    MapLibreModule = require("@maplibre/maplibre-react-native");
  } catch (e) {
    console.warn(
      "[MapViewWrapper] @maplibre/maplibre-react-native not available:",
      e,
    );
    loadError = e as Error;
  }
}

// Pre-load on module evaluation (will be caught by our state)
loadMapLibre();

interface MapViewWrapperProps {
  children: (
    mapLibre: typeof import("@maplibre/maplibre-react-native"),
  ) => React.ReactNode;
  fallback?: React.ReactNode;
}

export default function MapViewWrapper({
  children,
  fallback,
}: MapViewWrapperProps) {
  const [isReady, setIsReady] = useState(MapLibreModule !== null);
  const [error, setError] = useState<Error | null>(loadError);

  useEffect(() => {
    // Try loading again in case it wasn't available initially
    if (!MapLibreModule && !loadError) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        MapLibreModule = require("@maplibre/maplibre-react-native");
        setIsReady(true);
      } catch (e) {
        loadError = e as Error;
        setError(loadError);
      }
    }
  }, []);

  if (error || !MapLibreModule) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>Mapa no disponible</Text>
        <Text style={styles.fallbackText}>
          El mapa no esta disponible en este dispositivo. Por favor, reinicia la
          app o reconstruye el proyecto nativo.
        </Text>
      </View>
    );
  }

  return <>{children(MapLibreModule)}</>;
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 20,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: 8,
  },
  fallbackText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: "center",
  },
});
