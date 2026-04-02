import TaskRow from "./TaskRow.jsx";

export default function WorkblockGroup({ workblock, tasks }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 px-1">
        {workblock}
      </h2>
      <div className="space-y-1">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>
    </section>
  );
}
