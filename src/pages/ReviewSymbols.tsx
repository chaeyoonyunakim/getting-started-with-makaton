import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SeoHead from "@/components/SeoHead";

interface QueueRow {
  id: string;
  label: string;
  candidate_url: string;
  state: "pending" | "approved" | "rejected";
  created_at: string;
}

const ReviewSymbols = () => {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("symbol_review_queue")
      .select("id, label, candidate_url, state, created_at")
      .eq("state", "pending")
      .order("created_at", { ascending: false });
    if (error) toast.error("Could not load queue");
    setRows((data as QueueRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (row: QueueRow, decision: "approved" | "rejected") => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user?.id ?? "")
      .maybeSingle();
    const reviewerName = profile?.display_name ?? user?.email ?? null;

    const { error } = await supabase
      .from("symbol_review_queue")
      .update({
        state: decision,
        reviewed_by: user?.id ?? null,
        reviewer_name: reviewerName,
        reviewed_at: new Date().toISOString(),
        // On approve we mark the symbol as TA-vetted (manual) per spec.
        source: decision === "approved" ? "manual" : "ai",
      })
      .eq("id", row.id);
    if (error) {
      toast.error("Update failed", { description: error.message });
      return;
    }
    toast.success(decision === "approved" ? "Approved" : "Rejected");
    setRows((rs) => rs.filter((r) => r.id !== row.id));
  };

  return (
    <main className="container py-8 space-y-6">
      <SeoHead
        title="Review pending symbols — AAC Choice Board"
        description="SENCo review queue for AI-generated Makaton symbols awaiting approval before joining the pupil library."
        path="/review-symbols"
      />
      <header className="flex items-center gap-3">

        <Link to="/settings" className="rounded-full p-2 hover:bg-muted" aria-label="Back to settings">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Review pending symbols</h1>
      </header>

      <p className="text-muted-foreground max-w-2xl text-sm">
        These symbols were generated automatically when no licensed pictogram was available. Approve to add them to your school library, or reject to discard.
      </p>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">Nothing waiting for review. 🎉</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((row) => (
            <li key={row.id} className="bg-card border border-border rounded-2xl shadow-sm p-4 flex flex-col gap-3">
              <div className="aspect-square bg-muted/30 rounded-xl overflow-hidden flex items-center justify-center">
                <img src={row.candidate_url} alt={`Candidate symbol for ${row.label}`} className="w-full h-full object-contain" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold capitalize">{row.label}</span>
                <span className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => decide(row, "approved")}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-2 font-semibold hover:opacity-90 active:scale-95"
                >
                  <Check className="w-4 h-4" /> Approve
                </button>
                <button
                  onClick={() => decide(row, "rejected")}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-muted text-foreground rounded-xl py-2 font-semibold hover:bg-muted/80 active:scale-95"
                >
                  <X className="w-4 h-4" /> Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default ReviewSymbols;
