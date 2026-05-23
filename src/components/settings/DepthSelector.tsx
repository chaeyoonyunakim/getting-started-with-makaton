import type { Depth } from "@/lib/depthRouter";

interface DepthSelectorProps {
  value: Depth;
  onChange: (depth: Depth) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{ value: Depth; title: string; helper: string }> = [
  {
    value: 1,
    title: "Single page",
    helper: "Everything on one screen. Best for pupils who can't yet navigate menus.",
  },
  {
    value: 2,
    title: "Scene → Item",
    helper: "Pupil picks a topic (e.g. Food), then a single item. The default.",
  },
  {
    value: 3,
    title: "Scene → Item → Modifier",
    helper: "Adds a 2-word utterance step (e.g. \"biscuit\" + \"more\"). For confident communicators.",
  },
];

/**
 * Radio-style picker for a pupil's navigation depth.
 * Persists upstream via the `onChange` callback.
 */
export const DepthSelector = ({ value, onChange, disabled }: DepthSelectorProps) => {
  return (
    <fieldset className="flex flex-col gap-4 w-full" disabled={disabled}>
      <legend className="text-lg font-bold text-foreground mb-2">Navigation depth</legend>
      {OPTIONS.map((opt) => {
        const checked = value === opt.value;
        return (
          <label
            key={opt.value}
            className={`
              flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer
              min-h-16 transition-colors
              ${checked ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"}
              ${disabled ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            <input
              type="radio"
              name="depth"
              className="w-6 h-6 mt-1 accent-primary"
              checked={checked}
              onChange={() => onChange(opt.value)}
            />
            <div className="flex-1">
              <div className="text-lg font-semibold text-foreground">
                Level {opt.value} — {opt.title}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{opt.helper}</p>
            </div>
          </label>
        );
      })}
    </fieldset>
  );
};

export default DepthSelector;
