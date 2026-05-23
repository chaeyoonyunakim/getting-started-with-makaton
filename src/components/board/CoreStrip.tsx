import QuickChoices from "@/components/QuickChoices";

export interface CoreItem {
  label: string;
}

interface CoreStripProps {
  items?: CoreItem[];
  category?: string;
  highContrast?: boolean;
  historyLog?: string[];
  onSelect: (label: string) => void;
}

/**
 * Persistent strip of "core word" / quick-choice shortcuts shown above the grid.
 * Thin wrapper around the existing QuickChoices component so it can be composed
 * separately from the grid.
 */
export const CoreStrip = ({
  category,
  highContrast,
  historyLog,
  onSelect,
}: CoreStripProps) => {
  return (
    <QuickChoices
      category={category}
      highContrast={highContrast}
      historyLog={historyLog}
      onSelect={onSelect}
    />
  );
};

export default CoreStrip;
