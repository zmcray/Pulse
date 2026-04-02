import { useState, useRef, useEffect } from "react";
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
      placeholder="Add notes..."
      rows={1}
      className="mt-1.5 w-full text-xs text-text-secondary bg-transparent border-0 border-b border-transparent focus:border-border-light outline-none resize-none placeholder:text-text-muted/50 transition-colors"
    />
  );
}
