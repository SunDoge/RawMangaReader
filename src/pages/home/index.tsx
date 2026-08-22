import React, { useCallback, useRef, useState } from "react";
import classNames from "classnames";
import { Button, Dropdown, Empty, MenuProps, message } from "antd";
import style from "./style.module.less";
import { IAnnotationType } from "@/types/annotation";
import ThumbnailList from "@/components/thumbnail-list";
import { AnnotationBlock } from "@/components/annotation-block";
import { zip } from "lodash";
import { naturalSort } from "./utils";
import {
  FileImageOutlined,
  FolderOpenOutlined,
  MenuOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { About } from "@/components/about";
import { areAreasEqual } from "@/utils";
import * as dialog from "@tauri-apps/plugin-dialog";
import * as fs from "@tauri-apps/plugin-fs";

interface IProps {}

export const Home: React.FC<IProps> = (_props) => {
  const [imageList, setImageList] = useState<string[]>([]);
  const [currentSelected, setCurrentSelected] = useState<number>(NaN);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  const annotationMap = useRef<Map<string, IAnnotationType[]>>(new Map());
  const [currentAnnotationList, setCurrentAnnotationList] = useState<
    IAnnotationType[]
  >([]);

  const [messageApi, contextHolder] = message.useMessage();

  // 选择多个图片
  const openImages = useCallback(async () => {
    const selected = await dialog.open({
      multiple: true,
    });

    if (selected === null) {
      return;
    } else if (Array.isArray(selected)) {
      selected.sort(naturalSort);
      setImageList(selected);
    } else {
      setImageList([selected]);
    }
    setCurrentSelected(0);
  }, []);

  // 选择一个文件夹，然后加载文件夹下的所有图片
  const openImageFolder = useCallback(async () => {
    const selected = await dialog.open({
      directory: true,
    });
    if (Array.isArray(selected)) {
      console.log("only one folder can be selected");
    } else if (selected === null) {
      console.log("no folder selected");
    } else {
      const entries = await fs.readDir(selected);
      const images = entries.map((entry) => entry.name);
      setImageList(images);
    }
    setCurrentSelected(0);
  }, []);

  const handleAnnotationListChange = useCallback(
    (list: IAnnotationType[]) => {
      setCurrentAnnotationList(list);
      annotationMap.current.set(imageList[currentSelected], list);

      console.log(
        `length of list ${list.length} and lenght of current ${currentAnnotationList.length}`,
      );
      if (list.length > currentAnnotationList.length) {
        // 增加了item
        list.map((item) => {
          if (item.ocr === undefined) {
            // TODO: 执行某些回调，修改对应item
            console.log("should update this newly added item: ", item);
            handleOCRProcess(item).then((result) => {
              console.log(result);
            });
          }
          return item;
        });
      } else if (list.length === currentAnnotationList.length) {
        // 找到修改的item
        zip(list, currentAnnotationList).map(([newItem, oldItem]) => {
          if (!areAreasEqual(newItem!, oldItem!)) {
            console.log("should update this changed item: ", newItem);
            // handleOCRProcess(newItem!).then((result) => {
            //   console.log(result);
            // })
          }
        });
      }
    },
    [imageList, currentSelected],
  );

  const handleOCRProcess = useCallback(
    async (annotation: IAnnotationType) => {
      const curImagePath = imageList[currentSelected];
      console.debug("OCR is disabled during the Tauri 2 migration", {
        annotation,
        curImagePath,
      });
      messageApi.info("OCR 暂时不可用，正在进行整体重构");
      return {};
    },
    [imageList, currentSelected, messageApi],
  );

  const handleImageSelected = useCallback(
    (index: number) => {
      setCurrentSelected(index);
      setCurrentAnnotationList(
        annotationMap.current.get(imageList[index]) || [],
      );
    },
    [imageList],
  );

  const menuItems: MenuProps["items"] = [
    {
      key: "1",
      label: <a onClick={() => setIsMenuOpen(true)}>关于</a>,
    },
  ];

  // TODO use callback
  const ButtonList = () => {
    return (
      <>
        <Button
          type="primary"
          size="small"
          icon={<UploadOutlined />}
          disabled
        >
          OCR 重构中
        </Button>
        <Button
          type="primary"
          size="small"
          icon={<FileImageOutlined />}
          onClick={openImages}
        >
          加载图片
        </Button>
        <Button
          type="primary"
          size="small"
          icon={<FolderOpenOutlined />}
          onClick={openImageFolder}
        >
          打开文件夹
        </Button>
      </>
    );
  };

  if (!imageList || imageList.length === 0) {
    return (
      <Empty
        className={style.empty}
        description="请加载模型并选择需要加载的图片"
      >
        <section className={style.operation}>
          <ButtonList />
          {/* <Button><Link to={"/clipboard"}>剪贴板模式</Link></Button> */}
        </section>
      </Empty>
    );
  }

  return (
    <section className={classNames(style.home, "home")}>
      {contextHolder}
      <section className={style.header}>
        <div className={style.left}>
          <ButtonList />
        </div>
        <Dropdown
          menu={{ items: menuItems }}
          overlayClassName={style.rightMenu}
        >
          <Button icon={<MenuOutlined />} size="small"></Button>
        </Dropdown>
      </section>
      <section className={style.main}>
        <aside className={style.aside}>
          <ThumbnailList
            imageList={imageList}
            currentIndex={currentSelected}
            onSelected={handleImageSelected}
          />
        </aside>
        <section className={style.operation}>
          <AnnotationBlock
            imageList={imageList}
            currentIndex={currentSelected}
            onSelected={handleImageSelected}
            annotationList={currentAnnotationList || []}
            onAnnotationListChange={handleAnnotationListChange}
            onOCR={handleOCRProcess}
          />
        </section>
      </section>
      <About open={isMenuOpen} setOpen={setIsMenuOpen} />
    </section>
  );
};

export default Home;
