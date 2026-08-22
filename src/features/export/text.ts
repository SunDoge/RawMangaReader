import { invoke } from "@tauri-apps/api/core";
import type { IAnnotationType } from "@/types/annotation";

export function buildOcrText(pages: IAnnotationType[][]): string {
  return pages
    .map((annotations) => annotations.map((item) => item.ocr?.trim()).filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");
}

export const writeExportedText = (path: string, text: string) => invoke<void>("write_exported_text", { path, text });
