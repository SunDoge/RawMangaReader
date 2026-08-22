import { invoke } from "@tauri-apps/api/core";

export interface OcrModelStatus {
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

export interface RegionRecognition {
  text: string;
  confidence: number;
}

export interface OcrModelProgress {
  file: string;
  downloadedBytes: number;
  totalBytes: number;
}

export interface VerticalMergeOptions {
  enabled: boolean;
  minAspectRatio: number;
  minOverlapRatio: number;
  maxCenterOffsetRatio: number;
  maxGapWidthRatio: number;
}

export const DEFAULT_VERTICAL_MERGE_OPTIONS: VerticalMergeOptions = {
  enabled: true,
  minAspectRatio: 1.2,
  minOverlapRatio: 0.5,
  maxCenterOffsetRatio: 0.35,
  maxGapWidthRatio: 1.5,
};

export const getOcrModelStatus = () =>
  invoke<OcrModelStatus>("get_ocr_model_status");

export const downloadOcrModel = () =>
  invoke<OcrModelStatus>("download_ocr_model");

export const removeOcrModel = () =>
  invoke<OcrModelStatus>("remove_ocr_model");

export const recognizePage = (
  imagePath: string,
  mergeOptions: VerticalMergeOptions = DEFAULT_VERTICAL_MERGE_OPTIONS,
) => invoke<OcrRegion[]>("recognize_page", { imagePath, mergeOptions });

export const recognizeRegion = (
  imagePath: string,
  rect: Pick<OcrRegion, "x" | "y" | "width" | "height">,
) => invoke<RegionRecognition>("recognize_region", { imagePath, rect });
