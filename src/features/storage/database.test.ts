import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { initializeFrontendStorage, persistPreferences, persistRecentSources, RawMangaReaderDatabase } from "./database";

const databases: RawMangaReaderDatabase[] = [];
const createDatabase = () => { const database = new RawMangaReaderDatabase(`test-${crypto.randomUUID()}`); databases.push(database); return database; };
afterEach(async () => { await Promise.all(databases.splice(0).map((database) => database.delete())); });

describe("Dexie frontend storage", () => {
  it("uses a versioned schema", () => {
    expect(createDatabase().verno).toBe(2);
  });

  it("persists settings and indexed history", async () => {
    const database = createDatabase();
    const initial = await initializeFrontendStorage(database);
    await persistPreferences({ ...initial.preferences, showBoundingBoxes: false }, database);
    await persistRecentSources([{ kind: "file", path: "/001.jpg", openedAt: 20 }], database);
    const reloaded = await initializeFrontendStorage(database);
    expect(reloaded.preferences.showBoundingBoxes).toBe(false);
    expect(reloaded.recentSources[0].path).toBe("/001.jpg");
  });
});
