// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BuildPipelineView from "./BuildPipelineView.jsx";

const mockState = vi.fn();

vi.mock("../contexts/BuildPipelineContext.jsx", () => ({
  useBuildPipelineState: () => mockState(),
  useBuildPipelineDispatch: () => ({ setFilter: () => {} }),
}));

describe("BuildPipelineView", () => {
  it("renders loading state when projects empty and loading", () => {
    mockState.mockReturnValue({
      projects: [],
      issues: [],
      loading: true,
      error: null,
      stale: false,
      lastFetched: null,
      filter: { type: "all", value: null },
    });
    render(<BuildPipelineView />);
    expect(screen.getByText(/Loading pipeline/i)).toBeInTheDocument();
  });

  it("renders error state when projects empty and error set", () => {
    mockState.mockReturnValue({
      projects: [],
      issues: [],
      loading: false,
      error: "linear_401",
      stale: false,
      lastFetched: null,
      filter: { type: "all", value: null },
    });
    render(<BuildPipelineView />);
    expect(screen.getByText(/Linear unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/linear_401/)).toBeInTheDocument();
  });

  it("renders empty state when no projects, not loading, no error", () => {
    mockState.mockReturnValue({
      projects: [],
      issues: [],
      loading: false,
      error: null,
      stale: false,
      lastFetched: null,
      filter: { type: "all", value: null },
    });
    render(<BuildPipelineView />);
    expect(screen.getByText(/No projects yet/i)).toBeInTheDocument();
  });

  it("renders kanban + stats when projects populated", () => {
    mockState.mockReturnValue({
      projects: [
        {
          id: "p1",
          name: "Pulse",
          stage: "Building",
          ownerName: "Z",
          doneCount: 1,
          totalCount: 2,
          summary: "",
        },
        {
          id: "p2",
          name: "Atlas",
          stage: "Idea",
          ownerName: "Z",
          doneCount: 0,
          totalCount: 0,
          summary: "",
        },
      ],
      issues: [],
      loading: false,
      error: null,
      stale: false,
      lastFetched: 1700000000000,
      filter: { type: "all", value: null },
    });
    render(<BuildPipelineView />);
    expect(screen.getByText("Pulse")).toBeInTheDocument();
    expect(screen.getByText("Atlas")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("renders stale banner when state.stale is true", () => {
    mockState.mockReturnValue({
      projects: [
        {
          id: "p1",
          name: "P",
          stage: "Idea",
          ownerName: "Z",
          doneCount: 0,
          totalCount: 0,
          summary: "",
        },
      ],
      issues: [],
      loading: false,
      error: null,
      stale: true,
      lastFetched: 1700000000000,
      filter: { type: "all", value: null },
    });
    render(<BuildPipelineView />);
    expect(screen.getByText(/Showing cached data/i)).toBeInTheDocument();
  });

  it("renders no-stage warning when >80% projects parsed as Idea", () => {
    const idea = (id) => ({
      id,
      name: id,
      stage: "Idea",
      ownerName: "Z",
      doneCount: 0,
      totalCount: 0,
      summary: "",
    });
    mockState.mockReturnValue({
      projects: [idea("p1"), idea("p2"), idea("p3"), idea("p4"), idea("p5")],
      issues: [],
      loading: false,
      error: null,
      stale: false,
      lastFetched: 1700000000000,
      filter: { type: "all", value: null },
    });
    render(<BuildPipelineView />);
    expect(screen.getByText(/Most projects parsed as Idea/i)).toBeInTheDocument();
  });

  it("applies owner filter to kanban", () => {
    mockState.mockReturnValue({
      projects: [
        {
          id: "p1",
          name: "Pulse",
          stage: "Building",
          ownerName: "Alice",
          doneCount: 0,
          totalCount: 0,
          summary: "",
        },
        {
          id: "p2",
          name: "Atlas",
          stage: "Idea",
          ownerName: "Bob",
          doneCount: 0,
          totalCount: 0,
          summary: "",
        },
      ],
      issues: [],
      loading: false,
      error: null,
      stale: false,
      lastFetched: 1700000000000,
      filter: { type: "owner", value: "Alice" },
    });
    render(<BuildPipelineView />);
    expect(screen.getByText("Pulse")).toBeInTheDocument();
    expect(screen.queryByText("Atlas")).not.toBeInTheDocument();
  });
});
