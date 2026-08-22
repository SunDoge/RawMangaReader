import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { CheckCircle2, Download, HardDrive, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  downloadOcrModel,
  removeOcrModel,
  type OcrModelKind,
  type OcrModelProgress,
  type OcrModelStatus,
} from "@/features/ocr/api";

interface OcrModelManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: OcrModelStatus | null;
  onStatusChange: (status: OcrModelStatus) => void;
  kind: OcrModelKind;
  onKindChange: (kind: OcrModelKind) => void;
}

const formatBytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function OcrModelManager({
  open,
  onOpenChange,
  status,
  onStatusChange,
  kind,
  onKindChange,
}: OcrModelManagerProps) {
  const [downloading, setDownloading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [progress, setProgress] = useState<OcrModelProgress | null>(null);

  useEffect(() => {
    const unlisten = listen<OcrModelProgress>("ocr-model-progress", (event) => {
      setProgress(event.payload);
    });
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    setProgress(null);
    try {
      const next = await downloadOcrModel(kind);
      onStatusChange(next);
      toast.success(`PP-OCRv6 ${kind} 模型已安装并通过校验`);
    } catch (error) {
      toast.error("模型下载失败", { description: String(error) });
    } finally {
      setDownloading(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const next = await removeOcrModel(kind);
      onStatusChange(next);
      setProgress(null);
      toast.success("OCR 模型已删除");
    } catch (error) {
      toast.error("删除模型失败", { description: String(error) });
    } finally {
      setRemoving(false);
    }
  };

  const currentStatus = status?.kind === kind ? status : null;
  const downloaded = progress?.downloadedBytes ?? currentStatus?.downloadedBytes ?? 0;
  const total = progress?.totalBytes ?? currentStatus?.totalBytes ?? (kind === "small" ? 31_114_837 : 138_662_763);
  const percent = total > 0 ? Math.min(100, (downloaded / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={downloading ? undefined : onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><HardDrive className="size-4" />OCR 模型</DialogTitle>
          <DialogDescription>
            small 更快且占用更低，medium 精度更高。模型只下载到本机，不会上传漫画图片。
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {(["small", "medium"] as const).map((value) => <Button key={value} variant={kind === value ? "default" : "outline"} onClick={() => { setProgress(null); onKindChange(value); }} disabled={downloading || removing}><span className="capitalize">{value}</span><span className="text-[10px] opacity-70">{value === "small" ? "约 29.7 MB" : "约 132.2 MB"}</span></Button>)}
        </div>

        <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">PP-OCRv6 {kind}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{currentStatus?.version ?? `ppocrv6-${kind}-0.7.0`} · {formatBytes(total)}</p>
            </div>
            <Badge variant={currentStatus?.installed ? "default" : "secondary"}>
              {currentStatus?.installed ? <><CheckCircle2 />已安装</> : "未安装"}
            </Badge>
          </div>

          {(downloading || (downloaded > 0 && !currentStatus?.installed)) ? (
            <div className="grid gap-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span className="truncate">{progress?.file ?? "校验模型文件"}</span>
                <span>{formatBytes(downloaded)} / {formatBytes(total)}</span>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {currentStatus?.installed ? (
            <Button variant="destructive" onClick={() => void handleRemove()} disabled={removing}>
              {removing ? <LoaderCircle className="animate-spin" /> : <Trash2 />}删除模型
            </Button>
          ) : (
            <Button onClick={() => void handleDownload()} disabled={downloading}>
              {downloading ? <LoaderCircle className="animate-spin" /> : <Download />}下载并校验
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={downloading}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
