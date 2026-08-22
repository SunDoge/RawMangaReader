import { generateText, streamText } from "ai";
import { describe, expect, it, vi } from "vitest";

import {
  createXaiTranslationModel,
  type AiHttpTransport,
} from "./xai";

const completion = {
  id: "completion-id",
  object: "chat.completion",
  created: 1,
  model: "grok-test",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "翻译结果" },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 3,
    completion_tokens: 2,
    total_tokens: 5,
  },
};

describe("xAI translation provider", () => {
  it("injects a fetch-compatible transport into AI SDK", async () => {
    const transport = vi.fn<AiHttpTransport>(async () =>
      Response.json(completion),
    );

    const result = await generateText({
      model: createXaiTranslationModel({
        apiKey: "local-test-key",
        model: "grok-test",
        transport,
      }),
      prompt: "translate this",
    });

    expect(result.text).toBe("翻译结果");
    expect(transport).toHaveBeenCalledOnce();

    const [url, init] = transport.mock.calls[0];
    expect(String(url)).toBe("https://api.x.ai/v1/chat/completions");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer local-test-key",
    );
    const requestBody = JSON.parse(String(init?.body));
    expect(requestBody).toMatchObject({ model: "grok-test" });
    expect(requestBody).not.toHaveProperty("stream");
  });

  it("consumes an SSE stream through the injected transport", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      {
        id: "completion-id",
        object: "chat.completion.chunk",
        created: 1,
        model: "grok-test",
        choices: [{ index: 0, delta: { role: "assistant", content: "翻译" } }],
      },
      {
        id: "completion-id",
        object: "chat.completion.chunk",
        created: 1,
        model: "grok-test",
        choices: [
          { index: 0, delta: { content: "结果" }, finish_reason: "stop" },
        ],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      },
    ];
    const body = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    const transport = vi.fn<AiHttpTransport>(async () =>
      new Response(body, {
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const result = streamText({
      model: createXaiTranslationModel({
        apiKey: "local-test-key",
        model: "grok-test",
        transport,
      }),
      prompt: "translate this",
    });

    expect(await result.text).toBe("翻译结果");
    expect(JSON.parse(String(transport.mock.calls[0][1]?.body))).toMatchObject({
      stream: true,
    });
  });

  it("forwards cancellation to the transport", async () => {
    const controller = new AbortController();
    const transport = vi.fn<AiHttpTransport>((_input, init) => {
      expect(init?.signal).toBe(controller.signal);
      return Promise.reject(new DOMException("cancelled", "AbortError"));
    });

    await expect(
      generateText({
        model: createXaiTranslationModel({
          apiKey: "local-test-key",
          model: "grok-test",
          transport,
        }),
        prompt: "translate this",
        abortSignal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
