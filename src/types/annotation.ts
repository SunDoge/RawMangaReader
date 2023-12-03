import { IArea } from "@bmunozg/react-image-area";

export type IBBoxType = {
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
};

export type IAnnotationType = IArea & {
  status?: 'unprocessed' | 'processing' | 'finished';
  ocr?: string;
  translate?: string;
  error?: boolean;
}
