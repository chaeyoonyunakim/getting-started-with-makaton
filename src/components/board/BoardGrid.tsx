import type { ReactNode } from "react";

interface BoardGridProps {
  rows: number;
  cols: number;
  className?: string;
  children: ReactNode;
}

/**
 * Pure layout shell for the choice board.
 * Renders a responsive CSS grid sized by `rows` x `cols`.
 */
export const BoardGrid = ({ rows, cols, className, children }: BoardGridProps) => {
  // On small screens collapse to a single column to keep cells large for SEND users.
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full animate-fade-in ${className ?? ""}`}
      data-rows={rows}
      data-cols={cols}
    >
      {children}
    </div>
  );
};

export default BoardGrid;
