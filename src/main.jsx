import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TasksProvider } from "./contexts/TasksContext.jsx";
import { CalendarProvider } from "./contexts/CalendarContext.jsx";
import { ViewProvider } from "./contexts/ViewContext.jsx";
import BuildPipelineProvider from "./hooks/useBuildPipeline.jsx";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ViewProvider>
      <CalendarProvider>
        <TasksProvider>
          <BuildPipelineProvider>
            <App />
          </BuildPipelineProvider>
        </TasksProvider>
      </CalendarProvider>
    </ViewProvider>
  </StrictMode>,
);
