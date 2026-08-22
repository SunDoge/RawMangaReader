import { useLayoutEffect, useRef } from "react";

import {
  resolveTranslationDirection,
  type TranslationOverlayOptions,
} from "@/features/translation/overlay";

interface FittedTranslationProps {
  text: string;
  options: TranslationOverlayOptions;
}

export function FittedTranslation({ text, options }: FittedTranslationProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = textRef.current;
    if (!container || !content) return;

    const fit = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const direction = resolveTranslationDirection(width, height, options.direction);
      content.style.writingMode = direction === "vertical" ? "vertical-rl" : "horizontal-tb";
      content.style.textOrientation = direction === "vertical" ? "upright" : "mixed";

      let low = 6;
      let high = Math.max(low, Math.min(48, Math.max(width, height) * 0.45) * options.fontScale);
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const size = (low + high) / 2;
        content.style.fontSize = `${size}px`;
        if (content.scrollWidth <= width + 0.5 && content.scrollHeight <= height + 0.5) {
          low = size;
        } else {
          high = size;
        }
      }
      content.style.fontSize = `${low}px`;
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [options.direction, options.fontScale, text]);

  return (
    <span ref={containerRef} className="absolute inset-1 flex items-center justify-center overflow-hidden">
      <span ref={textRef} className="max-h-full max-w-full whitespace-pre-wrap break-words text-center font-medium leading-tight text-foreground">
        {text}
      </span>
    </span>
  );
}
