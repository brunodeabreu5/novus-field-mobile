export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

const GEOCODING_TIMEOUT_MS = 12_000;

export async function geocodeAddress(query: string): Promise<GeocodingResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEOCODING_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding failed with HTTP ${response.status}`);
    }

    const data = (await response.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
    }>;

    if (!data.length || !data[0]?.lat || !data[0]?.lon) {
      throw new Error("Address not found");
    }

    const latitude = Number.parseFloat(data[0].lat);
    const longitude = Number.parseFloat(data[0].lon);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw new Error("Invalid coordinates received from geocoding service");
    }

    return {
      latitude,
      longitude,
      displayName: data[0].display_name || query,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Address lookup timed out after ${GEOCODING_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
