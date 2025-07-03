import React, { useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import classNames from "classnames";
import style from "./style.module.less";

export interface IThumbnailListProps {
  imageList: string[];
  currentIndex: number;
  onSelected: (index: number) => void;
}

export const ThumbnailList: React.FC<IThumbnailListProps> = (props) => {
  const { imageList, currentIndex, onSelected } = props;

  useEffect(() => {
    document.querySelector(`.${style.selected}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [currentIndex]);

  return (
    <section className={style.list}>
      {imageList.map((imagePath, index) => (
        <div
          className={classNames(style.thumbnail, {
            [style.selected]: index === currentIndex
          }) }
          key={index}
          onClick={() => onSelected(index)}
        >
          <img src={convertFileSrc(imagePath)} alt="" />
          <section className={style.indicator}> {index + 1} </section>
        </div>
      ))}
    </section>
  );
};

export default ThumbnailList;
