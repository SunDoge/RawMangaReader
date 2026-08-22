import type { IAnnotationType } from "@/types/annotation";

export type RelativePoint = { x: number; y: number };
export type AnnotationTransform = "move" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function createAnnotation(start: RelativePoint, end: RelativePoint, id: string): IAnnotationType {
  const startX = clamp(start.x);
  const startY = clamp(start.y);
  const endX = clamp(end.x);
  const endY = clamp(end.y);

  return {
    id,
    unit: "%",
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
    status: "unprocessed",
  };
}

export function isUsableAnnotation(annotation: IAnnotationType, minimumSize = 0.01) {
  return annotation.width > minimumSize && annotation.height > minimumSize;
}

export function transformAnnotation(annotation: IAnnotationType, start: RelativePoint, current: RelativePoint, transform: AnnotationTransform, minimumSize = 0.005): IAnnotationType {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  if (transform === "move") {
    return { ...annotation, x: Math.min(1 - annotation.width, Math.max(0, annotation.x + dx)), y: Math.min(1 - annotation.height, Math.max(0, annotation.y + dy)), polygon: undefined };
  }
  let left = annotation.x;
  let top = annotation.y;
  let right = annotation.x + annotation.width;
  let bottom = annotation.y + annotation.height;
  if (transform.includes("w")) left = Math.min(right - minimumSize, Math.max(0, left + dx));
  if (transform.includes("e")) right = Math.max(left + minimumSize, Math.min(1, right + dx));
  if (transform.includes("n")) top = Math.min(bottom - minimumSize, Math.max(0, top + dy));
  if (transform.includes("s")) bottom = Math.max(top + minimumSize, Math.min(1, bottom + dy));
  return { ...annotation, x: left, y: top, width: right - left, height: bottom - top, polygon: undefined };
}

export function mergeAnnotations(annotations: IAnnotationType[]): IAnnotationType | null {
  if (annotations.length < 2) return null;
  const left = Math.min(...annotations.map((item) => item.x));
  const top = Math.min(...annotations.map((item) => item.y));
  const right = Math.max(...annotations.map((item) => item.x + item.width));
  const bottom = Math.max(...annotations.map((item) => item.y + item.height));
  const texts = annotations.map((item) => item.ocr?.trim()).filter((text): text is string => Boolean(text));
  const translations = annotations.map((item) => item.translation?.trim()).filter((text): text is string => Boolean(text));
  const vertical = bottom - top > (right - left) * 1.35;

  return {
    ...annotations[0],
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    polygon: undefined,
    ocr: texts.join(vertical ? "" : "\n"),
    translation: translations.length === 1 ? translations[0] : undefined,
    confidence: undefined,
    status: texts.length ? "finished" : "unprocessed",
    error: false,
  };
}
