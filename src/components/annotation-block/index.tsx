import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ChevronLeft, ChevronRight, Eye, EyeOff, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { IAnnotationType } from "@/types/annotation";
import type { OcrRegion } from "@/features/ocr/api";
import type { IThumbnailListProps } from "@/components/thumbnail-list";
import { ResultList } from "@/components/result-list";
import { FittedTranslation } from "@/components/fitted-translation";
import { DEFAULT_TRANSLATION_OVERLAY_OPTIONS, type TranslationOverlayOptions } from "@/features/translation/overlay";
import { createAnnotation, isUsableAnnotation, mergeAnnotations, transformAnnotation, type AnnotationTransform, type RelativePoint } from "./utils";

interface AnnotationBlockProps extends IThumbnailListProps {
  annotationList: IAnnotationType[];
  rawRegions?: OcrRegion[];
  onAnnotationListChange: (list: IAnnotationType[]) => void;
  onOCR: (annotation: IAnnotationType) => Promise<Partial<IAnnotationType>>;
  onTranslateAll?: () => void;
  translating?: boolean;
  showBoundingBoxes?: boolean;
  showRawBoundingBoxes?: boolean;
  translationOverlayOptions?: TranslationOverlayOptions;
  onTranslationOverlayVisibilityChange?: (visible: boolean) => void;
}

export function AnnotationBlock({
  currentIndex,
  imageList,
  annotationList,
  rawRegions = [],
  onSelected,
  onAnnotationListChange,
  onOCR,
  onTranslateAll,
  translating,
  showBoundingBoxes = true,
  showRawBoundingBoxes = false,
  translationOverlayOptions = DEFAULT_TRANSLATION_OVERLAY_OPTIONS,
  onTranslationOverlayVisibilityChange,
}: AnnotationBlockProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const annotationListRef = useRef(annotationList);
  const [selected, setSelected] = useState(-1);
  const [start, setStart] = useState<RelativePoint | null>(null);
  const [draft, setDraft] = useState<IAnnotationType | null>(null);
  const [mergeSelection, setMergeSelection] = useState<Set<string>>(() => new Set());
  const transformRef = useRef<{ index: number; transform: AnnotationTransform; start: RelativePoint; annotation: IAnnotationType } | null>(null);

  useEffect(() => {
    setSelected(-1);
    setDraft(null);
    setMergeSelection(new Set());
  }, [currentIndex]);

  useEffect(() => {
    annotationListRef.current = annotationList;
    const ids = new Set(annotationList.map((item) => item.id));
    setMergeSelection((current) => {
      const next = new Set([...current].filter((id) => ids.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [annotationList]);

  const commitAnnotations = useCallback((next: IAnnotationType[]) => {
    annotationListRef.current = next;
    onAnnotationListChange(next);
  }, [onAnnotationListChange]);

  const pointFromEvent = (event: React.PointerEvent): RelativePoint => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    setStart(point);
    setDraft(createAnnotation(point, point, crypto.randomUUID()));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const activeTransform = transformRef.current;
    if (activeTransform) {
      const next = { ...transformAnnotation(activeTransform.annotation, activeTransform.start, pointFromEvent(event), activeTransform.transform), status: "unprocessed" as const, confidence: undefined, error: false };
      commitAnnotations(annotationListRef.current.map((item, index) => index === activeTransform.index ? next : item));
      return;
    }
    if (!start) return;
    const point = pointFromEvent(event);
    setDraft((current) => current ? createAnnotation(start, point, current.id) : null);
  };

  const handlePointerUp = () => {
    if (transformRef.current) {
      transformRef.current = null;
      return;
    }
    if (draft && isUsableAnnotation(draft)) {
      const next = [...annotationList, draft];
      commitAnnotations(next);
      setSelected(next.length - 1);
    }
    setStart(null);
    setDraft(null);
  };

  const beginTransform = (event: React.PointerEvent, annotation: IAnnotationType, index: number, transform: AnnotationTransform) => {
    event.preventDefault();
    event.stopPropagation();
    overlayRef.current?.setPointerCapture(event.pointerId);
    setSelected(index);
    transformRef.current = { index, transform, start: pointFromEvent(event), annotation };
  };

  const removeAnnotation = useCallback((index: number, length = 1) => {
    const next = annotationListRef.current.filter((_, itemIndex) => itemIndex < index || itemIndex >= index + length);
    commitAnnotations(next);
    setSelected(-1);
  }, [commitAnnotations]);

  const updateAnnotation = useCallback((index: number, patch: Partial<IAnnotationType>) => {
    commitAnnotations(annotationListRef.current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }, [commitAnnotations]);

  const processAnnotation = useCallback(async (annotation: IAnnotationType, index: number) => {
    const processing = annotationListRef.current.map((item, itemIndex) => itemIndex === index ? { ...item, status: "processing" as const, error: false } : item);
    commitAnnotations(processing);
    try {
      const result = await onOCR(annotation);
      updateAnnotation(index, { ...result, status: "finished", error: false });
    } catch {
      updateAnnotation(index, { status: "unprocessed", error: true });
    }
  }, [commitAnnotations, onOCR, updateAnnotation]);

  const visibleAnnotations = draft ? [...annotationList, draft] : annotationList;

  const mergeSelected = useCallback(() => {
    const selectedAnnotations = annotationListRef.current.filter((item) => mergeSelection.has(item.id));
    const merged = mergeAnnotations(selectedAnnotations);
    if (!merged) return;
    const firstIndex = annotationListRef.current.findIndex((item) => mergeSelection.has(item.id));
    const next = annotationListRef.current.filter((item) => !mergeSelection.has(item.id));
    next.splice(firstIndex, 0, merged);
    commitAnnotations(next);
    setSelected(firstIndex);
    setMergeSelection(new Set());
  }, [commitAnnotations, mergeSelection]);

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-h-0 flex-col bg-muted/20">
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-5">
          <div className="relative inline-flex max-h-full max-w-full overflow-hidden rounded-md bg-black shadow-2xl">
            <img className="block max-h-[calc(100vh-9rem)] max-w-full select-none object-contain" src={convertFileSrc(imageList[currentIndex])} alt={`第 ${currentIndex + 1} 页`} draggable={false} />
            <div
              ref={overlayRef}
              className="absolute inset-0 cursor-crosshair touch-none select-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {showRawBoundingBoxes ? rawRegions.map((region, index) => <div key={`raw-${index}`} className="pointer-events-none absolute border border-dashed border-cyan-400/90 bg-cyan-400/5" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }}><span className="absolute -top-4 left-0 bg-cyan-500/90 px-1 font-mono text-[8px] leading-4 text-black">R{index + 1}</span></div>) : null}
              {visibleAnnotations.map((annotation, index) => (
                <div
                  key={annotation.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "absolute flex items-center justify-center p-0.5 transition",
                    (showBoundingBoxes || annotation.id === draft?.id) && "border-2 border-primary bg-primary/10 hover:bg-primary/20",
                    showBoundingBoxes && selected === index && "border-amber-400 ring-2 ring-black/40",
                    mergeSelection.has(annotation.id) && "border-cyan-400 ring-2 ring-cyan-400/80",
                  )}
                  style={{
                    left: `${annotation.x * 100}%`,
                    top: `${annotation.y * 100}%`,
                    width: `${annotation.width * 100}%`,
                    height: `${annotation.height * 100}%`,
                    backgroundColor: annotation.translation && translationOverlayOptions.visible
                      ? `rgb(255 255 255 / ${translationOverlayOptions.backgroundOpacity})`
                      : undefined,
                    borderRadius: annotation.translation && translationOverlayOptions.visible ? "8%" : undefined,
                  }}
                  onPointerDown={(event) => beginTransform(event, annotation, index, "move")}
                  onClick={(event) => {
                    if (event.shiftKey || event.ctrlKey || event.metaKey) {
                      setMergeSelection((current) => {
                        const next = new Set(current);
                        if (next.has(annotation.id)) next.delete(annotation.id); else next.add(annotation.id);
                        return next;
                      });
                    } else {
                      setSelected(index);
                    }
                  }}
                  aria-label={`选择区域 ${index + 1}`}
                >
                  {showBoundingBoxes ? <Badge className="absolute -top-6 left-0 h-5 rounded-sm bg-amber-500 px-1.5 text-[10px] text-black">{index + 1}</Badge> : null}
                  {showBoundingBoxes && selected === index ? (["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const).map((handle) => <span key={handle} className={cn("absolute z-20 size-2.5 rounded-full border border-black bg-amber-300", handle === "nw" && "-left-1.5 -top-1.5 cursor-nwse-resize", handle === "n" && "-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize", handle === "ne" && "-right-1.5 -top-1.5 cursor-nesw-resize", handle === "e" && "-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize", handle === "se" && "-bottom-1.5 -right-1.5 cursor-nwse-resize", handle === "s" && "-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize", handle === "sw" && "-bottom-1.5 -left-1.5 cursor-nesw-resize", handle === "w" && "-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize")} onPointerDown={(event) => beginTransform(event, annotation, index, handle)} />) : null}
                  {annotation.translation && translationOverlayOptions.visible ? <FittedTranslation text={annotation.translation} options={translationOverlayOptions} /> : null}
                </div>
              ))}
            </div>
          </div>
          {!annotationList.length && !draft ? (
            <div className="pointer-events-none absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
              <MousePointer2 className="size-3.5" /> 在图片上拖动创建文本区域
            </div>
          ) : null}
        </div>
        <div className="flex h-11 shrink-0 items-center justify-center gap-3 border-t bg-background px-3">
          <Button variant="ghost" size="icon-sm" onClick={() => onSelected(currentIndex - 1)} disabled={currentIndex === 0}><ChevronLeft /></Button>
          <span className="min-w-24 text-center text-xs text-muted-foreground"><strong className="text-foreground">{currentIndex + 1}</strong> / {imageList.length}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => onSelected(currentIndex + 1)} disabled={currentIndex === imageList.length - 1}><ChevronRight /></Button>
          {onTranslationOverlayVisibilityChange ? (
            <Button
              variant={translationOverlayOptions.visible ? "secondary" : "ghost"}
              size="sm"
              className="ml-2 gap-1.5"
              onClick={() => onTranslationOverlayVisibilityChange(!translationOverlayOptions.visible)}
              aria-pressed={translationOverlayOptions.visible}
              title={translationOverlayOptions.visible ? "隐藏图片上的译文" : "显示图片上的译文"}
            >
              {translationOverlayOptions.visible ? <Eye /> : <EyeOff />}
              {translationOverlayOptions.visible ? "隐藏译文" : "显示译文"}
            </Button>
          ) : null}
        </div>
      </div>
      <aside className="min-h-0 border-l">
        <ResultList annotations={annotationList} selected={selected} onSelect={setSelected} onRemove={removeAnnotation} onUpdate={updateAnnotation} onOCRClick={(annotation, index) => void processAnnotation(annotation, index)} onTranslateAll={onTranslateAll} translating={translating} mergeSelection={mergeSelection} onMergeSelectionChange={(id, checked) => setMergeSelection((current) => { const next = new Set(current); if (checked) next.add(id); else next.delete(id); return next; })} onMergeSelected={mergeSelected} />
      </aside>
    </div>
  );
}
