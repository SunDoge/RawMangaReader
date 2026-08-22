export type TranslationProvider = "microsoft-edge" | "openrouter";

export interface TranslationSettings {
  provider: TranslationProvider;
  openRouterApiKey: string;
  openRouterModel: string;
  comparisonModels: string;
  proxyEnabled: boolean;
  proxyUrl: string;
  proxyNoProxy: string;
}

export const DEFAULT_TRANSLATION_SETTINGS: TranslationSettings = {
  provider: "microsoft-edge",
  openRouterApiKey: "",
  openRouterModel: "openrouter/free",
  comparisonModels: "openrouter/free\ndots-studio/dots-3-note-preview:free",
  proxyEnabled: false,
  proxyUrl: "http://127.0.0.1:7890",
  proxyNoProxy: "localhost,127.0.0.1",
};

export function parseComparisonModels(value: string): string[] {
  return [...new Set(value.split(/[\n,]/).map((model) => model.trim()).filter(Boolean))];
}
