export type TranslationProvider = "microsoft-edge" | "openrouter";

export interface TranslationSettings {
  provider: TranslationProvider;
  openRouterApiKey: string;
  openRouterModel: string;
  comparisonModels: string;
}

export const DEFAULT_TRANSLATION_SETTINGS: TranslationSettings = {
  provider: "microsoft-edge",
  openRouterApiKey: "",
  openRouterModel: "openrouter/free",
  comparisonModels: "openrouter/free\ndots-studio/dots-3-note-preview:free",
};

export function parseComparisonModels(value: string): string[] {
  return [...new Set(value.split(/[\n,]/).map((model) => model.trim()).filter(Boolean))];
}
