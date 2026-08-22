import { describe, expect, it } from "vitest";
import { addRecentSources, loadRecentSources, sourceName, type RecentSourceStorage } from "./recent-sources";

const storage = (value: string | null): RecentSourceStorage => ({ getItem: () => value, setItem: () => undefined });

describe("recent sources", () => {
  it("extracts names from Unix and Windows paths", () => {
    expect(sourceName("/manga/chapter-1/")).toBe("chapter-1");
    expect(sourceName("C:\\manga\\001.jpg")).toBe("001.jpg");
  });

  it("deduplicates and moves reopened sources to the front", () => {
    const current = [{ kind: "file" as const, path: "/a.jpg", openedAt: 1 }];
    expect(addRecentSources(current, [{ kind: "file", path: "/a.jpg" }, { kind: "folder", path: "/chapter" }], 10)).toEqual([
      { kind: "file", path: "/a.jpg", openedAt: 10 },
      { kind: "folder", path: "/chapter", openedAt: 9 },
    ]);
  });

  it("ignores corrupt and invalid persisted entries", () => {
    expect(loadRecentSources(storage("{"))).toEqual([]);
    expect(loadRecentSources(storage('[{"kind":"url","path":"x","openedAt":1}]'))).toEqual([]);
  });
});
