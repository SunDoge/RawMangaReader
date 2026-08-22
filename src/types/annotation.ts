export type IAnnotationType = {
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
  unit: "%";
  status?: "unprocessed" | "processing" | "finished";
  ocr?: string;
  translate?: string;
  error?: boolean;
};
