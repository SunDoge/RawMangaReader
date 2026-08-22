import { DEFAULT_VERTICAL_MERGE_OPTIONS, type VerticalMergeOptions } from "@/features/ocr/api";
import { DEFAULT_TRANSLATION_OVERLAY_OPTIONS, type TranslationOverlayOptions } from "@/features/translation/overlay";
import { DEFAULT_TRANSLATION_SETTINGS, type TranslationSettings } from "@/features/translation/settings";

const STORAGE_KEY = "raw-manga-reader.preferences.v1";

export interface AppPreferences {
  mergeOptions: VerticalMergeOptions;
  showBoundingBoxes: boolean;
  translationOverlayOptions: TranslationOverlayOptions;
  translationSettings: Omit<TranslationSettings, "openRouterApiKey">;
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  mergeOptions: { ...DEFAULT_VERTICAL_MERGE_OPTIONS },
  showBoundingBoxes: true,
  translationOverlayOptions: { ...DEFAULT_TRANSLATION_OVERLAY_OPTIONS },
  translationSettings: {
    provider: DEFAULT_TRANSLATION_SETTINGS.provider,
    openRouterModel: DEFAULT_TRANSLATION_SETTINGS.openRouterModel,
    comparisonModels: DEFAULT_TRANSLATION_SETTINGS.comparisonModels,
  },
};

export interface PreferencesStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadPreferences(storage: PreferencesStorage): AppPreferences {
  try {
    const stored = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null") as Partial<AppPreferences> | null;
    if (!stored || typeof stored !== "object") return structuredClone(DEFAULT_APP_PREFERENCES);
    return {
      mergeOptions: { ...DEFAULT_APP_PREFERENCES.mergeOptions, ...stored.mergeOptions },
      showBoundingBoxes: typeof stored.showBoundingBoxes === "boolean" ? stored.showBoundingBoxes : DEFAULT_APP_PREFERENCES.showBoundingBoxes,
      translationOverlayOptions: { ...DEFAULT_APP_PREFERENCES.translationOverlayOptions, ...stored.translationOverlayOptions },
      translationSettings: { ...DEFAULT_APP_PREFERENCES.translationSettings, ...stored.translationSettings },
    };
  } catch {
    return structuredClone(DEFAULT_APP_PREFERENCES);
  }
}

export function savePreferences(storage: PreferencesStorage, preferences: AppPreferences): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export function formatAppError(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  try { return JSON.stringify(error); } catch { return "未知错误"; }
}
