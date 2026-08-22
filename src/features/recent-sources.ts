export type RecentSourceKind = "folder" | "file";

export interface RecentSource {
  kind: RecentSourceKind;
  path: string;
  openedAt: number;
}

const MAX_RECENT_SOURCES = 12;

export function sourceName(path: string): string {
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
}

export function addRecentSources(current: RecentSource[], additions: Array<Omit<RecentSource, "openedAt">>, openedAt = Date.now()): RecentSource[] {
  const addedKeys = new Set(additions.map((source) => `${source.kind}:${source.path}`));
  return [
    ...additions.map((source, index) => ({ ...source, openedAt: openedAt - index })),
    ...current.filter((source) => !addedKeys.has(`${source.kind}:${source.path}`)),
  ].slice(0, MAX_RECENT_SOURCES);
}
