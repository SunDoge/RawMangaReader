export type IAnnotationType = {
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
  unit: "%";
  status?: "unprocessed" | "processing" | "finished";
  ocr?: string;
  translation?: string;
  confidence?: number;
  polygon?: Array<{ x: number; y: number }>;
  error?: boolean;
};
