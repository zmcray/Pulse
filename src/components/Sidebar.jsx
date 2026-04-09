import { useState } from "react";
import { useCalendarState } from "../contexts/CalendarContext.jsx";
import { useAdHoc } from "../hooks/useAdHoc.js";
import { formatTimeRange } from "../utils/calendarHelpers.js";

function AdHocItem({ item, onToggle, onRemove }) {
  return (
    <div
      onClick={() => onToggle(item.id)}
      className={`flex items-start gap-[7px] py-[5px] px-2 rounded-md cursor-pointer transition-colors hover:bg-surface-2 group ${
        item.checked ? "opacity-60" : ""
      }`}
    >
      <div
        className={`w-3.5 h-3.5 rounded-[3px] border-[1.5px] flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
          item.checked ? "bg-green border-green" : "bg-surface-card border-border"
        }`}
      >
        {item.checked && (
          <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
            <path
              d="M1 2.5L2.5 4L6 1"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span
        className={`text-xs leading-snug flex-1 ${
          item.checked
            ? "text-text-muted line-through"
            : "text-text-primary"
        }`}
      >
        {item.text}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(item.id);
        }}
        className="text-[10px] text-text-muted hover:text-red opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove"
        aria-label="Remove ad hoc item"
      >
        ✕
      </button>
    </div>
  );
}

function CallCard({ call }) {
  return (
    <div className="bg-surface-card border border-border-2 rounded-lg px-2.5 py-2">
      <div className="text-[11px] font-semibold text-accent mb-0.5">
        {formatTimeRange(call.start, call.end)}
      </div>
      <div className="font-medium text-[12.5px]">{call.title}</div>
      {call.attendees && call.attendees.length > 0 && (
        <div className="text-[11px] text-text-muted mt-0.5">
          {call.attendees.length} attendee{call.attendees.length === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { calls } = useCalendarState();
  const { items, addItem, toggleItem, removeItem } = useAdHoc();
  const [newItemText, setNewItemText] = useState("");

  function handleAdd(e) {
    e.preventDefault();
    if (newItemText.trim()) {
      addItem(newItemText);
      setNewItemText("");
    }
  }

  return (
    <aside className="[grid-area:sidebar] border-r border-border overflow-y-auto py-5 px-4 flex flex-col gap-5 bg-surface">
      {/* Calls */}
      <div>
        <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-text-muted mb-2">
          Calls
        </div>
        {calls && calls.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {calls.map((call, i) => (
              <CallCard key={`${call.start}-${i}`} call={call} />
            ))}
          </div>
        ) : (
          <p className="text-[10.5px] text-text-muted/60 italic px-1">
            No calls today
          </p>
        )}
      </div>

      {/* Priority Stack -- still hardcoded for Phase 2 (P3 deferred) */}
      <div>
        <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-text-muted mb-2">
          Priority Stack
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="bg-surface-card border border-border-2 rounded-lg px-2.5 py-2 border-l-[3px] border-l-red">
            <div className="font-medium text-[12.5px] leading-snug">
              Tim Lower intro follow-ups{" "}
              <span className="inline-block bg-[#fef1ee] text-red rounded px-[5px] py-px text-[10px] font-semibold ml-1">
                10 days
              </span>
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">
              4 intros: Lauren/Trivest, Camillo/HIG, Eion Hu, Dave Neighbors
            </div>
          </div>
          <div className="bg-surface-card border border-border-2 rounded-lg px-2.5 py-2 border-l-[3px] border-l-border">
            <div className="font-medium text-[12.5px] leading-snug">
              Inference cost talking points{" "}
              <span className="inline-block bg-[#fef8ec] text-[#b07000] rounded px-[5px] py-px text-[10px] font-semibold ml-1">
                ↻ 1
              </span>
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">
              Carry-over from yesterday. In Strategy block.
            </div>
          </div>
        </div>
      </div>

      {/* Ad Hoc */}
      <div>
        <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-text-muted mb-2">
          Ad Hoc
        </div>
        <div className="flex flex-col gap-0.5 mb-2">
          {items.map((item) => (
            <AdHocItem
              key={item.id}
              item={item}
              onToggle={toggleItem}
              onRemove={removeItem}
            />
          ))}
        </div>
        <form onSubmit={handleAdd}>
          <input
            type="text"
            placeholder="Add ad hoc..."
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            className="text-xs px-2 py-1 rounded-md border border-border bg-surface-card focus:border-text-muted focus:outline-none w-full"
          />
        </form>
      </div>
    </aside>
  );
}
