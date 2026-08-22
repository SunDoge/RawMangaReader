import { createXai } from "@ai-sdk/xai";
import { appHttpFetch } from "@/features/http/proxy";

export type AiHttpTransport = typeof globalThis.fetch;

export interface CreateXaiModelOptions {
  apiKey: string;
  model?: string;
  transport?: AiHttpTransport;
}

/**
 * Keeps AI SDK orchestration in TypeScript while routing production requests
 * through Tauri's native HTTP client instead of the WebView fetch implementation.
 */
export function createXaiTranslationModel({
  apiKey,
  model = "grok-4.6",
  transport = appHttpFetch,
}: CreateXaiModelOptions) {
  const provider = createXai({
    apiKey,
    fetch: transport,
  });

  return provider.chat(model);
}
