import TaskRow from "./TaskRow.jsx";

const WORKSTREAM_COLORS = {
  "Forge Reps": "bg-[#e8f0fb] text-[#2c5fa3]",
  "Concept Cards": "bg-[#e8f0fb] text-[#2c5fa3]",
  "Verbal Fluency": "bg-[#e8f0fb] text-[#2c5fa3]",
  "Signal Synthesis": "bg-[#f0ebfb] text-[#5c3da8]",
  "Thesis Pressure-Testing": "bg-[#f0ebfb] text-[#5c3da8]",
  "Roadmap Planning": "bg-[#f0ebfb] text-[#5c3da8]",
  "CRM Review & Outreach": "bg-[#fef1e8] text-[#a0521c]",
  "Call Prep/Debrief": "bg-[#fef1e8] text-[#a0521c]",
  "Network Mapping": "bg-[#fef1e8] text-[#a0521c]",
  "Company Formation": "bg-[#fef3e2] text-[#a06010]",
  "Go-to-Market": "bg-[#fef3e2] text-[#a06010]",
  "Case Study Work": "bg-[#fef3e2] text-[#a06010]",
  "Productization": "bg-[#fef3e2] text-[#a06010]",
  "Content": "bg-[#fef3e2] text-[#a06010]",
  "System Health": "bg-[#f0f0ee] text-[#505050]",
  "Skill Refinement": "bg-[#f0f0ee] text-[#505050]",
  "Feedback & Memory": "bg-[#f0f0ee] text-[#505050]",
  "Web Development": "bg-[#e8f4f4] text-[#2a6b6b]",
  "App Development": "bg-[#e8f4f4] text-[#2a6b6b]",
  "Agents": "bg-[#e8f4f4] text-[#2a6b6b]",
  "Automation & APIs": "bg-[#e8f4f4] text-[#2a6b6b]",
  "Cowork": "bg-[#e8f4f4] text-[#2a6b6b]",
  "Core Stack": "bg-[#e8f4f4] text-[#2a6b6b]",
};

function getWorkstreamColor(ws) {
  return WORKSTREAM_COLORS[ws] || "bg-surface-2 text-text-muted";
}

function getUniqueWorkstreams(tasks) {
  const seen = new Set();
  return tasks
    .map((t) => t.workstream)
    .filter((ws) => {
      if (!ws || seen.has(ws)) return false;
      seen.add(ws);
      return true;
    });
}

export default function WorkblockGroup({ workblock, tasks }) {
  const workstreams = getUniqueWorkstreams(tasks);

  return (
    <div className="flex gap-0 items-start relative pb-4">
      {/* Timeline dot */}
      <div className="flex-shrink-0 mt-[18px] z-10">
        <div className="w-2.5 h-2.5 rounded-full bg-surface-card border-2 border-border" />
      </div>

      {/* Block card */}
      <div className="flex-1 ml-3.5 bg-surface-card border border-border-2 rounded-[10px] px-4 py-3.5 hover:border-text-muted hover:shadow-sm transition-all">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="font-semibold text-sm tracking-tight">
            {workblock}
          </span>
          {workstreams.map((ws) => (
            <span
              key={ws}
              className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full ${getWorkstreamColor(ws)}`}
            >
              {ws}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      </div>
    </div>
  );
}
