import { useCallback } from "react";
import { IAnnotationType } from "@/types/annotation";
import { Check, Copy, LoaderCircle, Play, RotateCcw, Trash2 } from "lucide-react";
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
  onOCRClick?: (data: IAnnotationType, index: number) => void;
}

export function ResultList(props: IResultListProps) {
  const { annotations, selected, onOCRClick, onRemove, onSelect } = props;

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
      <div className="grid grid-cols-3 gap-1.5 border-b p-2">
        <Button variant="outline" size="xs" onClick={() => void handleCopyAll()} disabled={!annotations.length}><Copy />复制</Button>
        <Button variant="outline" size="xs" onClick={handleOCRAll} disabled={!annotations.length}><Play />检测</Button>
        <Button variant="destructive" size="xs" onClick={handleClearAll} disabled={!annotations.length}><Trash2 />清空</Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-2 p-2">
        {annotations.map((annotation, index) => (
          <button
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
            <p className="min-h-10 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{annotation.ocr || "尚未识别文本"}</p>
            <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
              {annotation.status === "finished" ? <Check className="size-3 text-emerald-500" /> : null}
              {annotation.status === "processing" ? "处理中" : annotation.status === "finished" ? "已完成" : "未处理"}
            </div>
          </button>
        ))}
        {!annotations.length ? <div className="grid place-items-center py-16 text-center text-xs text-muted-foreground">在图片上拖动以创建文本区域</div> : null}
        </div>
      </ScrollArea>
    </div>
  );
}

export default ResultList;
