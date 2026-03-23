import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, App as AntApp } from "antd";
import App from "./App";
import "./styles/rs-theme.css";
import "./styles/components/Pipeline.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: "#e74c3c",
            borderRadius: 6,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          },
        }}
      >
        <AntApp>
          <div className="rs-theme">
            <App />
          </div>
        </AntApp>
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>
);
