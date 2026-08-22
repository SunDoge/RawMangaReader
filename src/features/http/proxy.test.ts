import { describe, expect, it, vi } from "vitest";
import { createProxyTransport, proxyClientOptions, type HttpTransport } from "./proxy";

describe("HTTP proxy transport", () => {
  it("adds the configured proxy to Tauri HTTP requests", async () => {
    const transport = vi.fn<HttpTransport>(async () => new Response("ok"));
    await createProxyTransport({ proxyEnabled: true, proxyUrl: "http://127.0.0.1:7890", proxyNoProxy: "localhost" }, transport)("https://example.com");
    expect(transport.mock.calls[0][1]).toMatchObject({ proxy: { all: { url: "http://127.0.0.1:7890", noProxy: "localhost" } } });
  });

  it("omits proxy options when disabled and validates enabled URLs", () => {
    expect(proxyClientOptions({ proxyEnabled: false, proxyUrl: "bad", proxyNoProxy: "" })).toEqual({});
    expect(() => proxyClientOptions({ proxyEnabled: true, proxyUrl: "", proxyNoProxy: "" })).toThrow("尚未填写");
    expect(() => proxyClientOptions({ proxyEnabled: true, proxyUrl: "ftp://localhost", proxyNoProxy: "" })).toThrow("仅支持");
  });
});
