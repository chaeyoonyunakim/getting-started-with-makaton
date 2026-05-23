import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SeoHead from "@/components/SeoHead";

interface Selection {
  id: string;
  to_card_id: string;
  from_card_id: string | null;
  dwell_ms: number | null;
  predicted_in_top3: boolean;
  created_at: string;
}
interface Prediction {
  prediction_id: string;
  current_card_id: string | null;
  top3: Array<{ cardId: string; probability: number; reason: string }>;
  ts: string;
}

const SessionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<any | null>(null);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [showRationale, setShowRationale] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: s } = await supabase.from("sessions").select("*").eq("id", id).maybeSingle();
      setSession(s);
      const { data: sel } = await supabase
        .from("card_selections")
        .select("*")
        .eq("session_id", id)
        .order("created_at");
      const selRows = (sel as Selection[]) ?? [];
      setSelections(selRows);
      const cardIds = Array.from(new Set(selRows.flatMap((r) => [r.to_card_id, r.from_card_id]).filter(Boolean) as string[]));
      if (cardIds.length) {
        const { data: cards } = await supabase.from("cards").select("id, label").in("id", cardIds);
        const map: Record<string, string> = {};
        for (const c of cards ?? []) map[(c as any).id] = (c as any).label;
        setLabels(map);
      }
    })();
  }, [id]);

  const loadRationale = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("predictions_log")
      .select("prediction_id, current_card_id, top3, ts")
      .eq("session_id", id)
      .order("ts");
    setPredictions((data as Prediction[]) ?? []);
    setShowRationale(true);
  };

  // Aggregates
  const sceneCounts = new Map<string, number>();
  for (const s of selections) {
    sceneCounts.set(s.to_card_id, (sceneCounts.get(s.to_card_id) ?? 0) + 1);
  }
  const mostUsed = [...sceneCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const dwells = selections.map((s) => s.dwell_ms ?? 0).filter((d) => d > 0);
  const avgDwell = dwells.length ? Math.round(dwells.reduce((a, b) => a + b, 0) / dwells.length) : 0;
  const outliers = selections.filter((s) => s.dwell_ms && s.dwell_ms > avgDwell * 2);

  // Longest 2-card combo
  let longestCombo: [string, string] | null = null;
  let longestRun = 0;
  let currentRun = 0;
  for (let i = 1; i < selections.length; i++) {
    if (selections[i].to_card_id === selections[i - 1].to_card_id) {
      currentRun++;
      if (currentRun > longestRun) {
        longestRun = currentRun;
        longestCombo = [selections[i - 1].to_card_id, selections[i].to_card_id];
      }
    } else {
      currentRun = 0;
    }
  }

  return (
    <main className="container py-6 space-y-6 max-w-4xl">
      <SeoHead
        title="Session detail — AAC Choice Board"
        description="Review a pupil session: card selections, dwell times, predictions, and golden-sign awards."
        path={`/sessions/${id ?? ""}`}
      />
      <header className="flex items-center gap-3">

        <Link to="/settings" className="rounded-full p-2 hover:bg-muted" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Session detail</h1>
        {session?.golden_sign_awarded && (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 rounded-full px-3 py-1 text-sm font-semibold">
            <Sparkles className="w-4 h-4" /> Golden Sign awarded
          </span>
        )}
      </header>

      {session && (
        <section className="bg-card border border-border rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat label="Selections" value={String(session.total_selections)} />
          <Stat label="Scenes" value={String(session.scene_count)} />
          <Stat label="Depth" value={String(session.depth_used ?? "—")} />
          <Stat label="Duration" value={duration(session.started_at, session.ended_at)} />
        </section>
      )}

      <section>
        <h2 className="font-semibold mb-2">Selection timeline</h2>
        <ol className="flex flex-wrap gap-2">
          {selections.map((s) => (
            <li
              key={s.id}
              className={`px-3 py-2 rounded-xl border text-sm ${s.predicted_in_top3 ? "border-amber-400 bg-amber-50" : "border-border bg-card"}`}
              title={s.predicted_in_top3 ? "Was in predicted top-3" : ""}
            >
              {labels[s.to_card_id] ?? s.to_card_id.slice(0, 6)}
              {s.dwell_ms ? <span className="text-muted-foreground ml-1">({s.dwell_ms}ms)</span> : null}
            </li>
          ))}
          {selections.length === 0 && <li className="text-muted-foreground">No selections recorded.</li>}
        </ol>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card title="Most-used card" body={mostUsed ? `${labels[mostUsed[0]] ?? mostUsed[0]} (${mostUsed[1]}×)` : "—"} />
        <Card title="Longest 2-card combo" body={longestCombo ? `${labels[longestCombo[0]] ?? longestCombo[0]} → ${labels[longestCombo[1]] ?? longestCombo[1]}` : "—"} />
        <Card title="Dwell-time outliers" body={outliers.length ? `${outliers.length} card${outliers.length === 1 ? "" : "s"} > 2× avg` : "None"} />
      </section>

      <section>
        <button
          onClick={loadRationale}
          className="rounded-xl border border-border bg-card px-4 py-2 font-semibold hover:bg-muted"
        >
          {showRationale ? "Reload" : "Why these suggestions?"}
        </button>
        {showRationale && (
          <div className="mt-4 space-y-3">
            {predictions.length === 0 && <p className="text-muted-foreground text-sm">No predictions logged for this session.</p>}
            {predictions.map((p) => (
              <div key={p.prediction_id} className="bg-muted/40 rounded-xl p-3 text-sm">
                <div className="text-xs text-muted-foreground mb-1">
                  After {p.current_card_id ? (labels[p.current_card_id] ?? p.current_card_id.slice(0, 6)) : "—"} · {new Date(p.ts).toLocaleTimeString()}
                </div>
                <ol className="space-y-1">
                  {p.top3.map((t, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="font-medium">{labels[t.cardId] ?? t.cardId.slice(0, 6)}</span>
                      <span className="text-muted-foreground">{(t.probability * 100).toFixed(1)}% · {t.reason}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-xs uppercase text-muted-foreground">{label}</div>
    <div className="font-bold text-lg">{value}</div>
  </div>
);

const Card = ({ title, body }: { title: string; body: string }) => (
  <div className="bg-card border border-border rounded-2xl p-4">
    <div className="text-xs uppercase text-muted-foreground">{title}</div>
    <div className="font-semibold mt-1">{body}</div>
  </div>
);

function duration(startISO?: string, endISO?: string | null) {
  if (!startISO) return "—";
  const end = endISO ? new Date(endISO).getTime() : Date.now();
  const ms = end - new Date(startISO).getTime();
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

export default SessionDetail;
