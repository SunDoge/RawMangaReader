import React from "react";
import { Button, Result } from "antd";
import { Link } from "react-router-dom";

export const ClipboardPage: React.FC<{}> = (_props) => {
  return (
    <Result
      status="info"
      title="剪贴板模式重构中"
      subTitle="旧版剪贴板插件已在 Tauri 2 迁移期间停用。"
      extra={<Button><Link to="/">返回首页</Link></Button>}
    />
  );
};
