import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TasksProvider } from "./contexts/TasksContext.jsx";
import { CalendarProvider } from "./contexts/CalendarContext.jsx";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CalendarProvider>
      <TasksProvider>
        <App />
      </TasksProvider>
    </CalendarProvider>
  </StrictMode>,
);
