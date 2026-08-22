import { describe, expect, it, vi } from "vitest";
import { compareOpenRouterModels, listOpenRouterModels, parseTranslationArray, translateWithOpenRouter, type OpenRouterHttpTransport } from "./openrouter";

function completion(content: string, model = "test/model") {
  return { id: "id", object: "chat.completion", created: 1, model, choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }], usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } };
}

describe("OpenRouter translation provider", () => {
  it("uses the OpenRouter endpoint and preserves batch order", async () => {
    const transport = vi.fn<OpenRouterHttpTransport>(async () => Response.json(completion('["你好","世界"]')));
    await expect(translateWithOpenRouter(["こんにちは", "世界"], { apiKey: "test-key", model: "test/model", transport })).resolves.toEqual(["你好", "世界"]);
    const [url, init] = transport.mock.calls[0];
    expect(String(url)).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-key");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ model: "test/model", temperature: 0, messages: [{ role: "user" }] });
    expect(body.messages[0].content).toContain("page-level context");
    expect(body.messages[0].content).toContain('[{"index":0,"text":"こんにちは"},{"index":1,"text":"世界"}]');
  });

  it("accepts fenced JSON and rejects incomplete batches", () => {
    expect(parseTranslationArray('```json\n["译文"]\n```', 1)).toEqual(["译文"]);
    expect(() => parseTranslationArray('["一条"]', 2)).toThrow("预期 2 条");
    expect(() => parseTranslationArray("not json", 1)).toThrow("有效的 JSON");
  });

  it("compares the same batch while isolating model failures", async () => {
    const transport = vi.fn<OpenRouterHttpTransport>(async (_url, init) => {
      const model = JSON.parse(String(init?.body)).model as string;
      return Response.json(completion(model === "bad/model" ? "invalid" : '["译文"]', model));
    });
    const results = await compareOpenRouterModels(["原文"], ["good/model", "bad/model", "good/model"], { apiKey: "key", transport });
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ model: "good/model", translations: ["译文"] });
    expect(results[1]).toMatchObject({ model: "bad/model", error: expect.any(String) });
  });

  it("does not issue a request for an empty batch", async () => {
    const transport = vi.fn<OpenRouterHttpTransport>();
    await expect(translateWithOpenRouter([], { apiKey: "", model: "", transport })).resolves.toEqual([]);
    expect(transport).not.toHaveBeenCalled();
  });

  it("reports the actual OpenRouter API error", async () => {
    const transport = vi.fn<OpenRouterHttpTransport>(async () => Response.json({ error: { message: "model is unavailable" } }, { status: 404 }));
    await expect(translateWithOpenRouter(["text"], { apiKey: "key", model: "missing", transport })).rejects.toThrow("(404): model is unavailable");
  });

  it("loads and normalizes the authenticated model list", async () => {
    const transport = vi.fn<OpenRouterHttpTransport>(async () => Response.json({ data: [{ id: "z/model", name: "Zulu", context_length: 1000 }, { id: "a/model", name: "Alpha" }] }));
    await expect(listOpenRouterModels("key", transport)).resolves.toEqual([{ id: "a/model", name: "Alpha", contextLength: undefined }, { id: "z/model", name: "Zulu", contextLength: 1000 }]);
    expect(new Headers(transport.mock.calls[0][1]?.headers).get("authorization")).toBe("Bearer key");
  });

  it("aborts a model-list request that never settles", async () => {
    vi.useFakeTimers();
    try {
      let requestSignal: AbortSignal | undefined;
      const transport = vi.fn<OpenRouterHttpTransport>(async (_url, init) => {
        requestSignal = init?.signal ?? undefined;
        return await new Promise<Response>(() => undefined);
      });
      const request = listOpenRouterModels("key", transport);
      const rejection = expect(request).rejects.toThrow("请求超时（15 秒）");
      await vi.advanceTimersByTimeAsync(15_000);
      await rejection;
      expect(requestSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
