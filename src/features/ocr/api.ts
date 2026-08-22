import { invoke } from "@tauri-apps/api/core";

export type OcrModelKind = "small" | "medium";

export interface OcrModelStatus {
  kind: OcrModelKind;
  installed: boolean;
  ready: boolean;
  version: string;
  downloadedBytes: number;
  totalBytes: number;
}

export interface OcrPoint {
  x: number;
  y: number;
}

export interface OcrRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  polygon: OcrPoint[];
  text: string;
  confidence: number;
}

export interface PageRecognition {
  regions: OcrRegion[];
  rawRegions: OcrRegion[];
}

export interface RegionRecognition {
  text: string;
  confidence: number;
}

export interface OcrModelProgress {
  file: string;
  downloadedBytes: number;
  totalBytes: number;
}

export interface RegisteredImage {
  id: string;
  path: string;
}

export interface VerticalMergeOptions {
  enabled: boolean;
  minTextSizePx: number;
  mergeAdjacentColumns: boolean;
  minColumnOverlapRatio: number;
  maxColumnGapWidthRatio: number;
  minAspectRatio: number;
  minOverlapRatio: number;
  maxCenterOffsetRatio: number;
  maxGapWidthRatio: number;
}

export interface ImagePreloadRequest {
  requestId: string;
  imageIds: string[];
  mergeOptions: VerticalMergeOptions;
  recognize: boolean;
  modelKind: OcrModelKind;
}

export interface PrefetchedOcr {
  requestId: string;
  imageId: string;
  regions: OcrRegion[];
  rawRegions: OcrRegion[];
}

export type ImageCacheKind = "decoded" | "ocr" | "all";

export interface ImageCacheStats {
  activeImages: number;
  decodedEntries: number;
  decodedBytes: number;
  decodedCapacityBytes: number;
  ocrMemoryEntries: number;
  ocrMemoryBytes: number;
  ocrMemoryCapacityBytes: number;
  ocrDiskCapacityBytes: number;
  ocrDiskReadBytes: number;
  ocrDiskWriteBytes: number;
}

export const DEFAULT_VERTICAL_MERGE_OPTIONS: VerticalMergeOptions = {
  enabled: true,
  minTextSizePx: 0,
  mergeAdjacentColumns: true,
  minColumnOverlapRatio: 0.65,
  maxColumnGapWidthRatio: 0.5,
  minAspectRatio: 1.2,
  minOverlapRatio: 0.5,
  maxCenterOffsetRatio: 0.15,
  maxGapWidthRatio: 1.5,
};

export const getOcrModelStatus = (kind: OcrModelKind) =>
  invoke<OcrModelStatus>("get_ocr_model_status", { kind });

export const downloadOcrModel = (kind: OcrModelKind) =>
  invoke<OcrModelStatus>("download_ocr_model", { kind });

export const removeOcrModel = (kind: OcrModelKind) =>
  invoke<OcrModelStatus>("remove_ocr_model", { kind });

export const listImageFiles = (folder: string) =>
  invoke<string[]>("list_image_files", { folder });

export const registerImages = (paths: string[]) =>
  invoke<RegisteredImage[]>("register_images", { paths });

export const releaseImages = (imageIds: string[]) =>
  invoke<void>("release_images", { imageIds });

export const scheduleImagePreload = (request: ImagePreloadRequest) =>
  invoke<void>("schedule_image_preload", { request });

export const getImageCacheStats = () =>
  invoke<ImageCacheStats>("get_image_cache_stats");

export const clearImageCache = (kind: ImageCacheKind) =>
  invoke<ImageCacheStats>("clear_image_cache", { kind });

export const recognizePage = (
  imageId: string,
  mergeOptions: VerticalMergeOptions = DEFAULT_VERTICAL_MERGE_OPTIONS,
  kind: OcrModelKind = "small",
) => invoke<PageRecognition>("recognize_page", { imageId, mergeOptions, kind });

export const recognizeRegion = (
  imageId: string,
  rect: Pick<OcrRegion, "x" | "y" | "width" | "height">,
  kind: OcrModelKind = "small",
) => invoke<RegionRecognition>("recognize_region", { imageId, rect, kind });
