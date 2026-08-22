import { describe, expect, it } from "vitest";
import { isSupportedImage, naturalSort } from "./utils";

describe("naturalSort", () => {
  it("orders manga pages numerically and case-insensitively", () => {
    expect(["page10.JPG", "Page2.jpg", "page1.jpg"].sort(naturalSort)).toEqual([
      "page1.jpg",
      "Page2.jpg",
      "page10.JPG",
    ]);
  });
});

describe("isSupportedImage", () => {
  it("accepts supported image extensions regardless of case", () => {
    expect(isSupportedImage("001.PNG")).toBe(true);
    expect(isSupportedImage("spread.avif")).toBe(true);
  });

  it("rejects directories and unrelated files", () => {
    expect(isSupportedImage("chapter-01")).toBe(false);
    expect(isSupportedImage("notes.txt")).toBe(false);
  });
});
