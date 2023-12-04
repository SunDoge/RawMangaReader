import { getName, getVersion } from "@tauri-apps/api/app";
import { Modal } from "antd";
import React, { useEffect, useState } from "react";
import style from './style.module.less';



interface IAboutProps {
    open: boolean,
    setOpen: (open: boolean) => void
}

export const About: React.FC<IAboutProps> = (props) => {
    const { open, setOpen } = props;

    const [appName, setAppName] = useState<string>("");
    const [appVersion, setAppVersion] = useState<string>("");

    useEffect(() => {
        getName().then((name) => setAppName(name));
        getVersion().then((version) => setAppVersion(version));
    }, []);

    return (
        <Modal title="关于" open={open} onCancel={() => setOpen(false)} footer={null} centered wrapClassName={style.dialogWrapper}>
            <h2>{appName}</h2>
            <p>版本：{appVersion}</p>
            <p>作者：<a href="https://github.com/SunDoge" target="__blank">@SunDoge</a>, <a>@Noname</a></p>
            <p><a href="https://github.com/SunDoge/RawMangaReader/issues" target="__blank">问题反馈</a></p>
            <p>Copyright © 2023 SunDoge All rights reserved.</p>
        </Modal>
    )
}

