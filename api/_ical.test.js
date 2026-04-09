import { describe, it, expect } from "vitest";
import { categorizeEvents, parseEvents } from "./_ical.js";

/**
 * Test fixture: synthetic events spanning all 5 categorization branches.
 * Times here are simple Date objects -- categorizeEvents only uses
 * .title, .start, .end, .attendees so we don't need real .ics text.
 */
function makeEvent({ title, start = "10:00", end = "10:30", attendees = [] }) {
  return {
    title,
    start: new Date(`2026-04-08T${start}:00-04:00`),
    end: new Date(`2026-04-08T${end}:00-04:00`),
    attendees,
  };
}

describe("categorizeEvents", () => {
  it("BRANCH 1: title matches workblock name -> WORKBLOCK", () => {
    const events = [makeEvent({ title: "AI-Building", start: "10:15", end: "12:30" })];
    const result = categorizeEvents(events);
    expect(result.workblocks).toHaveLength(1);
    expect(result.workblocks[0].name).toBe("AI-Building");
    expect(result.calls).toHaveLength(0);
  });

  it("matches workblock name case-insensitively (normalized)", () => {
    const events = [makeEvent({ title: "ai-building" })];
    expect(categorizeEvents(events).workblocks).toHaveLength(1);
  });

  it("BRANCH 2: title contains 'Call' -> CALL", () => {
    const events = [makeEvent({ title: "Call: David Neighbours" })];
    const result = categorizeEvents(events);
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0].title).toBe("Call: David Neighbours");
    expect(result.workblocks).toHaveLength(0);
  });

  it("BRANCH 3: has attendees -> CALL (even without 'Call' keyword)", () => {
    const events = [
      makeEvent({
        title: "Strategy session with Tim",
        attendees: ["tim@example.com"],
      }),
    ];
    const result = categorizeEvents(events);
    expect(result.calls).toHaveLength(1);
    expect(result.workblocks).toHaveLength(0);
  });

  it("BRANCH 4: title matches denylist -> FILTERED", () => {
    const events = [
      makeEvent({ title: "Lunch with Jamie" }),
      makeEvent({ title: "Family time" }),
      makeEvent({ title: "Doctor appointment" }),
      makeEvent({ title: "Workout" }),
    ];
    const result = categorizeEvents(events);
    expect(result.workblocks).toHaveLength(0);
    expect(result.calls).toHaveLength(0);
  });

  it("BRANCH 5: default unknown event -> CALL (informal meeting fallback)", () => {
    const events = [makeEvent({ title: "Random unspecified meeting" })];
    const result = categorizeEvents(events);
    expect(result.calls).toHaveLength(1);
  });

  it("workblocks are sorted by start time and assigned order", () => {
    const events = [
      makeEvent({ title: "AI-Building", start: "10:15", end: "12:30" }),
      makeEvent({ title: "Morning Launch", start: "08:30", end: "08:45" }),
      makeEvent({ title: "PE Learning", start: "08:45", end: "09:30" }),
    ];
    const result = categorizeEvents(events);
    expect(result.workblocks.map((w) => w.name)).toEqual([
      "Morning Launch",
      "PE Learning",
      "AI-Building",
    ]);
    expect(result.workblocks.map((w) => w.order)).toEqual([0, 1, 2]);
  });

  it("calls are sorted by start time", () => {
    const events = [
      makeEvent({ title: "Call: B", start: "14:00" }),
      makeEvent({ title: "Call: A", start: "10:00" }),
    ];
    const result = categorizeEvents(events);
    expect(result.calls.map((c) => c.title)).toEqual(["Call: A", "Call: B"]);
  });

  it("denylist is case-insensitive", () => {
    const events = [makeEvent({ title: "LUNCH break" })];
    expect(categorizeEvents(events).calls).toHaveLength(0);
  });

  it("returns empty arrays for empty input", () => {
    expect(categorizeEvents([])).toEqual({ workblocks: [], calls: [] });
  });
});

describe("parseEvents", () => {
  it("returns empty array for null/empty input", () => {
    expect(parseEvents(null)).toEqual([]);
    expect(parseEvents("")).toEqual([]);
  });

  it("returns empty array for malformed ics", () => {
    expect(parseEvents("this is not ics")).toEqual([]);
  });
});
