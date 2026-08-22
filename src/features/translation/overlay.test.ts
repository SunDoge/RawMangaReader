import { describe, expect, it } from "vitest";

import { resolveTranslationDirection, translationFitBounds } from "./overlay";

describe("translation overlay direction", () => {
  it("uses vertical text for tall rendered boxes", () => {
    expect(resolveTranslationDirection(40, 100, "auto")).toBe("vertical");
    expect(resolveTranslationDirection(100, 40, "auto")).toBe("horizontal");
  });

  it("honors an explicit direction", () => {
    expect(resolveTranslationDirection(100, 40, "vertical")).toBe("vertical");
    expect(resolveTranslationDirection(40, 100, "horizontal")).toBe("horizontal");
  });
});

describe("translation font fitting", () => {
  it("allows tiny text to fit narrow OCR boxes", () => {
    expect(translationFitBounds(12, 80, 1)).toEqual({ min: 2, max: 10.8 });
  });

  it("caps text on large boxes and applies the configured scale", () => {
    expect(translationFitBounds(300, 400, 1).max).toBe(72);
    expect(translationFitBounds(100, 200, 0.8).max).toBeCloseTo(57.6);
  });
});
