import React, { useCallback, useEffect, useState } from "react";
import style from "./style.module.less";
import { IAnnotationType } from "@/types/annotation";
import { Tag, Tooltip } from "antd";
import {
  DeleteOutlined,
  CheckCircleTwoTone,
  LoadingOutlined,
  PlayCircleTwoTone,
  SyncOutlined
} from "@ant-design/icons";
import classNames from "classnames";

interface IAnnotationSelectorProps {
  index: number;
  selected?: boolean;
  annotation: IAnnotationType;
  onSelect?: (index: number) => void;
  onRemove?: (index: number) => void;
  onChange?: (data: IAnnotationType, index: number) => void;
  onOCRClick?: (data: IAnnotationType, index: number) => void;
}

export const AnnotationSelector: React.FC<IAnnotationSelectorProps> = (
  props
) => {
  const { annotation, index, selected, onOCRClick } = props;
  const [open, setOpen] = useState<boolean>(false);
  const handleVisibleChange = useCallback((open: boolean) => {
    if (annotation.status === 'finished' && open) {
      setOpen(open)
    } else if (!open) {
      setOpen(open);
    }
  }, [annotation.status]);

  useEffect(() => {
    if (annotation.status !== 'finished') {
      setOpen(false);
    }
  }, [annotation.status])

  const status = annotation.status ?? "unprocessed";
  return (
    <Tooltip
      title={
        <section>
          OCR: {annotation.ocr}
        </section>
      }
      open={open}
      trigger="hover"
      align={{
        offset: [0, -28]
      }}
      onOpenChange={handleVisibleChange}
      overlayClassName={style.tooltip}
      // placement="topLeft"
      // arrow={{
      //   pointAtCenter: true,
      // }}
    >
      <div
        className={classNames(style.selector, {
          [style.selected]: selected,
          'selected': selected
        })}
        onClick={() => props.onSelect?.(index)}
      >
        <section className={style.info}>
          <Tag className={style.indexTag} color="#FF6F00">
            {index + 1}
          </Tag>
          <section className={style.operation}>
            {
              status === "unprocessed" && 
              <PlayCircleTwoTone
                onClick={() => onOCRClick?.(annotation, index)}
                twoToneColor={annotation.error ? '#FF6F00' : '#1677ff'}
              />
            }
            {status !== "unprocessed" && (
              status === "processing" ? (
                <LoadingOutlined style={{color: '#1677ff'}}/>
              ) : (
                <CheckCircleTwoTone twoToneColor="#73d13d" />
              )
            )}
            {
              status === "finished" && 
              <SyncOutlined
                onClick={() => onOCRClick?.(annotation, index)}
                style={{color: "#1677ff"}}
              />
            }
            <DeleteOutlined
              className={style.deleteBtn}
              onClick={(e) => {
                e.stopPropagation();
                props.onRemove?.(props.index);
              }}
              style={{ color: "#FF0000" }}
            />
          </section>
        </section>
      </div>
    </Tooltip>
  );
};
