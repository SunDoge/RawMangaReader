import type { TranslationDirection, TranslationOverlayOptions } from "@/features/translation/overlay";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TranslationOverlaySettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: TranslationOverlayOptions;
  onOptionsChange: (options: TranslationOverlayOptions) => void;
  onReset: () => void;
}

export function TranslationOverlaySettings({ open, onOpenChange, options, onOptionsChange, onReset }: TranslationOverlaySettingsProps) {
  const update = (patch: Partial<TranslationOverlayOptions>) => onOptionsChange({ ...options, ...patch });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>译文回填</DialogTitle>
          <DialogDescription>控制译文在原始文本框中的排版和遮盖效果。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <label className="flex items-center justify-between rounded-lg border p-3 text-xs">
            <span>在图片上显示译文</span>
            <input className="size-4 accent-primary" type="checkbox" checked={options.visible} onChange={(event) => update({ visible: event.target.checked })} />
          </label>
          <label className="grid gap-1.5 text-xs">
            <span>文字方向</span>
            <select className="h-9 rounded-md border bg-background px-2 outline-none focus:border-ring focus:ring-2 focus:ring-ring/30" value={options.direction} onChange={(event) => update({ direction: event.target.value as TranslationDirection })}>
              <option value="auto">根据 bbox 自动判断</option>
              <option value="horizontal">强制横排</option>
              <option value="vertical">强制竖排</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs">
            <span className="flex justify-between"><span>字号倍率</span><span className="font-mono text-muted-foreground">{options.fontScale.toFixed(2)}</span></span>
            <input className="h-2 cursor-pointer accent-primary" type="range" min="0.6" max="1.5" step="0.05" value={options.fontScale} onChange={(event) => update({ fontScale: Number(event.target.value) })} />
          </label>
          <label className="grid gap-1.5 text-xs">
            <span className="flex justify-between"><span>背景不透明度</span><span className="font-mono text-muted-foreground">{Math.round(options.backgroundOpacity * 100)}%</span></span>
            <input className="h-2 cursor-pointer accent-primary" type="range" min="0" max="1" step="0.05" value={options.backgroundOpacity} onChange={(event) => update({ backgroundOpacity: Number(event.target.value) })} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onReset}>恢复默认值</Button>
          <Button onClick={() => onOpenChange(false)}>完成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
