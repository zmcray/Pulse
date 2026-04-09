import { describe, it, expect } from "vitest";
import {
  findCurrentWorkblock,
  minutesRemaining,
  normalizeWorkblockName,
  formatTimeRange,
} from "./calendarHelpers.js";

function at(hh, mm) {
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d;
}

const workblocks = [
  { name: "Morning Launch", start: "08:30", end: "08:45", order: 0 },
  { name: "PE Learning", start: "08:45", end: "09:30", order: 1 },
  { name: "AI-Building", start: "10:15", end: "12:30", order: 2 },
];

describe("findCurrentWorkblock", () => {
  it("returns the workblock the user is currently in", () => {
    expect(findCurrentWorkblock(workblocks, at(10, 45))?.name).toBe(
      "AI-Building",
    );
  });

  it("returns the first block at exact start time", () => {
    expect(findCurrentWorkblock(workblocks, at(8, 30))?.name).toBe(
      "Morning Launch",
    );
  });

  it("returns the next block at exact end time of previous (boundary)", () => {
    // 08:45 is end of Morning Launch and start of PE Learning -- next wins
    expect(findCurrentWorkblock(workblocks, at(8, 45))?.name).toBe(
      "PE Learning",
    );
  });

  it("returns null when between blocks", () => {
    // 09:45 -- after PE Learning ends, before AI-Building starts
    expect(findCurrentWorkblock(workblocks, at(9, 45))).toBe(null);
  });

  it("returns null when before all blocks", () => {
    expect(findCurrentWorkblock(workblocks, at(7, 0))).toBe(null);
  });

  it("returns null when after all blocks", () => {
    expect(findCurrentWorkblock(workblocks, at(15, 0))).toBe(null);
  });

  it("returns null for empty workblocks array", () => {
    expect(findCurrentWorkblock([], at(10, 0))).toBe(null);
  });

  it("returns null for null/undefined input", () => {
    expect(findCurrentWorkblock(null, at(10, 0))).toBe(null);
    expect(findCurrentWorkblock(undefined, at(10, 0))).toBe(null);
  });
});

describe("minutesRemaining", () => {
  it("computes minutes left in middle of block", () => {
    expect(minutesRemaining({ end: "12:30" }, at(11, 45))).toBe(45);
  });

  it("returns 0 at exact end time", () => {
    expect(minutesRemaining({ end: "12:30" }, at(12, 30))).toBe(0);
  });

  it("returns negative when past end (caller filters)", () => {
    expect(minutesRemaining({ end: "12:30" }, at(13, 0))).toBe(-30);
  });

  it("returns null for null workblock", () => {
    expect(minutesRemaining(null, at(10, 0))).toBe(null);
  });
});

describe("normalizeWorkblockName", () => {
  it("migrates AI-Learning to AI Intelligence", () => {
    expect(normalizeWorkblockName("AI-Learning")).toBe("AI Intelligence");
  });

  it("migrates PE Networking to Business Development", () => {
    expect(normalizeWorkblockName("PE Networking")).toBe(
      "Business Development",
    );
  });

  it("passes through current names unchanged", () => {
    expect(normalizeWorkblockName("AI-Building")).toBe("AI-Building");
    expect(normalizeWorkblockName("Strategy")).toBe("Strategy");
  });

  it("handles null/undefined gracefully", () => {
    expect(normalizeWorkblockName(null)).toBe(null);
    expect(normalizeWorkblockName(undefined)).toBe(undefined);
  });
});

describe("formatTimeRange", () => {
  it("formats AM range with shared suffix", () => {
    expect(formatTimeRange("08:30", "08:45")).toBe("8:30 - 8:45 AM");
  });

  it("formats PM range with shared suffix", () => {
    expect(formatTimeRange("14:00", "15:30")).toBe("2:00 - 3:30 PM");
  });

  it("formats range crossing noon with both suffixes", () => {
    expect(formatTimeRange("11:30", "12:30")).toBe("11:30 AM - 12:30 PM");
  });

  it("handles missing inputs", () => {
    expect(formatTimeRange(null, "10:00")).toBe("");
    expect(formatTimeRange("10:00", null)).toBe("");
  });
});
