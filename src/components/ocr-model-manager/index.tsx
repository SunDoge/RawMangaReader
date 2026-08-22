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
  type OcrModelProgress,
  type OcrModelStatus,
} from "@/features/ocr/api";

interface OcrModelManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: OcrModelStatus | null;
  onStatusChange: (status: OcrModelStatus) => void;
}

const formatBytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function OcrModelManager({
  open,
  onOpenChange,
  status,
  onStatusChange,
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
      const next = await downloadOcrModel();
      onStatusChange(next);
      toast.success("PP-OCRv6 small 模型已安装并通过校验");
    } catch (error) {
      toast.error("模型下载失败", { description: String(error) });
    } finally {
      setDownloading(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const next = await removeOcrModel();
      onStatusChange(next);
      setProgress(null);
      toast.success("OCR 模型已删除");
    } catch (error) {
      toast.error("删除模型失败", { description: String(error) });
    } finally {
      setRemoving(false);
    }
  };

  const downloaded = progress?.downloadedBytes ?? status?.downloadedBytes ?? 0;
  const total = progress?.totalBytes ?? status?.totalBytes ?? 31_114_837;
  const percent = total > 0 ? Math.min(100, (downloaded / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={downloading ? undefined : onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><HardDrive className="size-4" />OCR 模型</DialogTitle>
          <DialogDescription>
            PP-OCRv6 small 用于本地文字检测与日文识别。模型只下载到本机，不会上传漫画图片。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">PP-OCRv6 small</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{status?.version ?? "ppocrv6-small-0.7.0"} · {formatBytes(total)}</p>
            </div>
            <Badge variant={status?.installed ? "default" : "secondary"}>
              {status?.installed ? <><CheckCircle2 />已安装</> : "未安装"}
            </Badge>
          </div>

          {(downloading || (downloaded > 0 && !status?.installed)) ? (
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
          {status?.installed ? (
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
