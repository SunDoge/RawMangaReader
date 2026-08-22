export function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "bmp", "gif", "avif"]);

export function isSupportedImage(filename: string) {
  return IMAGE_EXTENSIONS.has(filename.split(".").pop()?.toLowerCase() ?? "");
}
