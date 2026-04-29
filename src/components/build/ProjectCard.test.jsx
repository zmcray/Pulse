// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProjectCard from "./ProjectCard.jsx";

const mockState = vi.fn();
vi.mock("../../contexts/BuildPipelineContext.jsx", () => ({
  useBuildPipelineState: () => mockState(),
}));

const baseProject = {
  id: "p1",
  name: "Pulse",
  url: "https://linear.app/x/project/p1",
  icon: null,
  stage: "Building",
  summary: "Daily dashboard.",
  ownerName: "Zachary McRay",
  ownerId: "u1",
  doneCount: 2,
  totalCount: 7,
};

beforeEach(() => {
  mockState.mockReturnValue({ issues: [] });
});

describe("ProjectCard", () => {
  it("renders name, summary, owner initials, and progress", () => {
    render(<ProjectCard project={baseProject} expanded={false} onToggle={() => {}} />);
    expect(screen.getByText("Pulse")).toBeInTheDocument();
    expect(screen.getByText("Daily dashboard.")).toBeInTheDocument();
    expect(screen.getByText("ZM")).toBeInTheDocument();
    expect(screen.getByText("2/7")).toBeInTheDocument();
  });

  it("renders 'No features yet' when totalCount is 0", () => {
    const empty = { ...baseProject, doneCount: 0, totalCount: 0 };
    render(<ProjectCard project={empty} expanded={false} onToggle={() => {}} />);
    expect(screen.getByText("No features yet")).toBeInTheDocument();
  });

  it("renders '—' when ownerName is null", () => {
    const orphan = { ...baseProject, ownerName: null };
    render(<ProjectCard project={orphan} expanded={false} onToggle={() => {}} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("hides Linear shortcode-style icons", () => {
    const { container } = render(
      <ProjectCard
        project={{ ...baseProject, icon: ":sailboat:" }}
        expanded={false}
        onToggle={() => {}}
      />,
    );
    expect(container.textContent).not.toMatch(/:sailboat:/);
  });

  it("renders glyph emoji icons", () => {
    render(
      <ProjectCard
        project={{ ...baseProject, icon: "🚀" }}
        expanded={false}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByText("🚀")).toBeInTheDocument();
  });

  it("calls onToggle on click", () => {
    const onToggle = vi.fn();
    render(<ProjectCard project={baseProject} expanded={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("calls onToggle on Enter/Space keypress", () => {
    const onToggle = vi.fn();
    render(<ProjectCard project={baseProject} expanded={false} onToggle={onToggle} />);
    const card = screen.getByRole("button");
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("aria-expanded reflects expanded prop", () => {
    const { rerender } = render(
      <ProjectCard project={baseProject} expanded={false} onToggle={() => {}} />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    rerender(<ProjectCard project={baseProject} expanded={true} onToggle={() => {}} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("renders ProjectFeatureList with Linear deep-link when expanded", () => {
    mockState.mockReturnValue({
      issues: [
        {
          id: "i1",
          title: "Build kanban",
          url: "https://linear.app/x/issue/i1",
          state: "done",
          projectId: "p1",
        },
        {
          id: "i2",
          title: "Filters",
          url: "https://linear.app/x/issue/i2",
          state: "in_progress",
          projectId: "p1",
        },
        {
          id: "i3",
          title: "Other project's issue",
          url: "u",
          state: "backlog",
          projectId: "p2",
        },
      ],
    });
    render(<ProjectCard project={baseProject} expanded={true} onToggle={() => {}} />);
    expect(screen.getByText("Build kanban")).toBeInTheDocument();
    expect(screen.getByText("Filters")).toBeInTheDocument();
    expect(screen.queryByText("Other project's issue")).not.toBeInTheDocument();
    const linearLink = screen.getByText(/Open in Linear/);
    expect(linearLink.closest("a")).toHaveAttribute("href", baseProject.url);
    expect(linearLink.closest("a")).toHaveAttribute("target", "_blank");
    expect(linearLink.closest("a")).toHaveAttribute("rel", "noopener noreferrer");
  });
});
