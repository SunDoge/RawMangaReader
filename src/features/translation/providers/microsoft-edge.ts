import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export type TranslationHttpTransport = typeof globalThis.fetch;

export interface MicrosoftEdgeTranslateOptions {
  from?: string;
  to: string;
  signal?: AbortSignal;
  transport?: TranslationHttpTransport;
}

interface MicrosoftTranslationResult {
  translations?: Array<{ text?: string }>;
}

const MICROSOFT_EDGE_TRANSLATE_URL =
  "https://edge.microsoft.com/translate/translatetext";

const escapeText = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const decodeText = (text: string) =>
  text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");

/**
 * Uses the unauthenticated translation endpoint shipped with Microsoft Edge.
 * It is useful as a zero-configuration provider, but is not a stable Azure API.
 */
export async function translateWithMicrosoftEdge(
  texts: string[],
  {
    from = "auto",
    to,
    signal,
    transport = tauriFetch,
  }: MicrosoftEdgeTranslateOptions,
): Promise<string[]> {
  if (!texts.length) return [];

  const url = new URL(MICROSOFT_EDGE_TRANSLATE_URL);
  url.searchParams.set("from", from === "auto" ? "" : from);
  url.searchParams.set("to", to);
  url.searchParams.set("isEnterpriseClient", "false");

  const response = await transport(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(texts.map(escapeText)),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Microsoft Edge 翻译请求失败 (${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }

  const result: unknown = await response.json();
  if (!Array.isArray(result) || result.length !== texts.length) {
    throw new Error("Microsoft Edge 翻译返回了不完整的结果");
  }

  return result.map((item, index) => {
    const text = (item as MicrosoftTranslationResult)?.translations?.[0]?.text;
    if (typeof text !== "string") {
      throw new Error(`Microsoft Edge 翻译缺少第 ${index + 1} 条结果`);
    }
    return decodeText(text);
  });
}
