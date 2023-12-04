import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as zh_CN from "../i18n/zh-CN.json"

i18n
    .use(initReactI18next)
    .init({
        resources: {
            'zh-CN': {
                translation: zh_CN
            }
        },
        lng: "zh-CN",
        fallbackLng: "en-US",
        interpolation: {
            escapeValue: false,
        }
    });

export default i18n;