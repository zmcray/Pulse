// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PipelineFilters from "./PipelineFilters.jsx";

const mockSetFilter = vi.fn();
const mockState = vi.fn();

vi.mock("../../contexts/BuildPipelineContext.jsx", () => ({
  useBuildPipelineState: () => mockState(),
  useBuildPipelineDispatch: () => ({ setFilter: mockSetFilter }),
}));

beforeEach(() => {
  mockSetFilter.mockReset();
});

const projectsTwoOwners = [
  { id: "p1", ownerName: "Alice" },
  { id: "p2", ownerName: "Bob" },
  { id: "p3", ownerName: "Alice" },
];

describe("PipelineFilters", () => {
  it("self-hides when only one owner exists", () => {
    mockState.mockReturnValue({
      projects: [
        { id: "p1", ownerName: "Solo" },
        { id: "p2", ownerName: "Solo" },
      ],
      filter: { type: "all", value: null },
    });
    const { container } = render(<PipelineFilters />);
    expect(container.firstChild).toBeNull();
  });

  it("self-hides when zero owners exist", () => {
    mockState.mockReturnValue({
      projects: [{ id: "p1", ownerName: null }],
      filter: { type: "all", value: null },
    });
    const { container } = render(<PipelineFilters />);
    expect(container.firstChild).toBeNull();
  });

  it("renders All + per-owner pills sorted by count desc", () => {
    mockState.mockReturnValue({
      projects: projectsTwoOwners,
      filter: { type: "all", value: null },
    });
    render(<PipelineFilters />);
    expect(screen.getByText("All")).toBeInTheDocument();
    // Alice has 2 projects, Bob has 1 → Alice first
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["All", "Alice", "Bob"]);
  });

  it("calls setFilter with right shape on pill click", () => {
    mockState.mockReturnValue({
      projects: projectsTwoOwners,
      filter: { type: "all", value: null },
    });
    render(<PipelineFilters />);
    fireEvent.click(screen.getByText("Alice"));
    expect(mockSetFilter).toHaveBeenCalledWith({ type: "owner", value: "Alice" });
  });

  it("aria-pressed=true on the active pill", () => {
    mockState.mockReturnValue({
      projects: projectsTwoOwners,
      filter: { type: "owner", value: "Alice" },
    });
    render(<PipelineFilters />);
    expect(screen.getByText("All")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Alice")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Bob")).toHaveAttribute("aria-pressed", "false");
  });
});
