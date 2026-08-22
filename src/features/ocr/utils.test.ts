import { describe, expect, it } from "vitest";
import { regionsToAnnotations } from "./utils";

describe("regionsToAnnotations", () => {
  it("preserves OCR geometry and editable recognition data", () => {
    const annotations = regionsToAnnotations([
      {
        x: 0.1,
        y: 0.2,
        width: 0.3,
        height: 0.4,
        polygon: [{ x: 0.1, y: 0.2 }],
        text: "素直に",
        confidence: 0.98,
      },
    ], () => "region-id");

    expect(annotations).toEqual([
      {
        id: "region-id",
        unit: "%",
        status: "finished",
        x: 0.1,
        y: 0.2,
        width: 0.3,
        height: 0.4,
        polygon: [{ x: 0.1, y: 0.2 }],
        ocr: "素直に",
        confidence: 0.98,
      },
    ]);
  });
});
