import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TasksProvider } from "./contexts/TasksContext.jsx";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <TasksProvider>
      <App />
    </TasksProvider>
  </StrictMode>,
);
