import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./styles.css";
import { attachConsole, info } from "@tauri-apps/plugin-log";

attachConsole()
  .then(() => {
    info("attached");
  })
  .catch((e: unknown) => {
    console.log("fail to attach", e);
  });

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
