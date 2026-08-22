import { appHttpFetch } from "@/features/http/proxy";

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

export interface OpenRouterModel {
  id: string;
  name: string;
  contextLength?: number;
}

interface OpenRouterCompletion {
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  error?: { message?: string };
}

const MODEL_LIST_TIMEOUT_MS = 15_000;
const TRANSLATION_TIMEOUT_MS = 90_000;

async function requestWithTimeout(
  transport: OpenRouterHttpTransport,
  input: string,
  init: RequestInit,
  timeoutMs: number,
  parentSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) controller.abort(parentSignal.reason);
  else parentSignal?.addEventListener("abort", forwardAbort, { once: true });
  let timedOut = false;
  let timer!: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error(`OpenRouter 请求超时（${Math.round(timeoutMs / 1000)} 秒）`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      transport(input, { ...init, signal: controller.signal }),
      timeout,
    ]);
  } catch (error) {
    if (timedOut) throw new Error(`OpenRouter 请求超时（${Math.round(timeoutMs / 1000)} 秒）`);
    throw error;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", forwardAbort);
  }
}

export async function listOpenRouterModels(apiKey: string, transport: OpenRouterHttpTransport = appHttpFetch, signal?: AbortSignal): Promise<OpenRouterModel[]> {
  if (!apiKey.trim()) return [];
  const response = await requestWithTimeout(transport, "https://openrouter.ai/api/v1/models", { headers: { "Authorization": `Bearer ${apiKey.trim()}` } }, MODEL_LIST_TIMEOUT_MS, signal);
  const responseBody = await response.text();
  let payload: { data?: Array<{ id?: unknown; name?: unknown; context_length?: unknown }>; error?: { message?: string } };
  try { payload = JSON.parse(responseBody) as typeof payload; } catch { throw new Error(`OpenRouter 模型列表响应无法解析 (${response.status})`); }
  if (!response.ok) throw new Error(`OpenRouter 模型列表请求失败 (${response.status}): ${payload.error?.message ?? responseBody}`);
  if (!Array.isArray(payload.data)) throw new Error("OpenRouter 模型列表缺少 data 字段");
  return payload.data.flatMap((model) => typeof model.id === "string" ? [{ id: model.id, name: typeof model.name === "string" ? model.name : model.id, contextLength: typeof model.context_length === "number" ? model.context_length : undefined }] : []).sort((a, b) => a.name.localeCompare(b.name));
}

function translationPrompt(texts: string[], from: string, to: string): string {
  return [
    `Translate this ordered set of speech bubbles from one manga page from ${from} to ${to}.`,
    "Read every item together as page-level context before translating. Resolve omitted subjects, pronouns, names, terminology, and tone consistently across bubbles.",
    "Each input object contains its stable index and source text. Translate only the text; never merge, split, reorder, omit, or invent bubbles.",
    "Return only a JSON array of strings, in exactly the same order and with exactly the same length.",
    "Use natural concise Chinese suitable for typesetting back into the original bubble. Preserve names, punctuation, sound effects, and character voice. Do not add explanations.",
    JSON.stringify(texts.map((text, index) => ({ index, text }))),
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
  { apiKey, model, from = "Japanese", to = "Simplified Chinese", transport = appHttpFetch, signal }: OpenRouterTranslationOptions,
): Promise<string[]> {
  if (!texts.length) return [];
  if (!apiKey.trim()) throw new Error("请先填写 OpenRouter API Key");
  if (!model.trim()) throw new Error("请先填写 OpenRouter 模型名称");

  const response = await requestWithTimeout(transport, "https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: model.trim(), temperature: 0, messages: [{ role: "user", content: translationPrompt(texts, from, to) }] }),
  }, TRANSLATION_TIMEOUT_MS, signal);
  const responseBody = await response.text();
  let completion: OpenRouterCompletion;
  try { completion = JSON.parse(responseBody) as OpenRouterCompletion; } catch {
    throw new Error(`OpenRouter 返回了无法解析的响应 (${response.status})`);
  }
  if (!response.ok) throw new Error(`OpenRouter 请求失败 (${response.status}): ${completion.error?.message ?? responseBody}`);
  const content = completion.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("");
  if (!text) throw new Error("OpenRouter 成功响应中没有译文内容");
  return parseTranslationArray(text, texts.length);
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
