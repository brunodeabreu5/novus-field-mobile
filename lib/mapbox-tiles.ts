import Constants from "expo-constants";

const FALLBACK_RASTER_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/**
 * Token Mapbox: prioriza `extra.mapboxToken` do app.config (Expo) e depois EXPO_PUBLIC_MAPBOX_TOKEN.
 */
export function resolveMapboxToken(): string {
  const extra = Constants.expoConfig?.extra as { mapboxToken?: string } | undefined;
  const fromExtra = extra?.mapboxToken?.trim();
  if (fromExtra) {
    return fromExtra;
  }
  return process.env.EXPO_PUBLIC_MAPBOX_TOKEN?.trim() || "";
}

export function hasMapboxToken(): boolean {
  return resolveMapboxToken().length > 0;
}

/**
 * Template raster Mapbox (Styles API) para o source raster do MapLibre.
 */
export function getMapboxRasterTileUrlTemplate(): string {
  const token = resolveMapboxToken();
  if (!token) {
    return FALLBACK_RASTER_TILE_URL;
  }
  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${token}`;
}

export function getMapboxMapStyle() {
  return {
    version: 8,
    sources: {
      "novus-raster": {
        type: "raster",
        tiles: [getMapboxRasterTileUrlTemplate()],
        tileSize: 256,
      },
    },
    layers: [
      {
        id: "novus-raster-layer",
        type: "raster",
        source: "novus-raster",
      },
    ],
  };
}

export function getMapTokenWarning(): string | null {
  if (hasMapboxToken()) {
    return null;
  }

  return "EXPO_PUBLIC_MAPBOX_TOKEN is missing. Using OpenStreetMap fallback tiles.";
}
