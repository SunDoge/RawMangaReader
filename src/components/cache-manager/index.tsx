import { useEffect, useState } from "react";
import { Database, Image, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clearImageCache, getImageCacheStats, type ImageCacheKind, type ImageCacheStats } from "@/features/ocr/api";

interface CacheManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
};

export function CacheManager({ open, onOpenChange }: CacheManagerProps) {
  const [stats, setStats] = useState<ImageCacheStats | null>(null);
  const [clearing, setClearing] = useState<ImageCacheKind | null>(null);

  useEffect(() => {
    if (!open) return;
    void getImageCacheStats()
      .then(setStats)
      .catch((error) => toast.error("无法读取缓存状态", { description: String(error) }));
  }, [open]);

  const clear = async (kind: ImageCacheKind) => {
    setClearing(kind);
    try {
      setStats(await clearImageCache(kind));
      toast.success("缓存已清理");
    } catch (error) {
      toast.error("清理缓存失败", { description: String(error) });
    } finally {
      setClearing(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>图片与 OCR 缓存</DialogTitle>
          <DialogDescription>清理缓存不会关闭当前图片，后续访问时会重新解码或识别。</DialogDescription>
        </DialogHeader>
        {stats ? (
          <div className="grid gap-3">
            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Image className="size-4" />解码图片</div>
              <div className="text-xs leading-5 text-muted-foreground">{stats.decodedEntries} 项 · {formatBytes(stats.decodedBytes)} / {formatBytes(stats.decodedCapacityBytes)}</div>
              <Button className="mt-2" size="xs" variant="outline" disabled={clearing != null} onClick={() => void clear("decoded")}>
                {clearing === "decoded" ? <LoaderCircle className="animate-spin" /> : <Trash2 />}清理解码缓存
              </Button>
            </div>
            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Database className="size-4" />OCR HybridCache</div>
              <div className="text-xs leading-5 text-muted-foreground">
                内存 {stats.ocrMemoryEntries} 项 · {formatBytes(stats.ocrMemoryBytes)} / {formatBytes(stats.ocrMemoryCapacityBytes)}<br />
                磁盘容量 {formatBytes(stats.ocrDiskCapacityBytes)} · 本次读 {formatBytes(stats.ocrDiskReadBytes)} · 写 {formatBytes(stats.ocrDiskWriteBytes)}
              </div>
              <Button className="mt-2" size="xs" variant="outline" disabled={clearing != null} onClick={() => void clear("ocr")}>
                {clearing === "ocr" ? <LoaderCircle className="animate-spin" /> : <Trash2 />}清理 OCR 缓存
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">当前活跃图片句柄：{stats.activeImages}</div>
          </div>
        ) : <div className="grid place-items-center py-10"><LoaderCircle className="animate-spin text-muted-foreground" /></div>}
        <DialogFooter>
          <Button variant="destructive" disabled={clearing != null} onClick={() => void clear("all")}>清理全部缓存</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
