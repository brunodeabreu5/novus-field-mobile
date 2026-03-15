import { Dimensions, PixelRatio } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

/**
 * Escala responsiva baseada na largura da tela.
 * Valores menores em telas pequenas, maiores em telas grandes.
 */
export function scale(size: number): number {
  const scaleFactor = SCREEN_WIDTH / BASE_WIDTH;
  return Math.round(PixelRatio.roundToNearestPixel(size * scaleFactor));
}

/**
 * Escala vertical para altura.
 */
export function verticalScale(size: number): number {
  const scaleFactor = SCREEN_HEIGHT / BASE_HEIGHT;
  return Math.round(PixelRatio.roundToNearestPixel(size * scaleFactor));
}

/**
 * Escala moderada - menos agressiva que scale().
 * factor 0.5 = meio caminho entre fixo e totalmente escalado.
 */
export function moderateScale(size: number, factor = 0.5): number {
  return size + (scale(size) - size) * factor;
}

/**
 * Espaçamento base (4px) escalado.
 * xs: 4-6, sm: 8-12, md: 16-20, lg: 24-28, xl: 32-40, 2xl: 48-56
 */
export const spacing = {
  xs: scale(4),
  sm: scale(8),
  md: scale(16),
  lg: scale(24),
  xl: scale(32),
  "2xl": scale(48),
};

/**
 * Tamanhos de fonte responsivos.
 * Títulos e textos maiores em telas grandes.
 */
export const fontSize = {
  xs: scale(10),
  sm: scale(12),
  base: scale(14),
  md: scale(16),
  lg: scale(18),
  xl: scale(20),
  "2xl": scale(24),
  "3xl": scale(28),
};

/**
 * Raio de borda.
 */
export const radius = {
  sm: scale(8),
  md: scale(12),
  lg: scale(16),
  xl: scale(20),
  full: 999,
};
