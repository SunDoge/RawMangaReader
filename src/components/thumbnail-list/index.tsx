import { useEffect, useRef } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface IThumbnailListProps {
  imageList: string[];
  currentIndex: number;
  onSelected: (index: number) => void;
}

export function ThumbnailList(props: IThumbnailListProps) {
  const { imageList, currentIndex, onSelected } = props;
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentIndex]);

  return (
    <ScrollArea className="h-full">
      <div className="grid gap-3 p-3">
        {imageList.map((imagePath, index) => (
          <button
            ref={index === currentIndex ? selectedRef : undefined}
            className={cn("group overflow-hidden rounded-lg border bg-card text-left transition hover:border-foreground/30", index === currentIndex && "border-primary ring-2 ring-primary/20")}
            key={imagePath}
            onClick={() => onSelected(index)}
          >
            <img className="aspect-[3/4] w-full bg-muted object-cover" src={convertFileSrc(imagePath)} alt={`第 ${index + 1} 页`} />
            <div className="flex items-center justify-between px-2 py-1.5 text-xs">
              <span className="font-medium">第 {index + 1} 页</span>
              <span className="text-muted-foreground">{index + 1}/{imageList.length}</span>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}

export default ThumbnailList;
