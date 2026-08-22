import { useCallback, useEffect, useRef, useState } from "react";
import { Clock3, Database, FileDown, FileImage, ImagePlus, FolderOpen, HardDrive, Info, Languages, LoaderCircle, Menu, ScanText, SlidersHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { About } from "@/components/about";
import { ThumbnailList } from "@/components/thumbnail-list";
import { AnnotationBlock } from "@/components/annotation-block";
import { OcrModelManager } from "@/components/ocr-model-manager";
import { OcrDebugSettings } from "@/components/ocr-debug-settings";
import { TranslationOverlaySettings } from "@/components/translation-overlay-settings";
import { TranslationProviderSettings } from "@/components/translation-provider-settings";
import { CacheManager } from "@/components/cache-manager";
import { getOcrModelStatus, listImageFiles, recognizePage, recognizeRegion, registerImages, releaseImages, scheduleImagePreload, type OcrModelKind, type OcrModelStatus, type OcrRegion, type PrefetchedOcr, type RegisteredImage, type VerticalMergeOptions } from "@/features/ocr/api";
import { regionsToAnnotations } from "@/features/ocr/utils";
import { translateWithMicrosoftEdge } from "@/features/translation/providers/microsoft-edge";
import { compareOpenRouterModels, translateWithOpenRouter } from "@/features/translation/providers/openrouter";
import { parseComparisonModels, type TranslationSettings } from "@/features/translation/settings";
import type { TranslationOverlayOptions } from "@/features/translation/overlay";
import { DEFAULT_APP_PREFERENCES, formatAppError } from "@/features/preferences";
import { addRecentSources, sourceName, type RecentSource } from "@/features/recent-sources";
import { initializeFrontendStorage, persistPreferences, persistRecentSources } from "@/features/storage/database";
import { configureHttpProxy, configureNativeHttpProxy } from "@/features/http/proxy";
import { renderTranslatedPng, writeExportedImage } from "@/features/export/render";
import type { IAnnotationType } from "@/types/annotation";
import { naturalSort, prioritizeImageIds } from "./utils";

export default function Home() {
  const location = useLocation();
  const navigate = useNavigate();
  const activePanel = location.pathname.startsWith("/settings/") ? location.pathname.slice("/settings/".length) : null;
  const openPanel = useCallback((panel: string) => navigate(`/settings/${panel}`), [navigate]);
  const closePanel = useCallback((open: boolean) => { if (!open) navigate("/"); }, [navigate]);
  const [images, setImages] = useState<RegisteredImage[]>([]);
  const [recentSources, setRecentSources] = useState<RecentSource[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [modelStatus, setModelStatus] = useState<OcrModelStatus | null>(null);
  const [ocrModelKind, setOcrModelKind] = useState<OcrModelKind>(DEFAULT_APP_PREFERENCES.ocrModelKind);
  const [pageProcessing, setPageProcessing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [mergeOptions, setMergeOptions] = useState<VerticalMergeOptions>({ ...DEFAULT_APP_PREFERENCES.mergeOptions });
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(DEFAULT_APP_PREFERENCES.showBoundingBoxes);
  const [showRawBoundingBoxes, setShowRawBoundingBoxes] = useState(DEFAULT_APP_PREFERENCES.showRawBoundingBoxes);
  const [translationOverlayOptions, setTranslationOverlayOptions] = useState<TranslationOverlayOptions>({ ...DEFAULT_APP_PREFERENCES.translationOverlayOptions });
  const [translationSettings, setTranslationSettings] = useState<TranslationSettings>({ ...DEFAULT_APP_PREFERENCES.translationSettings, openRouterApiKey: import.meta.env.DEV ? (import.meta.env.VITE_OPENROUTER_API_KEY ?? "") : "" });
  const annotations = useRef(new Map<string, IAnnotationType[]>());
  const rawRegions = useRef(new Map<string, OcrRegion[]>());
  const imagesRef = useRef<RegisteredImage[]>([]);
  const currentIndexRef = useRef(0);
  const preloadRequestRef = useRef("");
  const [currentAnnotations, setCurrentAnnotations] = useState<IAnnotationType[]>([]);
  const [currentRawRegions, setCurrentRawRegions] = useState<OcrRegion[]>([]);
  const modelInstalled = modelStatus?.kind === ocrModelKind && modelStatus.installed;

  useEffect(() => {
    setModelStatus(null);
    void getOcrModelStatus(ocrModelKind)
      .then(setModelStatus)
      .catch((error) => toast.error("无法读取 OCR 模型状态", { description: formatAppError(error) }));
  }, [ocrModelKind]);

  useEffect(() => {
    const settings = { proxyEnabled: translationSettings.proxyEnabled, proxyUrl: translationSettings.proxyUrl, proxyNoProxy: translationSettings.proxyNoProxy };
    configureHttpProxy(settings);
    const timer = window.setTimeout(() => { void configureNativeHttpProxy(settings).catch((error) => toast.error("无法应用 HTTP 代理", { description: formatAppError(error) })); }, 250);
    return () => window.clearTimeout(timer);
  }, [translationSettings.proxyEnabled, translationSettings.proxyNoProxy, translationSettings.proxyUrl]);

  useEffect(() => {
    void initializeFrontendStorage()
      .then(({ preferences, recentSources: storedSources }) => {
        setMergeOptions(preferences.mergeOptions);
        setOcrModelKind(preferences.ocrModelKind);
        setShowBoundingBoxes(preferences.showBoundingBoxes);
        setShowRawBoundingBoxes(preferences.showRawBoundingBoxes);
        setTranslationOverlayOptions(preferences.translationOverlayOptions);
        setTranslationSettings((current) => ({ ...preferences.translationSettings, openRouterApiKey: current.openRouterApiKey }));
        setRecentSources(storedSources);
      })
      .catch((error) => toast.error("无法读取前端数据库", { description: formatAppError(error) }))
      .finally(() => setStorageReady(true));
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const timer = window.setTimeout(() => {
      void persistPreferences({ ocrModelKind, mergeOptions, showBoundingBoxes, showRawBoundingBoxes, translationOverlayOptions, translationSettings: { provider: translationSettings.provider, openRouterModel: translationSettings.openRouterModel, comparisonModels: translationSettings.comparisonModels, proxyEnabled: translationSettings.proxyEnabled, proxyUrl: translationSettings.proxyUrl, proxyNoProxy: translationSettings.proxyNoProxy } })
        .catch((error) => toast.error("无法保存前端设置", { description: formatAppError(error) }));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [mergeOptions, ocrModelKind, showBoundingBoxes, showRawBoundingBoxes, storageReady, translationOverlayOptions, translationSettings.comparisonModels, translationSettings.openRouterModel, translationSettings.provider, translationSettings.proxyEnabled, translationSettings.proxyNoProxy, translationSettings.proxyUrl]);

  useEffect(() => () => {
    void releaseImages(imagesRef.current.map((image) => image.id));
  }, []);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<PrefetchedOcr>("ocr-prefetched", ({ payload }) => {
      if (disposed || payload.requestId !== preloadRequestRef.current || annotations.current.has(payload.imageId)) return;
      const next = regionsToAnnotations(payload.regions);
      annotations.current.set(payload.imageId, next);
      rawRegions.current.set(payload.imageId, payload.rawRegions);
      if (imagesRef.current[currentIndexRef.current]?.id === payload.imageId) {
        setCurrentAnnotations(next);
        setCurrentRawRegions(payload.rawRegions);
      }
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!images.length) return;
    const requestId = crypto.randomUUID();
    preloadRequestRef.current = requestId;
    void scheduleImagePreload({
      requestId,
      imageIds: prioritizeImageIds(images.map((image) => image.id), currentIndex),
      mergeOptions,
      recognize: Boolean(modelInstalled),
      modelKind: ocrModelKind,
    }).catch((error) => toast.error("无法调度图片预识别", { description: formatAppError(error) }));
  }, [currentIndex, images, mergeOptions, modelInstalled, ocrModelKind]);

  const loadImages = useCallback(async (paths: string[]) => {
    const sorted = [...paths].sort(naturalSort);
    const registered = await registerImages(sorted);
    const previous = imagesRef.current;
    imagesRef.current = registered;
    annotations.current.clear();
    rawRegions.current.clear();
    setImages(registered);
    setCurrentIndex(0);
    setCurrentAnnotations(annotations.current.get(registered[0]?.id) ?? []);
    setCurrentRawRegions([]);
    if (previous.length) {
      await releaseImages(previous.map((image) => image.id));
    }
  }, []);

  const updateRecentSources = useCallback((update: (current: RecentSource[]) => RecentSource[]) => {
    setRecentSources((current) => {
      const next = update(current);
      void persistRecentSources(next).catch((error) => toast.error("无法保存历史记录", { description: formatAppError(error) }));
      return next;
    });
  }, []);

  const recordRecentSources = useCallback((sources: Array<Pick<RecentSource, "kind" | "path">>) => {
    updateRecentSources((current) => addRecentSources(current, sources));
  }, [updateRecentSources]);

  const imagePathsInFolder = useCallback(async (folder: string) => {
    return listImageFiles(folder);
  }, []);

  const openImages = useCallback(async () => {
    const selected = await open({ multiple: true, filters: [{ name: "图片", extensions: ["jpg", "jpeg", "png", "webp", "bmp", "gif", "avif"] }] });
    if (!selected) return;
    try {
      const paths = Array.isArray(selected) ? selected : [selected];
      await loadImages(paths);
      recordRecentSources(paths.map((path) => ({ kind: "file", path })));
    } catch (error) {
      toast.error("无法注册图片资源", { description: formatAppError(error) });
    }
  }, [loadImages, recordRecentSources]);

  const openFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || Array.isArray(selected)) return;
    const paths = await imagePathsInFolder(selected);
    if (!paths.length) {
      toast.error("这个文件夹里没有支持的图片");
      return;
    }
    try {
      await loadImages(paths);
      recordRecentSources([{ kind: "folder", path: selected }]);
    } catch (error) {
      toast.error("无法注册图片资源", { description: formatAppError(error) });
    }
  }, [imagePathsInFolder, loadImages, recordRecentSources]);

  const openRecentSource = useCallback(async (source: RecentSource) => {
    try {
      const paths = source.kind === "folder" ? await imagePathsInFolder(source.path) : [source.path];
      if (!paths.length) throw new Error("文件夹中没有支持的图片");
      await loadImages(paths);
      recordRecentSources([{ kind: source.kind, path: source.path }]);
    } catch (error) {
      toast.error("无法打开历史项目", { description: formatAppError(error) });
    }
  }, [imagePathsInFolder, loadImages, recordRecentSources]);

  const removeRecentSource = useCallback((source: RecentSource) => {
    updateRecentSources((current) => current.filter((item) => item.kind !== source.kind || item.path !== source.path));
  }, [updateRecentSources]);

  const selectImage = useCallback((index: number) => {
    if (index < 0 || index >= images.length) return;
    setCurrentIndex(index);
    setCurrentAnnotations(annotations.current.get(images[index].id) ?? []);
    setCurrentRawRegions(rawRegions.current.get(images[index].id) ?? []);
  }, [images]);

  const updateAnnotations = useCallback((next: IAnnotationType[]) => {
    setCurrentAnnotations(next);
    annotations.current.set(images[currentIndex].id, next);
  }, [currentIndex, images]);

  const runOCR = useCallback(async (annotation: IAnnotationType) => {
    if (!modelInstalled) {
      openPanel("ocr-model");
      throw new Error("OCR 模型尚未安装");
    }
    const result = await recognizeRegion(images[currentIndex].id, annotation, ocrModelKind);
    return { ocr: result.text, confidence: result.confidence, error: false };
  }, [currentIndex, images, modelInstalled, ocrModelKind]);

  const runPageOCR = useCallback(async () => {
    if (!modelInstalled) {
      openPanel("ocr-model");
      return;
    }
    const image = images[currentIndex];
    if (!image || pageProcessing) return;
    if (currentAnnotations.length) {
      const confirmed = await ask("整页 OCR 会替换当前页面的识别区域和人工修改，是否继续？", {
        title: "重新识别当前页面",
        kind: "warning",
      });
      if (!confirmed) return;
    }
    setPageProcessing(true);
    try {
      const result = await recognizePage(image.id, mergeOptions, ocrModelKind);
      const next = regionsToAnnotations(result.regions);
      rawRegions.current.set(image.id, result.rawRegions);
      setCurrentRawRegions(result.rawRegions);
      updateAnnotations(next);
      toast.success(`识别完成，共找到 ${next.length} 个文本区域`);
    } catch (error) {
      toast.error("整页 OCR 失败", { description: formatAppError(error) });
    } finally {
      setPageProcessing(false);
    }
  }, [currentAnnotations.length, currentIndex, images, mergeOptions, modelInstalled, ocrModelKind, openPanel, pageProcessing, updateAnnotations]);

  const translateAll = useCallback(async () => {
    if (translating) return;
    const items = currentAnnotations
      .map((annotation, index) => ({ index, text: annotation.ocr?.trim() }))
      .filter((item): item is { index: number; text: string } => Boolean(item.text));
    if (!items.length) return;

    setTranslating(true);
    try {
      const texts = items.map((item) => item.text);
      const translated = translationSettings.provider === "openrouter"
        ? await translateWithOpenRouter(texts, { apiKey: translationSettings.openRouterApiKey, model: translationSettings.openRouterModel })
        : await translateWithMicrosoftEdge(texts, { from: "ja", to: "zh-Hans" });
      const byIndex = new Map(items.map((item, resultIndex) => [item.index, translated[resultIndex]]));
      updateAnnotations(currentAnnotations.map((annotation, index) => {
        const translation = byIndex.get(index);
        return translation == null ? annotation : { ...annotation, translation };
      }));
      toast.success(`翻译完成，共 ${translated.length} 条`);
    } catch (error) {
      toast.error("翻译失败", { description: formatAppError(error) });
    } finally {
      setTranslating(false);
    }
  }, [currentAnnotations, translating, translationSettings, updateAnnotations]);

  const compareTranslationModels = useCallback(async () => {
    const texts = currentAnnotations.map((annotation) => annotation.ocr?.trim()).filter((text): text is string => Boolean(text));
    const results = await compareOpenRouterModels(texts, parseComparisonModels(translationSettings.comparisonModels), { apiKey: translationSettings.openRouterApiKey });
    const successes = results.filter((result) => result.translations).length;
    toast.success(`模型对比完成，${successes}/${results.length} 个成功`);
    return results;
  }, [currentAnnotations, translationSettings]);

  const exportCurrentPage = useCallback(async () => {
    const image = images[currentIndex];
    if (!image || !currentAnnotations.some((item) => item.translation?.trim())) return;
    try {
      const baseName = image.path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || `page-${currentIndex + 1}`;
      const outputPath = await save({ defaultPath: `${baseName}-translated.png`, filters: [{ name: "PNG 图片", extensions: ["png"] }] });
      if (!outputPath) return;
      const bytes = await renderTranslatedPng(image.path, currentAnnotations, translationOverlayOptions);
      await writeExportedImage(outputPath, bytes);
      toast.success("嵌字图片已导出", { description: outputPath });
    } catch (error) {
      toast.error("导出失败", { description: formatAppError(error) });
    }
  }, [currentAnnotations, currentIndex, images, translationOverlayOptions]);

  const actions = (
    <>
      <Button size="sm" onClick={() => void openImages()}><ImagePlus data-icon="inline-start" />选择图片</Button>
      <Button size="sm" variant="outline" onClick={() => void openFolder()}><FolderOpen data-icon="inline-start" />打开文件夹</Button>
      <Button size="sm" variant="ghost" onClick={() => void runPageOCR()} disabled={!images.length || pageProcessing}>
        {pageProcessing ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <ScanText data-icon="inline-start" />}
        {pageProcessing ? "识别中" : "整页 OCR"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => void exportCurrentPage()} disabled={!currentAnnotations.some((item) => item.translation?.trim())}><FileDown data-icon="inline-start" />导出嵌字</Button>
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
            <DropdownMenuItem onClick={() => openPanel("ocr-model")}><HardDrive />OCR 模型</DropdownMenuItem>
            <DropdownMenuItem onClick={() => openPanel("ocr-merge")}><SlidersHorizontal />OCR 合并调试</DropdownMenuItem>
            <DropdownMenuItem onClick={() => openPanel("typesetting")}><Languages />译文回填</DropdownMenuItem>
            <DropdownMenuItem onClick={() => openPanel("translation")}><Sparkles />翻译服务</DropdownMenuItem>
            <DropdownMenuItem onClick={() => openPanel("cache")}><Database />缓存</DropdownMenuItem>
            <DropdownMenuItem onClick={() => openPanel("about")}><Info />关于</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {images.length ? (
        <div className="grid min-h-0 flex-1 grid-cols-[9.5rem_minmax(0,1fr)]">
          <aside className="min-h-0 border-r bg-muted/20"><ThumbnailList imageList={images.map((image) => image.path)} currentIndex={currentIndex} onSelected={selectImage} /></aside>
          <section className="min-h-0"><AnnotationBlock imageList={images.map((image) => image.path)} currentIndex={currentIndex} onSelected={selectImage} annotationList={currentAnnotations} rawRegions={currentRawRegions} onAnnotationListChange={updateAnnotations} onOCR={runOCR} onTranslateAll={() => void translateAll()} translating={translating} showBoundingBoxes={showBoundingBoxes} showRawBoundingBoxes={showRawBoundingBoxes} translationOverlayOptions={translationOverlayOptions} onTranslationOverlayVisibilityChange={(visible) => setTranslationOverlayOptions((current) => ({ ...current, visible }))} /></section>
        </div>
      ) : (
        <section className="relative min-h-0 flex-1 overflow-y-auto p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--color-muted)_0,transparent_65%)] opacity-70" />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
            <div className="mb-6 grid size-20 place-items-center rounded-3xl border bg-card shadow-sm"><ImagePlus className="size-9 text-muted-foreground" /></div>
            <Badge variant="outline" className="mb-3">Tauri 2 · React 19</Badge>
            <h1 className="text-3xl font-semibold tracking-tight">开始阅读与标注</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">选择漫画图片或整个文件夹，下载 PP-OCRv6 模型后即可整页识别；也可以在画面上拖动并单独识别文本区域。</p>
            <div className="mt-7 flex flex-wrap justify-center gap-2">{actions}</div>
            {recentSources.length ? <div className="mt-10 w-full text-left">
              <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-medium"><Clock3 className="size-4 text-muted-foreground" />最近打开</h2><Button variant="ghost" size="xs" onClick={() => updateRecentSources(() => [])}><Trash2 />清空历史</Button></div>
              <div className="grid gap-2 sm:grid-cols-2">
                {recentSources.map((source) => <div key={`${source.kind}:${source.path}`} className="group flex min-w-0 items-center rounded-lg border bg-card/80 shadow-sm transition hover:border-primary/40 hover:bg-card">
                  <button className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left" onClick={() => void openRecentSource(source)} title={source.path}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted">{source.kind === "folder" ? <FolderOpen className="size-4" /> : <FileImage className="size-4" />}</span>
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{sourceName(source.path)}</span><span className="block truncate text-xs text-muted-foreground">{source.path}</span></span>
                  </button>
                  <Button className="mr-2 opacity-0 transition group-hover:opacity-100 focus:opacity-100" variant="ghost" size="icon-xs" aria-label={`移除 ${sourceName(source.path)}`} onClick={() => removeRecentSource(source)}><X /></Button>
                </div>)}
              </div>
            </div> : null}
          </div>
        </section>
      )}
      <About open={activePanel === "about"} onOpenChange={closePanel} />
      <OcrModelManager open={activePanel === "ocr-model"} onOpenChange={closePanel} status={modelStatus} onStatusChange={setModelStatus} kind={ocrModelKind} onKindChange={setOcrModelKind} />
      <OcrDebugSettings
        open={activePanel === "ocr-merge"}
        onOpenChange={closePanel}
        options={mergeOptions}
        onOptionsChange={setMergeOptions}
        showBoundingBoxes={showBoundingBoxes}
        onShowBoundingBoxesChange={setShowBoundingBoxes}
        showRawBoundingBoxes={showRawBoundingBoxes}
        onShowRawBoundingBoxesChange={setShowRawBoundingBoxes}
        onPreview={runPageOCR}
        canPreview={Boolean(images.length && modelInstalled && !pageProcessing)}
        onReset={() => {
          setMergeOptions({ ...DEFAULT_APP_PREFERENCES.mergeOptions });
          setShowBoundingBoxes(DEFAULT_APP_PREFERENCES.showBoundingBoxes);
          setShowRawBoundingBoxes(DEFAULT_APP_PREFERENCES.showRawBoundingBoxes);
        }}
      />
      <TranslationOverlaySettings
        open={activePanel === "typesetting"}
        onOpenChange={closePanel}
        options={translationOverlayOptions}
        onOptionsChange={setTranslationOverlayOptions}
        onReset={() => setTranslationOverlayOptions({ ...DEFAULT_APP_PREFERENCES.translationOverlayOptions })}
      />
      <TranslationProviderSettings open={activePanel === "translation"} onOpenChange={closePanel} settings={translationSettings} onSettingsChange={setTranslationSettings} onCompare={compareTranslationModels} canCompare={currentAnnotations.some((annotation) => Boolean(annotation.ocr?.trim()))} />
      <CacheManager open={activePanel === "cache"} onOpenChange={closePanel} />
    </main>
  );
}
