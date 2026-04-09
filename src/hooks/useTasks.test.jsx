// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import TasksProvider from "./useTasks.jsx";
import {
  useTasksState,
  useTasksDispatch,
} from "../contexts/TasksContext.jsx";

/**
 * THE RACE CONDITION FIX:
 *
 * Without the pending-writes Set, this scenario causes a "flash back" bug:
 *   1. User toggles task to "Done" (optimistic update)
 *   2. Notion write is in flight, takes ~500ms
 *   3. Auto-refresh fires, fetches /api/tasks
 *   4. Server returns OLD data (Notion hasn't ack'd yet)
 *   5. setTasks(serverData) overwrites the optimistic Done state
 *   6. UI flashes back to "Not started"
 *
 * The fix: track in-flight task IDs in a Set. When the auto-refresh merge
 * happens, skip merging any task in the Set -- preserve local state for
 * those tasks instead.
 *
 * This test verifies that the fix prevents the flash-back.
 */

const mockFetchTasks = vi.fn();
const mockUpdateTask = vi.fn();

vi.mock("../utils/api.js", () => ({
  fetchTasks: () => mockFetchTasks(),
  updateTask: (id, updates) => mockUpdateTask(id, updates),
  fetchCalendar: () => Promise.resolve({ workblocks: [], calls: [] }),
}));

beforeEach(() => {
  mockFetchTasks.mockReset();
  mockUpdateTask.mockReset();
});

function TestConsumer() {
  const { tasks, loading } = useTasksState();
  const { updateStatus, refreshTasks } = useTasksDispatch();
  if (loading) return <div>loading</div>;
  return (
    <div>
      {tasks.map((t) => (
        <div key={t.id} data-testid={`task-${t.id}`}>
          {t.id}: {t.status}
        </div>
      ))}
      <button
        onClick={() => updateStatus("t1", "Done")}
        data-testid="toggle"
      />
      <button onClick={refreshTasks} data-testid="refresh" />
    </div>
  );
}

describe("auto-refresh race condition fix", () => {
  it("preserves optimistic update when refresh fires during in-flight write", async () => {
    // Initial fetch returns t1 in "Not started"
    mockFetchTasks.mockResolvedValueOnce([
      { id: "t1", title: "Test", status: "Not started" },
    ]);

    // Make the Notion write deferrable so we can race it
    let resolveWrite;
    const writePromise = new Promise((r) => {
      resolveWrite = r;
    });
    mockUpdateTask.mockReturnValue(writePromise);

    render(
      <TasksProvider>
        <TestConsumer />
      </TasksProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("task-t1")).toHaveTextContent("Not started"),
    );

    // User toggles to Done -- optimistic update fires immediately
    await act(async () => {
      screen.getByTestId("toggle").click();
    });

    // Local state is now "Done" optimistically
    expect(screen.getByTestId("task-t1")).toHaveTextContent("Done");

    // Now the auto-refresh fires while updateTask is still pending.
    // Server returns OLD state ("Not started") because Notion hasn't ack'd.
    mockFetchTasks.mockResolvedValueOnce([
      { id: "t1", title: "Test", status: "Not started" },
    ]);

    await act(async () => {
      screen.getByTestId("refresh").click();
    });

    // CRITICAL: task should STILL be "Done" because t1 is in pending-writes Set
    expect(screen.getByTestId("task-t1")).toHaveTextContent("Done");

    // Now the write completes -- pending Set is cleared
    await act(async () => {
      resolveWrite({});
      await writePromise;
    });

    // Subsequent refresh now sees the real state from server
    mockFetchTasks.mockResolvedValueOnce([
      { id: "t1", title: "Test", status: "Done" },
    ]);
    await act(async () => {
      screen.getByTestId("refresh").click();
    });

    expect(screen.getByTestId("task-t1")).toHaveTextContent("Done");
  });

  it("does NOT preserve optimistic state for tasks that are NOT pending", async () => {
    mockFetchTasks.mockResolvedValueOnce([
      { id: "t1", title: "A", status: "Not started" },
      { id: "t2", title: "B", status: "Not started" },
    ]);

    let resolveWrite;
    mockUpdateTask.mockReturnValue(new Promise((r) => (resolveWrite = r)));

    render(
      <TasksProvider>
        <TestConsumer />
      </TasksProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("task-t1")).toBeInTheDocument(),
    );

    // Toggle t1 only
    await act(async () => {
      screen.getByTestId("toggle").click();
    });

    // Auto-refresh fires. Server returns NEW state for t2 (came in from elsewhere)
    mockFetchTasks.mockResolvedValueOnce([
      { id: "t1", title: "A", status: "Not started" }, // server lag
      { id: "t2", title: "B", status: "In progress" }, // updated elsewhere
    ]);

    await act(async () => {
      screen.getByTestId("refresh").click();
    });

    // t1 should preserve optimistic Done (in pending Set)
    expect(screen.getByTestId("task-t1")).toHaveTextContent("Done");
    // t2 should reflect server update (not in pending Set)
    expect(screen.getByTestId("task-t2")).toHaveTextContent("In progress");

    resolveWrite({});
  });
});
