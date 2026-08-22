import { DEFAULT_VERTICAL_MERGE_OPTIONS, type VerticalMergeOptions } from "@/features/ocr/api";
import { DEFAULT_TRANSLATION_OVERLAY_OPTIONS, type TranslationOverlayOptions } from "@/features/translation/overlay";
import { DEFAULT_TRANSLATION_SETTINGS, type TranslationSettings } from "@/features/translation/settings";

export interface AppPreferences {
  mergeOptions: VerticalMergeOptions;
  showBoundingBoxes: boolean;
  showRawBoundingBoxes: boolean;
  translationOverlayOptions: TranslationOverlayOptions;
  translationSettings: Omit<TranslationSettings, "openRouterApiKey">;
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  mergeOptions: { ...DEFAULT_VERTICAL_MERGE_OPTIONS },
  showBoundingBoxes: true,
  showRawBoundingBoxes: false,
  translationOverlayOptions: { ...DEFAULT_TRANSLATION_OVERLAY_OPTIONS },
  translationSettings: {
    provider: DEFAULT_TRANSLATION_SETTINGS.provider,
    openRouterModel: DEFAULT_TRANSLATION_SETTINGS.openRouterModel,
    comparisonModels: DEFAULT_TRANSLATION_SETTINGS.comparisonModels,
  },
};

export function formatAppError(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  try { return JSON.stringify(error); } catch { return "未知错误"; }
}
