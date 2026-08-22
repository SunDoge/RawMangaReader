import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { generateText } from "ai";

export type OpenRouterHttpTransport = typeof globalThis.fetch;

export interface OpenRouterTranslationOptions {
  apiKey: string;
  model: string;
  from?: string;
  to?: string;
  transport?: OpenRouterHttpTransport;
  signal?: AbortSignal;
}

export interface OpenRouterComparisonResult {
  model: string;
  durationMs: number;
  translations?: string[];
  error?: string;
}

function translationPrompt(texts: string[], from: string, to: string): string {
  return [
    `Translate each item from ${from} to ${to}.`,
    "Return only a JSON array of strings, in exactly the same order and with exactly the same length.",
    "Preserve names, punctuation, and the tone of manga dialogue. Do not add explanations.",
    JSON.stringify(texts),
  ].join("\n");
}

export function parseTranslationArray(text: string, expectedLength: number): string[] {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? trimmed;
  let value: unknown;
  try {
    value = JSON.parse(fenced);
  } catch {
    throw new Error("模型没有返回有效的 JSON 字符串数组");
  }
  if (!Array.isArray(value) || value.length !== expectedLength || value.some((item) => typeof item !== "string")) {
    throw new Error(`模型返回了 ${Array.isArray(value) ? value.length : "非数组"} 条译文，预期 ${expectedLength} 条`);
  }
  return value;
}

export async function translateWithOpenRouter(
  texts: string[],
  { apiKey, model, from = "Japanese", to = "Simplified Chinese", transport = tauriFetch, signal }: OpenRouterTranslationOptions,
): Promise<string[]> {
  if (!texts.length) return [];
  if (!apiKey.trim()) throw new Error("请先填写 OpenRouter API Key");
  if (!model.trim()) throw new Error("请先填写 OpenRouter 模型名称");

  const openrouter = createOpenRouter({ apiKey: apiKey.trim(), fetch: transport });
  const result = await generateText({
    model: openrouter.chat(model.trim()),
    prompt: translationPrompt(texts, from, to),
    abortSignal: signal,
    temperature: 0,
  });
  return parseTranslationArray(result.text, texts.length);
}

export async function compareOpenRouterModels(
  texts: string[],
  models: string[],
  options: Omit<OpenRouterTranslationOptions, "model">,
): Promise<OpenRouterComparisonResult[]> {
  const uniqueModels = [...new Set(models.map((model) => model.trim()).filter(Boolean))];
  return Promise.all(uniqueModels.map(async (model) => {
    const started = performance.now();
    try {
      const translations = await translateWithOpenRouter(texts, { ...options, model });
      return { model, durationMs: Math.round(performance.now() - started), translations };
    } catch (error) {
      return { model, durationMs: Math.round(performance.now() - started), error: error instanceof Error ? error.message : String(error) };
    }
  }));
}
