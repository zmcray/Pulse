import Header from "./components/Header.jsx";
import Sidebar from "./components/Sidebar.jsx";
import DailyView from "./views/DailyView.jsx";
import BuildPipelineView from "./views/BuildPipelineView.jsx";
import { useView } from "./contexts/ViewContext.jsx";

export default function App() {
  const { view } = useView();

  if (view === "build") {
    return (
      <div className="h-screen grid grid-rows-[auto_1fr] grid-cols-[1fr] [grid-template-areas:'header''main']">
        <Header />
        <BuildPipelineView />
      </div>
    );
  }

  return (
    <div className="h-screen grid grid-rows-[auto_1fr] grid-cols-[280px_1fr] [grid-template-areas:'header_header''sidebar_main']">
      <Header />
      <Sidebar />
      <DailyView />
    </div>
  );
}
