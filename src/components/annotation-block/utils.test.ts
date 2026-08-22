import { describe, expect, it } from "vitest";
import { createAnnotation, isUsableAnnotation, transformAnnotation } from "./utils";

describe("createAnnotation", () => {
  it("normalizes a drag from bottom-right to top-left", () => {
    const annotation = createAnnotation({ x: 0.8, y: 0.7 }, { x: 0.2, y: 0.1 }, "area-1");
    expect(annotation).toMatchObject({
      id: "area-1",
      x: 0.2,
      y: 0.1,
      unit: "%",
      status: "unprocessed",
    });
    expect(annotation.width).toBeCloseTo(0.6);
    expect(annotation.height).toBeCloseTo(0.6);
  });

  it("moves and resizes annotations inside image bounds", () => {
    const annotation = createAnnotation({ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.5 }, "box");
    expect(transformAnnotation(annotation, { x: 0, y: 0 }, { x: 0.7, y: 0.8 }, "move")).toMatchObject({ x: 0.8, y: 0.7, width: 0.2, height: 0.3 });
    const resized = transformAnnotation(annotation, { x: 0.4, y: 0.5 }, { x: 0.6, y: 0.7 }, "se");
    expect(resized).toMatchObject({ x: 0.2, y: 0.2 });
    expect(resized.width).toBeCloseTo(0.4);
    expect(resized.height).toBeCloseTo(0.5);
  });

  it("clamps points to image bounds", () => {
    expect(createAnnotation({ x: -0.2, y: 0.25 }, { x: 1.4, y: 2 }, "area-2")).toMatchObject({
      x: 0,
      y: 0.25,
      width: 1,
      height: 0.75,
    });
  });
});

describe("isUsableAnnotation", () => {
  it("rejects accidental clicks and accepts visible regions", () => {
    expect(isUsableAnnotation(createAnnotation({ x: 0.1, y: 0.1 }, { x: 0.105, y: 0.5 }, "tiny"))).toBe(false);
    expect(isUsableAnnotation(createAnnotation({ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.5 }, "valid"))).toBe(true);
  });
});
