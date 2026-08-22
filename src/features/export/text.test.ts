import { describe, expect, it } from "vitest";
import type { IAnnotationType } from "@/types/annotation";
import { buildOcrText } from "./text";

const annotation = (ocr?: string): IAnnotationType => ({ id: crypto.randomUUID(), unit: "%", x: 0, y: 0, width: 0.1, height: 0.1, ocr });

describe("OCR text export", () => {
  it("puts each detected region on its own line", () => {
    expect(buildOcrText([[annotation("第一段"), annotation("第二段"), annotation("第三段")]])).toBe("第一段\n第二段\n第三段");
  });

  it("separates pages with one blank line and skips empty regions", () => {
    expect(buildOcrText([[annotation("第一页"), annotation()], [annotation("第二页 A"), annotation("第二页 B")]])).toBe("第一页\n\n第二页 A\n第二页 B");
  });
});
