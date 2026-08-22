import type { IAnnotationType } from "@/types/annotation";
import type { OcrRegion } from "./api";

export function regionsToAnnotations(
  regions: OcrRegion[],
  createId: () => string = () => crypto.randomUUID(),
): IAnnotationType[] {
  return regions.map((region) => ({
    id: createId(),
    unit: "%",
    status: "finished",
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    polygon: region.polygon,
    ocr: region.text,
    confidence: region.confidence,
  }));
}
