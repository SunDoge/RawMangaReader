import { describe, expect, it } from "vitest";

import { resolveTranslationDirection } from "./overlay";

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
