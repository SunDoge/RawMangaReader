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
  openRouterModel: "google/gemini-2.5-flash",
  comparisonModels: "google/gemini-2.5-flash\nopenai/gpt-4.1-mini",
};

export function parseComparisonModels(value: string): string[] {
  return [...new Set(value.split(/[\n,]/).map((model) => model.trim()).filter(Boolean))];
}
