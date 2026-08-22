export type RecentSourceKind = "folder" | "file";

export interface RecentSource {
  kind: RecentSourceKind;
  path: string;
  openedAt: number;
}

const STORAGE_KEY = "raw-manga-reader.recent-sources.v1";
const MAX_RECENT_SOURCES = 12;

export interface RecentSourceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function sourceName(path: string): string {
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
}

export function loadRecentSources(storage: RecentSourceStorage): RecentSource[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is RecentSource => {
      if (!item || typeof item !== "object") return false;
      const source = item as Partial<RecentSource>;
      return (source.kind === "folder" || source.kind === "file") && typeof source.path === "string" && Boolean(source.path) && typeof source.openedAt === "number";
    }).slice(0, MAX_RECENT_SOURCES);
  } catch { return []; }
}

export function addRecentSources(current: RecentSource[], additions: Array<Omit<RecentSource, "openedAt">>, openedAt = Date.now()): RecentSource[] {
  const addedKeys = new Set(additions.map((source) => `${source.kind}:${source.path}`));
  return [
    ...additions.map((source, index) => ({ ...source, openedAt: openedAt - index })),
    ...current.filter((source) => !addedKeys.has(`${source.kind}:${source.path}`)),
  ].slice(0, MAX_RECENT_SOURCES);
}

export function saveRecentSources(storage: RecentSourceStorage, sources: RecentSource[]): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(sources));
}
