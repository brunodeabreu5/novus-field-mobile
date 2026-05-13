import React, { useEffect, useState } from "react";
import { NativeModules, View, Text, StyleSheet } from "react-native";
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
    if (!NativeModules.MLRNModule) {
      loadError = new Error("MapLibre native module unavailable");
      return;
    }

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
    if (!MapLibreModule) {
      loadMapLibre();
      if (MapLibreModule) {
        setIsReady(true);
      }
      if (loadError) {
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
