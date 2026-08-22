import { fetch as tauriFetch, type ClientOptions } from "@tauri-apps/plugin-http";
import { invoke } from "@tauri-apps/api/core";

export interface HttpProxySettings {
  proxyEnabled: boolean;
  proxyUrl: string;
  proxyNoProxy: string;
}

export type HttpTransport = typeof globalThis.fetch;
type TauriTransport = (input: URL | Request | string, init?: RequestInit & ClientOptions) => Promise<Response>;

export const DEFAULT_HTTP_PROXY_SETTINGS: HttpProxySettings = {
  proxyEnabled: false,
  proxyUrl: "http://127.0.0.1:7890",
  proxyNoProxy: "localhost,127.0.0.1",
};

let currentSettings: HttpProxySettings = { ...DEFAULT_HTTP_PROXY_SETTINGS };

export function configureHttpProxy(settings: HttpProxySettings): void {
  currentSettings = { ...settings };
}

export const configureNativeHttpProxy = (settings: HttpProxySettings) => invoke<void>("set_http_proxy", {
  enabled: settings.proxyEnabled,
  url: settings.proxyUrl,
  noProxy: settings.proxyNoProxy,
});

export function proxyClientOptions(settings: HttpProxySettings): ClientOptions {
  if (!settings.proxyEnabled) return {};
  const value = settings.proxyUrl.trim();
  if (!value) throw new Error("代理已启用，但尚未填写代理地址");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("代理地址格式无效"); }
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error("代理仅支持 http 或 https 协议");
  }
  return { proxy: { all: { url: value, noProxy: settings.proxyNoProxy.trim() || undefined } } };
}

export function createProxyTransport(settings: HttpProxySettings, baseTransport: TauriTransport = tauriFetch): HttpTransport {
  return (input, init) => baseTransport(input, { ...init, ...proxyClientOptions(settings) });
}

export const appHttpFetch: HttpTransport = (input, init) => createProxyTransport(currentSettings)(input, init);
