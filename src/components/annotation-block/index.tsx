import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IThumbnailListProps } from "../thumbnail-list";
import { IAnnotationType } from "@/types/annotation";
import { Pagination, message } from "antd";
import classNames from "classnames";
import style from "./style.module.less";
import {
  AreaSelector,
  IArea,
  IAreaRendererProps,
} from "@bmunozg/react-image-area";
import { convertFileSrc } from "@tauri-apps/api/tauri";
import { useSize, useThrottleEffect } from "ahooks";
import { processPercent2Pixel, processPixel2Percent } from "./utils";
import { AnnotationSelector } from "../annotation-selector";
import ResultList from "../result-list";

interface IProps extends IThumbnailListProps {
  annotationList?: IAnnotationType[];
  onAnnotationListChange?: (list: IAnnotationType[]) => void;
  onOCR?: (annotation: IAnnotationType) => Promise<{
    status?: "unprocessed" | "processing" | "finished";
    ocr?: string;
    translate?: string;
  }>;
}

export const AnnotationBlock: React.FC<IProps> = (props) => {
  const {
    currentIndex,
    imageList,
    annotationList = [],
    onSelected,
    onAnnotationListChange,
    onOCR,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [areas, setAreas] = useState<IArea[]>([]);
  const [annotationSelected, setAnnotationSelected] = useState<number>(-1);

  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  }>();
  const containerSize = useSize(containerRef);

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (containerSize && imageSize) {
      const result = processPercent2Pixel(
        containerSize,
        imageSize,
        annotationList as (Omit<IArea, "unit"> & { unit: "%" })[]
      );
      setAreas(result);
      setAnnotationSelected(-1);
    }
  }, [containerSize, imageSize, currentIndex]);

  // img onLoad 和 size 变动时调用
  const handleImageSize = () => {
    if (imageRef.current && containerSize) {
      const oriWidth = imageRef.current.naturalWidth;
      const oriHeight = imageRef.current.naturalHeight;
      // console.log(containerSize, oriHeight, oriWidth)
      if (oriHeight / oriWidth > containerSize.height / containerSize.width) {
        // 原图比容器高，以容器高为准
        setImageSize({
          width: (oriWidth / oriHeight) * containerSize.height,
          height: containerSize.height,
        });
      } else {
        // 原图比容器窄，以容器宽为准
        setImageSize({
          width: containerSize.width,
          height: (oriHeight / oriWidth) * containerSize.width,
        });
      }
    }
  }

  // 计算image的大小
  useEffect(() => {
    handleImageSize()
  }, [imageRef.current, containerSize]);

  const onChangeHandler = (_areas: IArea[]) => {
    if (areas.length < _areas.length) {
      setAnnotationSelected(_areas.length - 1);
    }
    setAreas(_areas);
  };

  const handleAnnotationChange = useCallback(
    (annotation: IAnnotationType, index: number) => {
      setAreas((areas) => {
        const newAreas = [...areas];
        newAreas.splice(index, 1, { ...areas[index], ...annotation });
        return newAreas;
      });
      setAnnotationSelected(index);
    },
    []
  );

  const handleAnnotationRemove = useCallback(
    (index: number, length?: number) => {
      setAreas((areas) => {
        const newAreas = [...areas];
        newAreas.splice(index, length ?? 1);
        // console.log(newAreas);
        return newAreas;
      });
      setAnnotationSelected(-1);
    },
    []
  );

  const handleAnnotationOCR = useCallback(
    async (annotation: IAnnotationType, index: number) => {
      if (containerSize && imageSize) {
        setAreas((areas) => {
          const newAreas = [...areas] as IAnnotationType[];
          newAreas.splice(index, 1, {
            ...areas[index],
            ...annotation,
            status: "processing",
            ocr: "",
            translate: "",
            error: false,
          });
          return newAreas;
        });
        const processed = processPixel2Percent(containerSize, imageSize, [
          annotation,
        ] as (Omit<IArea, "unit"> & { unit: "px" })[]);
        try {
          const result = await onOCR?.(processed[0]);
          // messageApi.success(`模型识别结果${result}`);
          setAreas((areas) => {
            const newAreas = [...areas] as IAnnotationType[];
            newAreas.splice(index, 1, {
              ...areas[index],
              ...annotation,
              status: "finished",
              ocr: result as string,
              translate: result as string,
              error: false,
            });
            return newAreas;
          });
        } catch (e) {
          if ((e as any).message === 'MODEL_ERROR') {
            messageApi.error("请先加载模型！");
          } else {
            messageApi.error("模型识别错误");
          }
          setAreas((areas) => {
            const newAreas = [...areas] as IAnnotationType[];
            newAreas.splice(index, 1, {
              ...areas[index],
              ...annotation,
              status: "unprocessed",
              ocr: "",
              translate: "",
              error: true,
            });
            return newAreas;
          });
        }
      }
    },
    [onOCR, containerSize, imageSize]
  );

  // 计算 bbox 后的实际大小，节流然后向上回调 bboxs
  useThrottleEffect(
    () => {
      if (
        areas.every((area) => !area.isNew && !area.isChanging) &&
        containerSize &&
        imageSize
      ) {
        // 稳定下来后再通知上层数据变化
        // 开始数据处理，像素转百分比
        const processed = processPixel2Percent(
          containerSize,
          imageSize,
          areas as (Omit<IArea, "unit"> & { unit: "px" })[]
        );
        onAnnotationListChange?.(processed);
      }
    },
    [areas, containerSize, imageSize],
    { wait: 500 }
  );

  const CustomSelectorRender = useMemo(() => {
    return (props: IAreaRendererProps) => {
      const { areaNumber } = props;

      return (
        <AnnotationSelector
          key={props.areaNumber}
          index={areaNumber - 1}
          selected={annotationSelected === areaNumber - 1}
          onSelect={(index) => setAnnotationSelected(index)}
          annotation={areas[areaNumber - 1]}
          onChange={handleAnnotationChange}
          onRemove={handleAnnotationRemove}
          onOCRClick={handleAnnotationOCR}
        />
      );
    };
  }, [
    onOCR,
    areas,
    annotationSelected,
    handleAnnotationChange,
    handleAnnotationRemove,
  ]);

  return (
    <section className={classNames(style.annotationBlock, "annotation-block")}>
      {contextHolder}
      <section className="main">
        <section className="draw">
          <div className={style.areaSelector} ref={containerRef}>
            <AreaSelector
              globalAreaStyle={{
                backgroundColor: "rgba(0,133,242,.1)",
              }}
              mediaWrapperClassName="object-contain" // wrong
              areas={areas}
              onChange={onChangeHandler}
              customAreaRenderer={CustomSelectorRender}
              unit="pixel" // 这里用像素方便计算，传到外面用 百分比
            // debug
            >
              <img
                ref={imageRef}
                src={convertFileSrc(imageList[currentIndex])}
                alt=""
                className="object-contain"
                onLoad={handleImageSize}
              />
            </AreaSelector>
          </div>
        </section>
        <section className="footer">
          <Pagination
            current={currentIndex + 1}
            onChange={(page) => onSelected?.(page - 1)}
            total={imageList?.length || 0}
            pageSize={1}
            showQuickJumper={imageList?.length > 50}
          />
        </section>
      </section>
      <section className="result">
        <ResultList
          annotations={areas}
          selected={annotationSelected}
          onSelect={(index) => setAnnotationSelected(index)}
          onRemove={handleAnnotationRemove}
          onOCRClick={handleAnnotationOCR}
        />
      </section>
    </section>
  );
};
