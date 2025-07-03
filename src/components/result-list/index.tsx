import React, { useCallback } from "react";
import { IAnnotationType } from "@/types/annotation";
import style from "./style.module.less";
import { Button, Popconfirm, Tooltip, message } from "antd";
import classNames from "classnames";
import {
  DeleteOutlined,
  LoadingOutlined,
  PlayCircleTwoTone,
  SnippetsOutlined,
  SyncOutlined,
} from "@ant-design/icons";
// import { copyToClipBoard } from "./utils";
// import { writeText } from "@tauri-apps/plugin-clipboard-manager";

interface IResultListProps {
  annotations: IAnnotationType[];
  selected?: number;
  onSelect?: (index: number) => void;
  onRemove?: (index: number, length?: number) => void;
  onOCRClick?: (data: IAnnotationType, index: number) => void;
}

export const ResultList: React.FC<IResultListProps> = (props) => {
  const { annotations, selected, onOCRClick, onRemove, onSelect } = props;

  const [messageApi, contextHolder] = message.useMessage();

  const handleCopyAll = useCallback(async () => {
    const text = annotations.reduce(
      (res, anno, index) =>
      (res += `${index + 1}: ${anno.status === "finished" && !anno.error
        ? (anno.ocr ?? "").replace(/[\r\n]/g, "")
        : "NULL"
        } \n`),
      ""
    );
    // copyToClipBoard(text);
    // await writeText(text);
    console.log(text)
    messageApi.success("全部复制成功");
  }, [annotations]);

  const handleOCRAll = useCallback(() => {
    annotations.map((anno, index) => onOCRClick?.(anno, index));
    messageApi.success("全部选中区域开始检测");
  }, [annotations]);

  const handleClearAll = useCallback(() => {
    onRemove?.(0, annotations.length);
  }, [annotations]);

  return (
    <section className={style.resultList}>
      {contextHolder}
      <section className={style.header}>
        <Button size="small" onClick={handleCopyAll}>
          复制全部
        </Button>
        <Button size="small" onClick={handleOCRAll}>检测全部</Button>
        <Popconfirm
          placement="bottomRight"
          title={"确定要移除当前页的全部选区吗？"}
          description={"移除当前页的全部选区后不可撤销！"}
          onConfirm={handleClearAll}
          okText="移除"
          cancelText="我再想想"
          trigger="click"
        >
          <Button size="small" danger>移除全部</Button>
        </Popconfirm>
      </section>
      <section className={style.list}>
        {annotations.map((annotation, index) => (
          <section
            className={classNames(style.item, {
              [style.selected]: selected === index,
            })}
            key={index}
            onClick={() => onSelect?.(index)}
          >
            <section className="index">{index + 1}</section>
            <section className="content">
              <p>OCR: </p>
              <p>{annotation.ocr}</p>
            </section>
            <section className="footer">
              <span className="status">
                {(!annotation.status || annotation.status === "unprocessed") &&
                  "未处理"}
                {annotation.status === "processing" && "处理中"}
                {annotation.status === "finished" && (
                  <>{annotation.error ? "处理失败" : "已处理"}</>
                )}
              </span>
              <span className="operation">
                <Tooltip title="复制" destroyTooltipOnHide>
                  <SnippetsOutlined
                    style={{ color: "#555" }}
                    onClick={async () =>
                      // copyToClipBoard(
                      //   (annotation.ocr || "").replace(/[\r\n]/g, "")
                      // )
                      // await writeText(
                      //   (annotation.ocr || "").replace(/[\r\n]/g, "")
                      // )
                      console.log()

                    }
                  />
                </Tooltip>
                <Tooltip
                  title={
                    annotation.status === "finished"
                      ? "重试"
                      : annotation.status === "processing"
                        ? "检测中"
                        : "检测"
                  }
                  destroyTooltipOnHide
                >
                  {(annotation.status ?? "unprocessed") === "finished" ? (
                    <SyncOutlined
                      onClick={() => onOCRClick?.(annotation, index)}
                      style={{ color: "#1677ff" }}
                    />
                  ) : (annotation.status ?? "unprocessed") === "unprocessed" ? (
                    <PlayCircleTwoTone
                      onClick={() => onOCRClick?.(annotation, index)}
                      twoToneColor={annotation.error ? "#FF6F00" : "#1677ff"}
                    />
                  ) : (
                    <LoadingOutlined style={{ color: "#1677ff" }} />
                  )}
                </Tooltip>

                <Tooltip title="移除" destroyTooltipOnHide>
                  <DeleteOutlined
                    className={style.deleteBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onRemove?.(index);
                    }}
                    style={{ color: "#FF0000" }}
                  />
                </Tooltip>
              </span>
            </section>
          </section>
        ))}
      </section>
    </section>
  );
};

export default ResultList;
