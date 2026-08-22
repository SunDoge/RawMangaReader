import { useCallback } from "react";
import { IAnnotationType } from "@/types/annotation";
import { Check, Copy, Languages, LoaderCircle, Play, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface IResultListProps {
  annotations: IAnnotationType[];
  selected?: number;
  onSelect?: (index: number) => void;
  onRemove?: (index: number, length?: number) => void;
  onUpdate?: (index: number, patch: Partial<IAnnotationType>) => void;
  onOCRClick?: (data: IAnnotationType, index: number) => void;
  onTranslateAll?: () => void;
  translating?: boolean;
}

export function ResultList(props: IResultListProps) {
  const { annotations, selected, onOCRClick, onRemove, onSelect, onUpdate, onTranslateAll, translating } = props;

  const handleCopyAll = useCallback(async () => {
    const text = annotations.map((annotation, index) => `${index + 1}: ${annotation.ocr || ""}`).join("\n");
    await navigator.clipboard.writeText(text);
    toast.success("已复制全部结果");
  }, [annotations]);

  const handleOCRAll = useCallback(() => {
    annotations.forEach((annotation, index) => onOCRClick?.(annotation, index));
  }, [annotations]);

  const handleClearAll = useCallback(() => {
    onRemove?.(0, annotations.length);
  }, [annotations]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="grid grid-cols-4 gap-1.5 border-b p-2">
        <Button variant="outline" size="xs" onClick={() => void handleCopyAll()} disabled={!annotations.length}><Copy />复制</Button>
        <Button variant="outline" size="xs" onClick={handleOCRAll} disabled={!annotations.length}><Play />检测</Button>
        <Button variant="outline" size="xs" onClick={onTranslateAll} disabled={translating || !annotations.some((item) => item.ocr?.trim())}>
          {translating ? <LoaderCircle className="animate-spin" /> : <Languages />}翻译
        </Button>
        <Button variant="destructive" size="xs" onClick={handleClearAll} disabled={!annotations.length}><Trash2 />清空</Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-2 p-2">
        {annotations.map((annotation, index) => (
          <div
            className={cn("rounded-lg border p-3 text-left transition hover:bg-muted/60", selected === index && "border-primary bg-primary/5 ring-1 ring-primary/20")}
            key={annotation.id}
            onClick={() => onSelect?.(index)}
          >
            <div className="mb-2 flex items-center justify-between">
              <Badge variant="secondary">区域 {index + 1}</Badge>
              <div className="flex items-center gap-1">
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-xs" onClick={(event) => { event.stopPropagation(); onOCRClick?.(annotation, index); }}>
                  {annotation.status === "processing" ? <LoaderCircle className="animate-spin" /> : annotation.status === "finished" ? <RotateCcw /> : <Play />}
                </Button></TooltipTrigger><TooltipContent>{annotation.status === "finished" ? "重新检测" : "检测"}</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-xs" onClick={(event) => { event.stopPropagation(); onRemove?.(index); }}><Trash2 className="text-destructive" /></Button></TooltipTrigger><TooltipContent>移除</TooltipContent></Tooltip>
              </div>
            </div>
            <textarea
              className="min-h-16 w-full resize-y rounded-md border bg-background px-2 py-1.5 text-xs leading-5 outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
              value={annotation.ocr ?? ""}
              placeholder="尚未识别文本"
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onUpdate?.(index, { ocr: event.target.value })}
            />
            {annotation.translation != null ? (
              <textarea
                className="mt-2 min-h-16 w-full resize-y rounded-md border bg-muted/30 px-2 py-1.5 text-xs leading-5 outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
                value={annotation.translation}
                placeholder="译文"
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => onUpdate?.(index, { translation: event.target.value })}
              />
            ) : null}
            <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
              {annotation.status === "finished" ? <Check className="size-3 text-emerald-500" /> : null}
              {annotation.error ? "识别失败" : annotation.status === "processing" ? "处理中" : annotation.status === "finished" ? `已完成${annotation.confidence != null ? ` · ${(annotation.confidence * 100).toFixed(1)}%` : ""}` : "未处理"}
            </div>
          </div>
        ))}
        {!annotations.length ? <div className="grid place-items-center py-16 text-center text-xs text-muted-foreground">在图片上拖动以创建文本区域</div> : null}
        </div>
      </ScrollArea>
    </div>
  );
}

export default ResultList;
