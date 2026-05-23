import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import BoardGrid from "@/components/board/BoardGrid";
import BoardCell, { type BoardSymbol } from "@/components/board/BoardCell";

// Mock supabase client (BoardCell imports it).
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    from: vi.fn(),
    auth: { onAuthStateChange: vi.fn(), getSession: vi.fn() },
  },
}));

const wrap = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
};

const seed = (n: number): BoardSymbol[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    label: `Symbol ${i}`,
    imagePath: undefined,
    colorClass: "bg-primary",
  }));

describe("BoardGrid smoke", () => {
  it("renders 4 cells at home (level-0)", () => {
    wrap(
      <BoardGrid rows={2} cols={2}>
        {seed(4).map((s) => (
          <BoardCell key={s.id} symbol={s} intent="category" onSelect={() => {}} />
        ))}
      </BoardGrid>
    );
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(screen.getByLabelText("Symbol 0")).toBeInTheDocument();
  });

  it("renders 4 cells at level-1 (Food sub-items)", () => {
    wrap(
      <BoardGrid rows={2} cols={2}>
        {seed(4).map((s) => (
          <BoardCell key={s.id} symbol={s} intent="subitem" onSelect={() => {}} />
        ))}
      </BoardGrid>
    );
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("renders 6 cells at level-2 (AI fallback grid)", () => {
    wrap(
      <BoardGrid rows={3} cols={2}>
        {seed(6).map((s) => (
          <BoardCell key={s.id} symbol={s} intent="subitem" onSelect={() => {}} />
        ))}
      </BoardGrid>
    );
    expect(screen.getAllByRole("button")).toHaveLength(6);
  });
});
