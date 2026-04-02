import { useState } from "react";
import { useTasksDispatch } from "../contexts/TasksContext.jsx";
import useAutoSave from "../hooks/useAutoSave.js";

export default function InlineNotes({ taskId, initialNotes }) {
  const [value, setValue] = useState(initialNotes);
  const { updateNotes } = useTasksDispatch();

  const save = useAutoSave(value, (val) => updateNotes(taskId, val));

  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save.flush}
      onClick={(e) => e.stopPropagation()}
      placeholder="Add notes..."
      rows={1}
      className="w-full text-[11px] text-text-muted bg-transparent border-0 border-b border-transparent focus:border-border-2 outline-none resize-none placeholder:text-text-muted/40 transition-colors py-0.5"
    />
  );
}
