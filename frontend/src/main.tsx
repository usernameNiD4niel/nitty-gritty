import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { CreateTemplatePage } from "./pages/templates/CreateTemplatePage";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/templates/create" element={<CreateTemplatePage />} />
        <Route path="*" element={<Navigate to="/templates/create" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
