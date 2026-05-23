import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStudent } from "@/contexts/StudentContext";
import DepthSelector from "@/components/settings/DepthSelector";
import AttributionFooter from "@/components/settings/AttributionFooter";
import type { Depth } from "@/lib/depthRouter";
import { toast } from "sonner";

const SettingsPage = () => {
  const { currentPupilId, currentStudent } = useStudent();
  const [depth, setDepth] = useState<Depth>(2);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentPupilId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("pupils")
        .select("depth_setting")
        .eq("id", currentPupilId)
        .maybeSingle();
      if (!cancelled && data?.depth_setting) {
        const d = data.depth_setting as number;
        if (d === 1 || d === 2 || d === 3) setDepth(d);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPupilId]);

  const handleChange = async (next: Depth) => {
    setDepth(next);
    if (!currentPupilId) return;
    setSaving(true);
    const { error } = await supabase
      .from("pupils")
      .update({ depth_setting: next })
      .eq("id", currentPupilId);
    setSaving(false);
    if (error) toast.error("Could not save depth", { description: error.message });
    else toast.success(`Depth set to Level ${next}`);
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="max-w-3xl mx-auto px-4 py-6 flex items-center gap-4">
        <Link
          to="/"
          className="min-w-16 min-h-16 flex items-center justify-center bg-primary text-primary-foreground rounded-2xl shadow-md focus:outline-none focus:ring-4 focus:ring-ring/50"
          aria-label="Back to board"
        >
          <ArrowLeft className="w-7 h-7" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">SENCo settings</h1>
          {currentStudent && (
            <p className="text-sm text-muted-foreground">
              For pupil: <span className="font-semibold">{currentStudent}</span>
            </p>
          )}
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 pb-12 space-y-8">
        {!currentPupilId ? (
          <p className="text-muted-foreground">
            Select a pupil from the board before changing settings.
          </p>
        ) : loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <DepthSelector value={depth} onChange={handleChange} disabled={saving} />
        )}

        <Link
          to="/review-symbols"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 font-semibold hover:bg-muted focus:outline-none focus:ring-4 focus:ring-ring/50"
        >
          Review pending symbols →
        </Link>

        <AttributionFooter />
      </section>
    </main>
  );
};

export default SettingsPage;
