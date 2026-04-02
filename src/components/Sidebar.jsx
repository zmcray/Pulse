import { useState } from "react";

function AdHocItem({ text }) {
  const [checked, setChecked] = useState(false);

  return (
    <div
      onClick={() => setChecked(!checked)}
      className={`flex items-start gap-[7px] py-[5px] px-2 rounded-md cursor-pointer transition-colors hover:bg-surface-2 ${
        checked ? "opacity-60" : ""
      }`}
    >
      <div
        className={`w-3.5 h-3.5 rounded-[3px] border-[1.5px] flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
          checked ? "bg-green border-green" : "bg-surface-card border-border"
        }`}
      >
        {checked && (
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
        className={`text-xs leading-snug ${
          checked
            ? "text-text-muted line-through"
            : "text-text-primary"
        }`}
      >
        {text}
      </span>
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="[grid-area:sidebar] border-r border-border overflow-y-auto py-5 px-4 flex flex-col gap-5 bg-surface">
      {/* Calls */}
      <div>
        <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-text-muted mb-2">
          Calls
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="bg-surface-card border border-border-2 rounded-lg px-2.5 py-2">
            <div className="text-[11px] font-semibold text-accent mb-0.5">
              12:30 PM ET
            </div>
            <div className="font-medium text-[12.5px]">David Neighbours</div>
            <div className="text-[11px] text-text-muted mt-0.5">
              30 min. Intro via Tim Lower.
            </div>
            <div className="mt-1">
              <span className="inline-block text-[10px] font-semibold px-[5px] py-px rounded bg-[#e8f4ff] text-blue">
                Calendar
              </span>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-text-muted/60 mt-2 px-1 italic">
          Google Calendar integration coming in Phase 2
        </p>
      </div>

      {/* Priority Stack */}
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
        <div className="flex flex-col gap-0.5">
          <AdHocItem text="Reply to Earl Johnson re: follow-up meeting" />
          <AdHocItem text="Send Amy the case study outline" />
          <AdHocItem text="File McRayGroup LLC paperwork" />
        </div>
        <p className="text-[10px] text-text-muted/60 mt-2 px-1 italic">
          Local only. Not synced to Notion.
        </p>
      </div>
    </aside>
  );
}
