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

export const getOcrModelStatus = () =>
  invoke<OcrModelStatus>("get_ocr_model_status");

export const downloadOcrModel = () =>
  invoke<OcrModelStatus>("download_ocr_model");

export const removeOcrModel = () =>
  invoke<OcrModelStatus>("remove_ocr_model");

export const recognizePage = (imagePath: string) =>
  invoke<OcrRegion[]>("recognize_page", { imagePath });

export const recognizeRegion = (
  imagePath: string,
  rect: Pick<OcrRegion, "x" | "y" | "width" | "height">,
) => invoke<RegionRecognition>("recognize_region", { imagePath, rect });
