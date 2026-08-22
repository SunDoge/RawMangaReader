import Dexie, { type Table } from "dexie";
import { DEFAULT_APP_PREFERENCES, type AppPreferences } from "@/features/preferences";
import type { RecentSource, RecentSourceKind } from "@/features/recent-sources";

interface SettingsRecord {
  key: "app";
  value: AppPreferences;
  updatedAt: number;
}

export class RawMangaReaderDatabase extends Dexie {
  recentSources!: Table<RecentSource, [RecentSourceKind, string]>;
  settings!: Table<SettingsRecord, "app">;

  constructor(name = "raw-manga-reader") {
    super(name);
    this.version(1).stores({
      recentSources: "&[kind+path], openedAt, kind",
      settings: "&key, updatedAt",
    });
    this.version(2).stores({
      recentSources: "&[kind+path], openedAt, kind",
      settings: "&key, updatedAt",
    }).upgrade(async (transaction) => {
      await transaction.table<SettingsRecord>("settings").toCollection().modify((record) => {
        record.value = {
          ...DEFAULT_APP_PREFERENCES,
          ...record.value,
          mergeOptions: { ...DEFAULT_APP_PREFERENCES.mergeOptions, ...record.value.mergeOptions },
          translationOverlayOptions: { ...DEFAULT_APP_PREFERENCES.translationOverlayOptions, ...record.value.translationOverlayOptions },
          translationSettings: { ...DEFAULT_APP_PREFERENCES.translationSettings, ...record.value.translationSettings },
        };
      });
    });
  }
}

export const appDatabase = new RawMangaReaderDatabase();

export async function initializeFrontendStorage(database = appDatabase): Promise<{ preferences: AppPreferences; recentSources: RecentSource[] }> {
  return database.transaction("rw", database.settings, database.recentSources, async () => {
    let settings = await database.settings.get("app");
    if (!settings) {
      settings = { key: "app", value: structuredClone(DEFAULT_APP_PREFERENCES), updatedAt: Date.now() };
      await database.settings.put(settings);
    }
    const recentSources = await database.recentSources.orderBy("openedAt").reverse().limit(12).toArray();
    return { preferences: settings.value, recentSources };
  });
}

export async function persistPreferences(preferences: AppPreferences, database = appDatabase): Promise<void> {
  await database.settings.put({ key: "app", value: preferences, updatedAt: Date.now() });
}

export async function persistRecentSources(sources: RecentSource[], database = appDatabase): Promise<void> {
  await database.transaction("rw", database.recentSources, async () => {
    await database.recentSources.clear();
    if (sources.length) await database.recentSources.bulkPut(sources);
  });
}
