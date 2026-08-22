import { describe, expect, it } from "vitest";
import { DEFAULT_APP_PREFERENCES, formatAppError, loadPreferences, savePreferences, type PreferencesStorage } from "./preferences";

function memoryStorage(initial: string | null = null): PreferencesStorage & { value: string | null } {
  return { value: initial, getItem() { return this.value; }, setItem(_key, value) { this.value = value; } };
}

describe("app preferences", () => {
  it("merges partial persisted data with current defaults", () => {
    const preferences = loadPreferences(memoryStorage(JSON.stringify({ showBoundingBoxes: false, mergeOptions: { maxGapWidthRatio: 0.7 } })));
    expect(preferences.showBoundingBoxes).toBe(false);
    expect(preferences.mergeOptions.maxGapWidthRatio).toBe(0.7);
    expect(preferences.mergeOptions.maxCenterOffsetRatio).toBe(DEFAULT_APP_PREFERENCES.mergeOptions.maxCenterOffsetRatio);
  });

  it("recovers from corrupt data and never persists an API key", () => {
    expect(loadPreferences(memoryStorage("{"))).toEqual(DEFAULT_APP_PREFERENCES);
    const storage = memoryStorage();
    savePreferences(storage, DEFAULT_APP_PREFERENCES);
    expect(storage.value).not.toContain("openRouterApiKey");
  });

  it("normalizes errors for user-facing toasts", () => {
    expect(formatAppError(new Error("network failed"))).toBe("network failed");
    expect(formatAppError({ code: 401 })).toBe('{"code":401}');
  });
});
