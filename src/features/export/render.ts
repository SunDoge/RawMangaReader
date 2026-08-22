import { invoke } from "@tauri-apps/api/core";
import type { TranslationOverlayOptions } from "@/features/translation/overlay";
import { resolveTranslationDirection } from "@/features/translation/overlay";
import type { IAnnotationType } from "@/types/annotation";

const FONT_FAMILY = '"Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif';

function imageMimeType(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  return ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", bmp: "image/bmp" } as Record<string, string>)[extension ?? ""] ?? "application/octet-stream";
}

function loadImage(bytes: ArrayBuffer, mimeType: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const source = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(source); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(source); reject(new Error("无法读取待导出的原图")); };
    image.src = source;
  });
}

function horizontalLines(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const character of Array.from(paragraph)) {
      if (line && context.measureText(line + character).width > width) {
        lines.push(line);
        line = character;
      } else line += character;
    }
    if (line || !paragraph) lines.push(line);
  }
  return lines;
}

function fits(context: CanvasRenderingContext2D, text: string, width: number, height: number, size: number, vertical: boolean): boolean {
  context.font = `600 ${size}px ${FONT_FAMILY}`;
  if (vertical) {
    const rows = Math.max(1, Math.floor(height / (size * 1.12)));
    const columns = Math.ceil(Array.from(text.replace(/\s+/g, "")).length / rows);
    return columns * size * 1.15 <= width;
  }
  return horizontalLines(context, text, width).length * size * 1.18 <= height;
}

export function fitExportFontSize(context: CanvasRenderingContext2D, text: string, width: number, height: number, vertical: boolean, scale: number): number {
  let low = 2;
  let high = Math.max(low, Math.min(256, Math.min(width, height) * 0.9));
  for (let index = 0; index < 12; index += 1) {
    const size = (low + high) / 2;
    if (fits(context, text, width, height, size, vertical)) low = size;
    else high = size;
  }
  return low * scale;
}

function drawTranslation(context: CanvasRenderingContext2D, annotation: IAnnotationType, canvas: HTMLCanvasElement, options: TranslationOverlayOptions) {
  const text = annotation.translation?.trim();
  if (!text) return;
  const x = annotation.x * canvas.width;
  const y = annotation.y * canvas.height;
  const width = annotation.width * canvas.width;
  const height = annotation.height * canvas.height;
  const padding = Math.max(2, Math.min(width, height) * 0.04);
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);
  const vertical = resolveTranslationDirection(width, height, options.direction) === "vertical";
  const size = fitExportFontSize(context, text, innerWidth, innerHeight, vertical, options.fontScale);

  context.save();
  context.fillStyle = `rgb(255 255 255 / ${options.backgroundOpacity})`;
  context.fillRect(x, y, width, height);
  context.fillStyle = "#000";
  context.font = `600 ${size}px ${FONT_FAMILY}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  if (vertical) {
    const characters = Array.from(text.replace(/\s+/g, ""));
    const rows = Math.max(1, Math.floor(innerHeight / (size * 1.12)));
    const columns = Math.ceil(characters.length / rows);
    const startX = x + width / 2 + (columns - 1) * size * 0.575;
    characters.forEach((character, index) => {
      const column = Math.floor(index / rows);
      const row = index % rows;
      context.fillText(character, startX - column * size * 1.15, y + padding + size / 2 + row * size * 1.12);
    });
  } else {
    const lines = horizontalLines(context, text, innerWidth);
    const startY = y + height / 2 - (lines.length - 1) * size * 0.59;
    lines.forEach((line, index) => context.fillText(line, x + width / 2, startY + index * size * 1.18));
  }
  context.restore();
}

export async function renderTranslatedPng(imageId: string, imagePath: string, annotations: IAnnotationType[], options: TranslationOverlayOptions): Promise<Uint8Array> {
  const source = await invoke<ArrayBuffer>("read_export_source", { imageId });
  const image = await loadImage(source, imageMimeType(imagePath));
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前 WebView 不支持 Canvas 导出");
  context.drawImage(image, 0, 0);
  annotations.forEach((annotation) => drawTranslation(context, annotation, canvas, options));
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG 编码失败")), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

export const writeExportedImage = (path: string, bytes: Uint8Array) => invoke<void>("write_exported_image", { path, bytes });
