import React, { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { IMAGE_CHANGED, listenToClipboard } from "tauri-plugin-clipboard-api";
import { invoke } from "@tauri-apps/api";
import { Button, List, Switch } from "antd";
import { Link } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { appWindow } from "@tauri-apps/api/window"

type Result = {
    id: string,
    eventId: number,
    imageBuffer: string // base64,
    ocrText: string,
}

type ClipboardImageEvent = {
    id: number,
    payload: {
        value: string
    }
}

export const ClipboardPage: React.FC<{}> = (_props) => {


    const [unlisten, setUnlisten] = useState(() => () => { })
    const [results, setResults] = useState<Result[]>([]);

    const listenClipboard = async () => {
        const u1 = await listen(IMAGE_CHANGED, (event: ClipboardImageEvent) => {
            console.log(event);
            const resultId = uuidv4();
            const imageBuffer = event.payload.value;
            const eventId = event.id;
            setResults((results) => {
                const result = {
                    id: resultId,
                    eventId: eventId,
                    imageBuffer: imageBuffer,
                    ocrText: "",
                };
                return [result, ...results];
            })

            invoke<string>("model_infer_base64", {
                imageBuffer: imageBuffer,
            }).then((text) => {
                console.log(text);
                setResults((results) => results.map((result) => {
                    if (result.id === resultId) {
                        result.ocrText = text;
                    }
                    return result;
                }))
            })
        });
        const u2 = await listenToClipboard();
        console.log('listen to clipboard');

        return () => {
            u1(); u2();
            console.log('unlisten to clipboard')
        }
    }

    // 注册一个unlisten上去
    useEffect(() => unlisten, [])

    const handleListen = (checked: boolean) => {
        if (checked) {
            listenClipboard().then((u) => {
                setUnlisten(() => u);
            })
        } else {
            unlisten();
        }
    }

    return (
        <div>
            <Button><Link to={"/home"}>Back</Link></Button>
            <Switch checkedChildren="监听剪贴板" unCheckedChildren="开启监听剪贴板" onChange={handleListen}></Switch>
            <Switch unCheckedChildren="always on top"
                onChange={(checked) => appWindow.setAlwaysOnTop(checked)}
            />
            <List
                itemLayout="horizontal"
                dataSource={results}
                renderItem={(item) => (
                    <List.Item>
                        <img style={{
                            height: "200px",
                        }} src={`data:image/png;base64,${item.imageBuffer}`} alt="" />
                        <p>OCR: {item.ocrText}</p>
                    </List.Item>
                )}
            />
        </div>
    )
}

