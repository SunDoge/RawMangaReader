import { describe, expect, it } from "vitest";
import { isSupportedImage, naturalSort, prioritizeImageIds } from "./utils";

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

describe("prioritizeImageIds", () => {
  it("orders the current page before nearby pages", () => {
    expect(prioritizeImageIds(["0", "1", "2", "3", "4"], 2)).toEqual([
      "2", "3", "1", "4", "0",
    ]);
  });

  it("stays inside collection boundaries", () => {
    expect(prioritizeImageIds(["0", "1", "2"], 0)).toEqual(["0", "1", "2"]);
  });
});
