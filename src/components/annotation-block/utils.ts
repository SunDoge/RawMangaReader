import type { IAnnotationType } from "@/types/annotation";

export type RelativePoint = { x: number; y: number };

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
