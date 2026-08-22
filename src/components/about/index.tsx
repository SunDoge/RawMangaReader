import { getName, getVersion } from "@tauri-apps/api/app";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AboutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function About({ open, onOpenChange }: AboutProps) {
  const [appName, setAppName] = useState("Raw Manga Reader");
  const [appVersion, setAppVersion] = useState("—");

  useEffect(() => {
    void getName().then(setAppName).catch(() => undefined);
    void getVersion().then(setAppVersion).catch(() => undefined);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{appName}</DialogTitle>
          <DialogDescription>专注于生肉漫画阅读与文本标注。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between rounded-lg bg-muted px-3 py-2">
            <span className="text-muted-foreground">版本</span>
            <span className="font-mono">{appVersion}</span>
          </div>
          <a className="flex items-center gap-2 text-primary hover:underline" href="https://github.com/SunDoge/RawMangaReader/issues" target="_blank" rel="noreferrer">
            问题反馈 <ExternalLink className="size-3.5" />
          </a>
          <p className="text-xs leading-5 text-muted-foreground">本地 OCR 由 OAR-OCR 与 PaddleOCR PP-OCRv6 提供，模型按 Apache-2.0 许可发布。</p>
          <p className="text-xs text-muted-foreground">Copyright © 2023–2026 SunDoge</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
