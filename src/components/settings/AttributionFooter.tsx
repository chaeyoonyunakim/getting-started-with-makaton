import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Row {
  source: string;
  licence: string;
  attribution: string;
  count: number;
}

const LICENCE_BLURB: Record<string, string> = {
  arasaac: "Symbols author: Sergio Palao. Origin: ARASAAC (https://arasaac.org). Licence: CC BY-NC-SA.",
  mulberry: "Mulberry Symbols by Garry Paxton. Licence: CC BY-SA 2.0 UK.",
  sclera: "Sclera Symbols (https://www.sclera.be). Licence: CC BY-NC.",
  ai: "AI-generated, pending SENCo review.",
  manual: "Uploaded or vetted by school staff.",
  makaton: "Licensed Makaton symbol pack (school-supplied).",
};

/**
 * Lists every symbol licence currently in use across the org's card library,
 * with a per-source count. Designed for the SENCo dashboard footer.
 */
const AttributionFooter = () => {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("cards")
        .select("source, licence, attribution");
      const agg = new Map<string, Row>();
      for (const c of (data ?? []) as Row[]) {
        const key = `${c.source}|${c.licence}`;
        const existing = agg.get(key);
        if (existing) existing.count += 1;
        else agg.set(key, { source: c.source, licence: c.licence, attribution: c.attribution, count: 1 });
      }
      setRows([...agg.values()].sort((a, b) => b.count - a.count));
    })();
  }, []);

  if (rows.length === 0) return null;

  return (
    <footer className="border-t border-border mt-12 pt-6 pb-12 text-sm text-muted-foreground">
      <h2 className="font-bold text-foreground mb-3">Symbol attributions</h2>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={`${r.source}-${r.licence}`} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
            <span className="font-mono text-xs uppercase bg-muted rounded px-2 py-0.5 self-start">
              {r.source}
            </span>
            <span className="flex-1">
              {LICENCE_BLURB[r.source] ?? r.attribution}
              <span className="ml-2 text-foreground/70">({r.count} card{r.count === 1 ? "" : "s"})</span>
            </span>
          </li>
        ))}
      </ul>
    </footer>
  );
};

export default AttributionFooter;
