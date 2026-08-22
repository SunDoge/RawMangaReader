import { describe, expect, it } from "vitest";
import { parseComparisonModels } from "./settings";

describe("translation settings", () => {
  it("parses comma and newline separated models without duplicates", () => {
    expect(parseComparisonModels("a/model, b/model\na/model\n")).toEqual(["a/model", "b/model"]);
  });
});
