import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ChevronLeft, ChevronRight, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { IAnnotationType } from "@/types/annotation";
import type { IThumbnailListProps } from "@/components/thumbnail-list";
import { ResultList } from "@/components/result-list";
import { createAnnotation, isUsableAnnotation, type RelativePoint } from "./utils";

interface AnnotationBlockProps extends IThumbnailListProps {
  annotationList: IAnnotationType[];
  onAnnotationListChange: (list: IAnnotationType[]) => void;
  onOCR: (annotation: IAnnotationType) => Promise<Partial<IAnnotationType>>;
}

export function AnnotationBlock({
  currentIndex,
  imageList,
  annotationList,
  onSelected,
  onAnnotationListChange,
  onOCR,
}: AnnotationBlockProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const annotationListRef = useRef(annotationList);
  const [selected, setSelected] = useState(-1);
  const [start, setStart] = useState<RelativePoint | null>(null);
  const [draft, setDraft] = useState<IAnnotationType | null>(null);

  useEffect(() => {
    setSelected(-1);
    setDraft(null);
  }, [currentIndex]);

  useEffect(() => {
    annotationListRef.current = annotationList;
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
    if (!start) return;
    const point = pointFromEvent(event);
    setDraft((current) => current ? createAnnotation(start, point, current.id) : null);
  };

  const handlePointerUp = () => {
    if (draft && isUsableAnnotation(draft)) {
      const next = [...annotationList, draft];
      commitAnnotations(next);
      setSelected(next.length - 1);
    }
    setStart(null);
    setDraft(null);
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
              {visibleAnnotations.map((annotation, index) => (
                <button
                  key={annotation.id}
                  className={cn("absolute border-2 border-primary bg-primary/10 transition hover:bg-primary/20", selected === index && "border-amber-400 bg-amber-400/20 ring-2 ring-black/40")}
                  style={{ left: `${annotation.x * 100}%`, top: `${annotation.y * 100}%`, width: `${annotation.width * 100}%`, height: `${annotation.height * 100}%` }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setSelected(index)}
                  aria-label={`选择区域 ${index + 1}`}
                >
                  <Badge className="absolute -top-6 left-0 h-5 rounded-sm bg-amber-500 px-1.5 text-[10px] text-black">{index + 1}</Badge>
                </button>
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
        </div>
      </div>
      <aside className="min-h-0 border-l">
        <ResultList annotations={annotationList} selected={selected} onSelect={setSelected} onRemove={removeAnnotation} onUpdate={updateAnnotation} onOCRClick={(annotation, index) => void processAnnotation(annotation, index)} />
      </aside>
    </div>
  );
}
