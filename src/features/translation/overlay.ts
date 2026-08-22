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

export function resolveTranslationDirection(
  width: number,
  height: number,
  direction: TranslationDirection,
): Exclude<TranslationDirection, "auto"> {
  if (direction !== "auto") return direction;
  return height > width * 1.35 ? "vertical" : "horizontal";
}
