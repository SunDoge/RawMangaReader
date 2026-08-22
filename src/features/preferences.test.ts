import { describe, expect, it } from "vitest";
import { formatAppError } from "./preferences";

describe("app preferences", () => {
  it("normalizes errors for user-facing toasts", () => {
    expect(formatAppError(new Error("network failed"))).toBe("network failed");
    expect(formatAppError({ code: 401 })).toBe('{"code":401}');
  });
});
