import { useLayoutEffect, useRef } from "react";

import {
  resolveTranslationDirection,
  translationFitBounds,
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
      content.style.textOrientation = "mixed";
      content.style.lineHeight = direction === "vertical" ? "1.12" : "1.18";
      content.style.letterSpacing = direction === "vertical" ? "0.03em" : "0";

      let { min: low, max: high } = translationFitBounds(width, height, options.fontScale);
      content.style.fontSize = `${low}px`;
      if (content.scrollWidth > width + 0.5 || content.scrollHeight > height + 0.5) {
        low = 1;
      }
      for (let attempt = 0; attempt < 10; attempt += 1) {
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
    <span ref={containerRef} className="pointer-events-none absolute inset-[3%] flex items-center justify-center overflow-hidden" lang="zh-CN">
      <span ref={textRef} className="max-h-full max-w-full whitespace-pre-wrap break-all text-center font-semibold text-black [font-family:'Noto_Sans_CJK_SC','PingFang_SC','Microsoft_YaHei','Source_Han_Sans_SC',sans-serif] [hyphens:none] [line-break:strict] [overflow-wrap:anywhere] [text-wrap:pretty]">
        {text}
      </span>
    </span>
  );
}
