import { useState } from "react";
import type { VerticalMergeOptions } from "@/features/ocr/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OcrDebugSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: VerticalMergeOptions;
  onOptionsChange: (options: VerticalMergeOptions) => void;
  showBoundingBoxes: boolean;
  onShowBoundingBoxesChange: (show: boolean) => void;
  showRawBoundingBoxes: boolean;
  onShowRawBoundingBoxesChange: (show: boolean) => void;
  onPreview: () => Promise<void>;
  canPreview: boolean;
  onReset: () => void;
}

interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function RangeField({ label, value, min, max, step, onChange }: RangeFieldProps) {
  return (
    <label className="grid gap-1.5">
      <span className="flex items-center justify-between text-xs">
        <span>{label}</span>
        <span className="font-mono text-muted-foreground">{value.toFixed(2)}</span>
      </span>
      <input
        className="h-2 w-full cursor-pointer accent-primary"
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function OcrDebugSettings({
  open,
  onOpenChange,
  options,
  onOptionsChange,
  showBoundingBoxes,
  onShowBoundingBoxesChange,
  showRawBoundingBoxes,
  onShowRawBoundingBoxesChange,
  onPreview,
  canPreview,
  onReset,
}: OcrDebugSettingsProps) {
  const [previewing, setPreviewing] = useState(false);
  const update = (patch: Partial<VerticalMergeOptions>) =>
    onOptionsChange({ ...options, ...patch });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>OCR 几何合并</DialogTitle>
          <DialogDescription>参数会在下一次整页 OCR 时生效，用 bbox 观察合并结果。</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <label className="flex items-center justify-between rounded-lg border p-3 text-xs">
            <span>合并竖排片段</span>
            <input
              className="size-4 accent-primary"
              type="checkbox"
              checked={options.enabled}
              onChange={(event) => update({ enabled: event.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border p-3 text-xs">
            <span>显示模型原始 bbox（调试）</span>
            <input className="size-4 accent-primary" type="checkbox" checked={showRawBoundingBoxes} onChange={(event) => onShowRawBoundingBoxesChange(event.target.checked)} />
          </label>
          <label className="flex items-center justify-between rounded-lg border p-3 text-xs">
            <span>在图像上显示 bbox</span>
            <input
              className="size-4 accent-primary"
              type="checkbox"
              checked={showBoundingBoxes}
              onChange={(event) => onShowBoundingBoxesChange(event.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border p-3 text-xs">
            <span>合并同一段中的相邻竖排列</span>
            <input className="size-4 accent-primary" type="checkbox" checked={options.mergeAdjacentColumns} onChange={(event) => update({ mergeAdjacentColumns: event.target.checked })} />
          </label>
          <RangeField label="过滤短边小于此值的文字框（px，0 为关闭）" value={options.minTextSizePx} min={0} max={64} step={1} onChange={(value) => update({ minTextSizePx: value })} />
          <RangeField label="最小竖排长宽比" value={options.minAspectRatio} min={1} max={3} step={0.05} onChange={(value) => update({ minAspectRatio: value })} />
          <RangeField label="最小水平重叠比例" value={options.minOverlapRatio} min={0} max={1} step={0.05} onChange={(value) => update({ minOverlapRatio: value })} />
          <RangeField label="最大中心偏移 / 字宽" value={options.maxCenterOffsetRatio} min={0} max={1} step={0.05} onChange={(value) => update({ maxCenterOffsetRatio: value })} />
          <RangeField label="最大垂直间距 / 字宽" value={options.maxGapWidthRatio} min={0} max={4} step={0.1} onChange={(value) => update({ maxGapWidthRatio: value })} />
          <RangeField label="相邻列最小垂直重叠" value={options.minColumnOverlapRatio} min={0.3} max={1} step={0.05} onChange={(value) => update({ minColumnOverlapRatio: value })} />
          <RangeField label="相邻列最大水平间距 / 字宽" value={options.maxColumnGapWidthRatio} min={0} max={2} step={0.1} onChange={(value) => update({ maxColumnGapWidthRatio: value })} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onReset}>恢复默认值</Button>
          <Button variant="outline" disabled={!canPreview || previewing} onClick={() => { setPreviewing(true); void onPreview().finally(() => setPreviewing(false)); }}>{previewing ? "识别中…" : "重新识别并预览"}</Button>
          <Button onClick={() => onOpenChange(false)}>完成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
