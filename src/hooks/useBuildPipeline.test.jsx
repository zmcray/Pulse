// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import BuildPipelineProvider from "./useBuildPipeline.jsx";
import {
  useBuildPipelineState,
  useBuildPipelineDispatch,
} from "../contexts/BuildPipelineContext.jsx";
import { ViewProvider } from "../contexts/ViewContext.jsx";

// jsdom's default localStorage is unreliable across vitest versions — install
// a minimal in-memory polyfill so .getItem/.setItem/.removeItem behave.
function installLocalStorage() {
  const storage = new Map();
  const stub = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear(),
    get length() { return storage.size; },
    key: (i) => Array.from(storage.keys())[i] || null,
  };
  Object.defineProperty(window, "localStorage", { value: stub, writable: true, configurable: true });
}

const mockFetchPipeline = vi.fn();

vi.mock("../utils/api.js", () => ({
  fetchPipeline: (opts) => mockFetchPipeline(opts),
}));

// useAutoRefresh sets up a setInterval — stub it so tests don't tick at 5min cadence.
vi.mock("./useAutoRefresh.js", () => ({
  useAutoRefresh: () => {},
}));

beforeEach(() => {
  installLocalStorage();
  mockFetchPipeline.mockReset();
});

function makeOk(projects = [], issues = []) {
  return {
    projects,
    issues,
    fetchedAt: Date.now(),
    cacheHit: false,
    stale: false,
    error: null,
  };
}

function StateProbe() {
  const state = useBuildPipelineState();
  const { refresh, setExpandedCardId, setFilter } = useBuildPipelineDispatch();
  return (
    <div>
      <div data-testid="loading">{String(state.loading)}</div>
      <div data-testid="error">{state.error || ""}</div>
      <div data-testid="count">{state.projects.length}</div>
      <div data-testid="expanded">{state.expandedCardId || ""}</div>
      <div data-testid="filter">{`${state.filter.type}:${state.filter.value || ""}`}</div>
      <button data-testid="refresh" onClick={refresh} />
      <button
        data-testid="expand-p1"
        onClick={() => setExpandedCardId("p1")}
      />
      <button
        data-testid="set-filter"
        onClick={() => setFilter({ type: "owner", value: "Z" })}
      />
    </div>
  );
}

function renderWithView(initialView) {
  // Seed before render — ViewProvider reads localStorage in its initializer.
  window.localStorage.setItem("pulse:active-view", initialView);
  return render(
    <ViewProvider>
      <BuildPipelineProvider>
        <StateProbe />
      </BuildPipelineProvider>
    </ViewProvider>,
  );
}

describe("useBuildPipeline", () => {
  it("does NOT fetch when view is daily", async () => {
    mockFetchPipeline.mockResolvedValue(makeOk());
    renderWithView("daily");
    await new Promise((r) => setTimeout(r, 20));
    expect(mockFetchPipeline).not.toHaveBeenCalled();
  });

  it("fetches once when view starts as build", async () => {
    mockFetchPipeline.mockResolvedValue(
      makeOk([{ id: "p1", name: "P", stage: "Building" }]),
    );
    renderWithView("build");
    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1");
    });
    expect(mockFetchPipeline).toHaveBeenCalledWith({ fresh: false });
  });

  it("refresh() forces fresh: true", async () => {
    mockFetchPipeline.mockResolvedValue(makeOk());
    renderWithView("build");
    await waitFor(() =>
      expect(mockFetchPipeline).toHaveBeenCalledTimes(1),
    );
    await act(async () => {
      screen.getByTestId("refresh").click();
    });
    await waitFor(() =>
      expect(mockFetchPipeline).toHaveBeenCalledTimes(2),
    );
    expect(mockFetchPipeline.mock.calls[1][0]).toEqual({ fresh: true });
  });

  it("captures error on failed fetch", async () => {
    mockFetchPipeline.mockRejectedValue(new Error("boom"));
    renderWithView("build");
    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toBe("boom");
    });
  });

  it("preserves expandedCardId across refresh when project still present", async () => {
    mockFetchPipeline.mockResolvedValue(
      makeOk([
        { id: "p1", name: "P1", stage: "Building" },
        { id: "p2", name: "P2", stage: "Idea" },
      ]),
    );
    renderWithView("build");
    await waitFor(() =>
      expect(screen.getByTestId("count").textContent).toBe("2"),
    );

    await act(async () => {
      screen.getByTestId("expand-p1").click();
    });
    expect(screen.getByTestId("expanded").textContent).toBe("p1");

    await act(async () => {
      screen.getByTestId("refresh").click();
    });
    await waitFor(() =>
      expect(mockFetchPipeline).toHaveBeenCalledTimes(2),
    );
    expect(screen.getByTestId("expanded").textContent).toBe("p1");
  });

  it("resets expandedCardId when expanded project no longer in payload", async () => {
    mockFetchPipeline.mockResolvedValueOnce(
      makeOk([{ id: "p1", name: "P1", stage: "Building" }]),
    );
    renderWithView("build");
    await waitFor(() =>
      expect(screen.getByTestId("count").textContent).toBe("1"),
    );

    await act(async () => {
      screen.getByTestId("expand-p1").click();
    });
    expect(screen.getByTestId("expanded").textContent).toBe("p1");

    mockFetchPipeline.mockResolvedValueOnce(
      makeOk([{ id: "p2", name: "P2", stage: "Idea" }]),
    );
    await act(async () => {
      screen.getByTestId("refresh").click();
    });
    await waitFor(() =>
      expect(screen.getByTestId("expanded").textContent).toBe(""),
    );
  });

  it("setFilter persists to localStorage", async () => {
    mockFetchPipeline.mockResolvedValue(makeOk());
    renderWithView("build");
    await waitFor(() => expect(mockFetchPipeline).toHaveBeenCalled());

    await act(async () => {
      screen.getByTestId("set-filter").click();
    });
    expect(screen.getByTestId("filter").textContent).toBe("owner:Z");
    expect(window.localStorage.getItem("pulse:build-filter")).toBe(
      JSON.stringify({ type: "owner", value: "Z" }),
    );
  });
});
