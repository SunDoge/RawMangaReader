export type TranslationDirection = "auto" | "horizontal" | "vertical";

export interface TranslationOverlayOptions {
  visible: boolean;
  direction: TranslationDirection;
  fontScale: number;
  backgroundOpacity: number;
}

export const DEFAULT_TRANSLATION_OVERLAY_OPTIONS: TranslationOverlayOptions = {
  visible: true,
  direction: "auto",
  fontScale: 1,
  backgroundOpacity: 0.92,
};

export function translationFitBounds(width: number, height: number): { min: number; max: number } {
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  return {
    min: Math.max(2, Math.min(5, shortSide * 0.16)),
    max: Math.max(2, Math.min(72, Math.min(shortSide * 0.9, longSide * 0.48))),
  };
}

export function resolveTranslationDirection(
  width: number,
  height: number,
  direction: TranslationDirection,
): Exclude<TranslationDirection, "auto"> {
  if (direction !== "auto") return direction;
  return height > width * 1.35 ? "vertical" : "horizontal";
}
