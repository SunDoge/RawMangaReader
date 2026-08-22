import { describe, expect, it, vi } from "vitest";

import {
  translateWithMicrosoftEdge,
  type TranslationHttpTransport,
} from "./microsoft-edge";

describe("Microsoft Edge translation provider", () => {
  it("sends a batch through the injected native-compatible transport", async () => {
    const transport = vi.fn<TranslationHttpTransport>(async () =>
      Response.json([
        { translations: [{ text: "你好" }] },
        { translations: [{ text: "世界" }] },
      ]),
    );

    await expect(
      translateWithMicrosoftEdge(["こんにちは", "世界"], {
        from: "ja",
        to: "zh-Hans",
        transport,
      }),
    ).resolves.toEqual(["你好", "世界"]);

    const [request, init] = transport.mock.calls[0];
    const url = new URL(String(request));
    expect(url.origin + url.pathname).toBe(
      "https://edge.microsoft.com/translate/translatetext",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      from: "ja",
      to: "zh-Hans",
      isEnterpriseClient: "false",
    });
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify(["こんにちは", "世界"]),
    });
  });

  it("escapes text that the endpoint could interpret as HTML", async () => {
    const transport = vi.fn<TranslationHttpTransport>(async (_request, init) => {
      expect(JSON.parse(String(init?.body))).toEqual(["a &lt; b &amp; c"]);
      return Response.json([
        { translations: [{ text: "a &lt; b &amp; c" }] },
      ]);
    });

    await expect(
      translateWithMicrosoftEdge(["a < b & c"], {
        to: "zh-Hans",
        transport,
      }),
    ).resolves.toEqual(["a < b & c"]);
  });

  it("rejects HTTP failures and incomplete batches", async () => {
    const failedTransport = vi.fn<TranslationHttpTransport>(async () =>
      new Response("rate limited", { status: 429 }),
    );
    await expect(
      translateWithMicrosoftEdge(["text"], {
        to: "zh-Hans",
        transport: failedTransport,
      }),
    ).rejects.toThrow("(429): rate limited");

    const incompleteTransport = vi.fn<TranslationHttpTransport>(async () =>
      Response.json([]),
    );
    await expect(
      translateWithMicrosoftEdge(["text"], {
        to: "zh-Hans",
        transport: incompleteTransport,
      }),
    ).rejects.toThrow("不完整");
  });

  it("does not issue a request for an empty batch", async () => {
    const transport = vi.fn<TranslationHttpTransport>();
    await expect(
      translateWithMicrosoftEdge([], { to: "zh-Hans", transport }),
    ).resolves.toEqual([]);
    expect(transport).not.toHaveBeenCalled();
  });
});
