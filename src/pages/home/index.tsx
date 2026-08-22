import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, FolderOpen, HardDrive, Info, LoaderCircle, Menu, ScanText, Sparkles } from "lucide-react";
import { ask, open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { About } from "@/components/about";
import { ThumbnailList } from "@/components/thumbnail-list";
import { AnnotationBlock } from "@/components/annotation-block";
import { OcrModelManager } from "@/components/ocr-model-manager";
import { getOcrModelStatus, recognizePage, recognizeRegion, type OcrModelStatus } from "@/features/ocr/api";
import { regionsToAnnotations } from "@/features/ocr/utils";
import { translateWithMicrosoftEdge } from "@/features/translation/providers/microsoft-edge";
import type { IAnnotationType } from "@/types/annotation";
import { isSupportedImage, naturalSort } from "./utils";

export default function Home() {
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [modelManagerOpen, setModelManagerOpen] = useState(false);
  const [modelStatus, setModelStatus] = useState<OcrModelStatus | null>(null);
  const [pageProcessing, setPageProcessing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const annotations = useRef(new Map<string, IAnnotationType[]>());
  const [currentAnnotations, setCurrentAnnotations] = useState<IAnnotationType[]>([]);

  useEffect(() => {
    void getOcrModelStatus()
      .then(setModelStatus)
      .catch((error) => toast.error("无法读取 OCR 模型状态", { description: String(error) }));
  }, []);

  const loadImages = useCallback((paths: string[]) => {
    const sorted = [...paths].sort(naturalSort);
    setImages(sorted);
    setCurrentIndex(0);
    setCurrentAnnotations(annotations.current.get(sorted[0]) ?? []);
  }, []);

  const openImages = useCallback(async () => {
    const selected = await open({ multiple: true, filters: [{ name: "图片", extensions: ["jpg", "jpeg", "png", "webp", "bmp", "gif", "avif"] }] });
    if (!selected) return;
    loadImages(Array.isArray(selected) ? selected : [selected]);
  }, [loadImages]);

  const openFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || Array.isArray(selected)) return;
    const entries = await readDir(selected);
    const paths = await Promise.all(entries.filter((entry) => entry.isFile && isSupportedImage(entry.name)).map((entry) => join(selected, entry.name)));
    if (!paths.length) {
      toast.error("这个文件夹里没有支持的图片");
      return;
    }
    loadImages(paths);
  }, [loadImages]);

  const selectImage = useCallback((index: number) => {
    if (index < 0 || index >= images.length) return;
    setCurrentIndex(index);
    setCurrentAnnotations(annotations.current.get(images[index]) ?? []);
  }, [images]);

  const updateAnnotations = useCallback((next: IAnnotationType[]) => {
    setCurrentAnnotations(next);
    annotations.current.set(images[currentIndex], next);
  }, [currentIndex, images]);

  const runOCR = useCallback(async (annotation: IAnnotationType) => {
    if (!modelStatus?.installed) {
      setModelManagerOpen(true);
      throw new Error("OCR 模型尚未安装");
    }
    const result = await recognizeRegion(images[currentIndex], annotation);
    return { ocr: result.text, confidence: result.confidence, error: false };
  }, [currentIndex, images, modelStatus?.installed]);

  const runPageOCR = useCallback(async () => {
    if (!modelStatus?.installed) {
      setModelManagerOpen(true);
      return;
    }
    const imagePath = images[currentIndex];
    if (!imagePath || pageProcessing) return;
    if (currentAnnotations.length) {
      const confirmed = await ask("整页 OCR 会替换当前页面的识别区域和人工修改，是否继续？", {
        title: "重新识别当前页面",
        kind: "warning",
      });
      if (!confirmed) return;
    }
    setPageProcessing(true);
    try {
      const regions = await recognizePage(imagePath);
      const next = regionsToAnnotations(regions);
      updateAnnotations(next);
      toast.success(`识别完成，共找到 ${next.length} 个文本区域`);
    } catch (error) {
      toast.error("整页 OCR 失败", { description: String(error) });
    } finally {
      setPageProcessing(false);
    }
  }, [currentAnnotations.length, currentIndex, images, modelStatus?.installed, pageProcessing, updateAnnotations]);

  const translateAll = useCallback(async () => {
    if (translating) return;
    const items = currentAnnotations
      .map((annotation, index) => ({ index, text: annotation.ocr?.trim() }))
      .filter((item): item is { index: number; text: string } => Boolean(item.text));
    if (!items.length) return;

    setTranslating(true);
    try {
      const translated = await translateWithMicrosoftEdge(
        items.map((item) => item.text),
        { from: "ja", to: "zh-Hans" },
      );
      const byIndex = new Map(items.map((item, resultIndex) => [item.index, translated[resultIndex]]));
      updateAnnotations(currentAnnotations.map((annotation, index) => {
        const translation = byIndex.get(index);
        return translation == null ? annotation : { ...annotation, translation };
      }));
      toast.success(`翻译完成，共 ${translated.length} 条`);
    } catch (error) {
      toast.error("Microsoft Edge 翻译失败", { description: String(error) });
    } finally {
      setTranslating(false);
    }
  }, [currentAnnotations, translating, updateAnnotations]);

  const actions = (
    <>
      <Button size="sm" onClick={() => void openImages()}><ImagePlus data-icon="inline-start" />选择图片</Button>
      <Button size="sm" variant="outline" onClick={() => void openFolder()}><FolderOpen data-icon="inline-start" />打开文件夹</Button>
      <Button size="sm" variant="ghost" onClick={() => void runPageOCR()} disabled={!images.length || pageProcessing}>
        {pageProcessing ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <ScanText data-icon="inline-start" />}
        {pageProcessing ? "识别中" : "整页 OCR"}
      </Button>
    </>
  );

  return (
    <main className="flex h-screen min-h-0 flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <div className="flex items-center gap-2 font-semibold tracking-tight"><div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="size-4" /></div><span>Raw Manga Reader</span></div>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <div className="flex flex-1 items-center gap-2">{actions}</div>
        {images.length ? <Badge variant="secondary">{images.length} 页</Badge> : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="打开菜单"><Menu /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setModelManagerOpen(true)}><HardDrive />OCR 模型</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAboutOpen(true)}><Info />关于</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {images.length ? (
        <div className="grid min-h-0 flex-1 grid-cols-[9.5rem_minmax(0,1fr)]">
          <aside className="min-h-0 border-r bg-muted/20"><ThumbnailList imageList={images} currentIndex={currentIndex} onSelected={selectImage} /></aside>
          <section className="min-h-0"><AnnotationBlock imageList={images} currentIndex={currentIndex} onSelected={selectImage} annotationList={currentAnnotations} onAnnotationListChange={updateAnnotations} onOCR={runOCR} onTranslateAll={() => void translateAll()} translating={translating} /></section>
        </div>
      ) : (
        <section className="relative grid min-h-0 flex-1 place-items-center overflow-hidden p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--color-muted)_0,transparent_65%)] opacity-70" />
          <div className="relative flex max-w-lg flex-col items-center text-center">
            <div className="mb-6 grid size-20 place-items-center rounded-3xl border bg-card shadow-sm"><ImagePlus className="size-9 text-muted-foreground" /></div>
            <Badge variant="outline" className="mb-3">Tauri 2 · React 19</Badge>
            <h1 className="text-3xl font-semibold tracking-tight">开始阅读与标注</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">选择漫画图片或整个文件夹，下载 PP-OCRv6 模型后即可整页识别；也可以在画面上拖动并单独识别文本区域。</p>
            <div className="mt-7 flex flex-wrap justify-center gap-2">{actions}</div>
          </div>
        </section>
      )}
      <About open={aboutOpen} onOpenChange={setAboutOpen} />
      <OcrModelManager open={modelManagerOpen} onOpenChange={setModelManagerOpen} status={modelStatus} onStatusChange={setModelStatus} />
    </main>
  );
}
