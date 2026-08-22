export function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "bmp", "gif", "avif"]);

export function isSupportedImage(filename: string) {
  return IMAGE_EXTENSIONS.has(filename.split(".").pop()?.toLowerCase() ?? "");
}

export function prioritizeImageIds(ids: string[], currentIndex: number, radius = 2) {
  const prioritized: string[] = [];
  for (let distance = 0; distance <= radius; distance += 1) {
    const next = currentIndex + distance;
    if (next >= 0 && next < ids.length) prioritized.push(ids[next]);
    if (distance === 0) continue;
    const previous = currentIndex - distance;
    if (previous >= 0 && previous < ids.length) prioritized.push(ids[previous]);
  }
  return prioritized;
}
