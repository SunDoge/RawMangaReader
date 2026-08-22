import { describe, expect, it } from "vitest";
import { fitExportFontSize } from "./render";

const fakeContext = {
  font: "",
  measureText(text: string) { return { width: Array.from(text).length * Number.parseFloat(fakeContext.font) }; },
};
const context = fakeContext as unknown as CanvasRenderingContext2D;

describe("export typesetting", () => {
  it("reduces horizontal text to fit the target bubble", () => {
    const short = fitExportFontSize(context, "短句", 200, 100, false, 1);
    const long = fitExportFontSize(context, "这是明显更长并且需要自动换行的译文", 200, 100, false, 1);
    expect(short).toBeGreaterThan(long);
    expect(long).toBeGreaterThanOrEqual(2);
  });

  it("respects the font scale for vertical typesetting", () => {
    const normal = fitExportFontSize(context, "竖排漫画译文", 100, 300, true, 1);
    const smaller = fitExportFontSize(context, "竖排漫画译文", 100, 300, true, 0.6);
    expect(smaller).toBeLessThan(normal);
  });
});
