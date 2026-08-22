import { useEffect, useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listOpenRouterModels, type OpenRouterComparisonResult, type OpenRouterModel } from "@/features/translation/providers/openrouter";
import { formatAppError } from "@/features/preferences";
import type { TranslationProvider, TranslationSettings } from "@/features/translation/settings";

interface TranslationProviderSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: TranslationSettings;
  onSettingsChange: (settings: TranslationSettings) => void;
  onCompare: () => Promise<OpenRouterComparisonResult[]>;
  canCompare: boolean;
}

const fieldClass = "h-9 rounded-md border bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

export function TranslationProviderSettings({ open, onOpenChange, settings, onSettingsChange, onCompare, canCompare }: TranslationProviderSettingsProps) {
  const [comparing, setComparing] = useState(false);
  const [results, setResults] = useState<OpenRouterComparisonResult[]>([]);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const update = (patch: Partial<TranslationSettings>) => onSettingsChange({ ...settings, ...patch });

  const compare = async () => {
    setComparing(true);
    try { setResults(await onCompare()); } finally { setComparing(false); }
  };

  useEffect(() => {
    if (!open || !settings.openRouterApiKey.trim()) { setModels([]); setModelsError(""); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setModelsLoading(true);
      setModelsError("");
      void listOpenRouterModels(settings.openRouterApiKey, undefined, controller.signal)
        .then(setModels)
        .catch((error) => { if (!controller.signal.aborted) setModelsError(formatAppError(error)); })
        .finally(() => { if (!controller.signal.aborted) setModelsLoading(false); });
    }, 500);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, settings.openRouterApiKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>翻译服务</DialogTitle>
          <DialogDescription>代理应用于翻译、模型列表和 OCR 模型下载；OpenRouter 密钥只保存在本次应用会话中。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 rounded-lg border p-3">
            <label className="flex items-center justify-between text-xs"><span>为 HTTP 请求启用代理</span><input className="size-4 accent-primary" type="checkbox" checked={settings.proxyEnabled} onChange={(event) => update({ proxyEnabled: event.target.checked })} /></label>
            <label className="grid gap-1.5 text-xs"><span>代理地址</span><input className={fieldClass} spellCheck={false} placeholder="http://127.0.0.1:7890" value={settings.proxyUrl} onChange={(event) => update({ proxyUrl: event.target.value })} /></label>
            <label className="grid gap-1.5 text-xs"><span>不使用代理（逗号分隔）</span><input className={fieldClass} spellCheck={false} placeholder="localhost,127.0.0.1" value={settings.proxyNoProxy} onChange={(event) => update({ proxyNoProxy: event.target.value })} /></label>
          </div>
          <label className="grid gap-1.5 text-xs"><span>当前服务</span><select className={fieldClass} value={settings.provider} onChange={(event) => update({ provider: event.target.value as TranslationProvider })}><option value="microsoft-edge">Microsoft Edge（无需密钥）</option><option value="openrouter">OpenRouter</option></select></label>
          <label className="grid gap-1.5 text-xs"><span>OpenRouter API Key</span><span className="relative"><input className={`${fieldClass} w-full pr-10`} type={showApiKey ? "text" : "password"} autoComplete="off" placeholder="sk-or-v1-…" value={settings.openRouterApiKey} onChange={(event) => update({ openRouterApiKey: event.target.value })} /><Button type="button" variant="ghost" size="icon-xs" className="absolute right-1 top-1/2 -translate-y-1/2" aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"} aria-pressed={showApiKey} onClick={() => setShowApiKey((value) => !value)}>{showApiKey ? <EyeOff /> : <Eye />}</Button></span></label>
          <label className="grid gap-1.5 text-xs"><span className="flex items-center justify-between"><span>翻译模型</span><span className="text-muted-foreground">{modelsLoading ? "正在加载…" : models.length ? `${models.length} 个可用模型` : "可手动填写 ID"}</span></span><input className={fieldClass} list="openrouter-models" spellCheck={false} value={settings.openRouterModel} onChange={(event) => update({ openRouterModel: event.target.value })} /><datalist id="openrouter-models">{models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</datalist>{modelsError ? <span className="text-destructive">{modelsError}</span> : null}</label>
          <label className="grid gap-1.5 text-xs"><span>对比模型（逗号或换行分隔）</span><textarea className="min-h-20 rounded-md border bg-background p-2 font-mono text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30" spellCheck={false} value={settings.comparisonModels} onChange={(event) => update({ comparisonModels: event.target.value })} /></label>
          {results.length ? <div className="grid gap-2 rounded-lg border p-3 text-xs">{results.map((result) => <div key={result.model} className="grid gap-1 border-b pb-2 last:border-0 last:pb-0"><div className="flex justify-between gap-3 font-mono"><span className="truncate">{result.model}</span><span className="shrink-0 text-muted-foreground">{result.durationMs} ms</span></div>{result.error ? <p className="text-destructive">{result.error}</p> : <p className="line-clamp-3 text-muted-foreground">{result.translations?.join(" / ")}</p>}</div>)}</div> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={!canCompare || comparing || !settings.openRouterApiKey.trim()} onClick={() => void compare()}>{comparing ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}对比当前页</Button>
          <Button onClick={() => onOpenChange(false)}>完成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
