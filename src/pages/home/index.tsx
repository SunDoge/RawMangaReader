import React, { useCallback, useRef, useState } from "react";
import classNames from "classnames";
import { invoke, dialog, fs } from "@tauri-apps/api";
import { Button, Dropdown, Empty, MenuProps, message } from "antd";
import style from "./style.module.less";
import { IAnnotationType } from "@/types/annotation";
import ThumbnailList from "@/components/thumbnail-list";
import { AnnotationBlock } from "@/components/annotation-block";
import { pick, zip } from "lodash";
import { getErrorMessage, getVocabPath, naturalSort } from "./utils";
import { FileImageOutlined, FolderOpenOutlined, MenuOutlined, UploadOutlined } from "@ant-design/icons";
import { About } from "@/components/about";
import { trackEvent } from "@aptabase/tauri";
import { areAreasEqual } from "@/utils";
import { useTranslation } from "react-i18next";


interface IProps { }

export const Home: React.FC<IProps> = (_props) => {
  const { t } = useTranslation();
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);
  const [modelLoading, setModelLoading] = useState<boolean>(false);
  const [imageList, setImageList] = useState<string[]>([]);
  const [currentSelected, setCurrentSelected] = useState<number>(NaN);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);


  const annotationMap = useRef<Map<string, IAnnotationType[]>>(new Map());
  const [currentAnnotationList, setCurrentAnnotationList] = useState<IAnnotationType[]>([]);

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
      console.log('only one folder can be selected')
    } else if (selected === null) {
      console.log('no folder selected');
    } else {
      const entries = await fs.readDir(selected);
      const images = entries.map((entry) => entry.path);
      setImageList(images);
    }
    setCurrentSelected(0);
  }, []);


  const openModel = useCallback(async () => {
    const selected = await dialog.open({
      multiple: false,
      defaultPath: localStorage.getItem("defaults.lastUsedModelPath") || undefined,
      filters: [
        {
          name: "model file",
          extensions: ['bin', 'onnx']
        }
      ]
    });
    if (selected === null) {
      return;
    } else if (Array.isArray(selected)) {
      return;
    }

    setModelLoading(true);
    try {
      await invoke("model_new", {
        modelPath: selected,
        vocabPath: await getVocabPath(),
      });
      // 保存上次使用的 model path
      localStorage.setItem('defaults.lastUsedModelPath', selected);
      messageApi.success("模型加载成功");
      setModelLoaded(true);
    } catch (error) {
      messageApi.error("模型加载失败");
      trackEvent("open_model", {
        status: "failed",
        error: getErrorMessage(error)
      })
      setModelLoaded(false);
    } finally {
      setModelLoading(false);
    }
    setModelLoaded(true);
  }, []);

  const handleAnnotationListChange = useCallback((list: IAnnotationType[]) => {
    setCurrentAnnotationList(list);
    annotationMap.current.set(imageList[currentSelected], list);

    console.log(`length of list ${list.length} and lenght of current ${currentAnnotationList.length}`)
    if (list.length > currentAnnotationList.length) {
      // 增加了item
      list.map((item) => {
        if (item.ocr === undefined) {
          // TODO: 执行某些回调，修改对应item
          console.log("should update this newly added item: ", item)
          handleOCRProcess(item).then((result) => {
            console.log(result);
          })
        }
        return item;
      })
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

  }, [imageList, currentSelected]);

  const handleOCRProcess = useCallback(async (annotation: IAnnotationType) => {
    const curImagePath = imageList[currentSelected];
    if (!modelLoaded) {
      throw new Error(`MODEL_ERROR`);
    }
    if (annotation.unit === '%') {
      console.log(annotation)
      const bbox = pick(annotation, 'x', 'y', 'width', 'height');
      try {
        const result = await invoke('model_infer', { path: curImagePath, bbox });
        return result as any;
      } catch (e) {
        trackEvent("model_infer", {
          status: "failed",
          error: getErrorMessage(e)
        })
        console.log(e)
      }
    }
    return null as any;
  }, [modelLoaded, imageList, currentSelected]);

  const handleImageSelected = useCallback((index: number) => {
    setCurrentSelected(index);
    setCurrentAnnotationList(annotationMap.current.get(imageList[index]) || []);
  }, [imageList]);





  const menuItems: MenuProps["items"] = [
    {
      key: "1",
      label: (
        <a onClick={() => setIsMenuOpen(true)}>关于</a>
      )
    }
  ]

  // TODO use callback
  const ButtonList = () => {
    return (
      <>
        <Button
          type="primary"
          size="small"
          icon={<UploadOutlined />}
          onClick={openModel}
          loading={modelLoading}
          danger={modelLoaded}
        >
          {modelLoaded ? t("changeModel") : t("loadModel")}
        </Button>
        <Button type="primary" size="small" icon={<FileImageOutlined />} onClick={openImages}>
          加载图片
        </Button>
        <Button type="primary" size="small" icon={<FolderOpenOutlined />} onClick={openImageFolder}>
          打开文件夹
        </Button>
      </>
    )
  }


  if ((!imageList || imageList.length === 0)) {
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
    )
  }

  return (
    <section className={classNames(style.home, "home")}>
      {contextHolder}
      <section className={style.header}>
        <div className={style.left}>
          <ButtonList />
        </div>
        <Dropdown menu={{ items: menuItems }} overlayClassName={style.rightMenu}>
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
