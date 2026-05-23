import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SeoHead from "@/components/SeoHead";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    // Supabase puts recovery tokens in the URL hash as type=recovery
    const hash = window.location.hash;
    setRecovery(hash.includes("type=recovery") || hash.includes("access_token"));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated", { description: "You can now sign in with your new password." });
      navigate("/auth", { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setSubmitting(false);
    }
  };

  if (!recovery) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <SeoHead title="Reset password" description="Set a new password for your AAC Choice Board account." path="/reset-password" />
        <div className="w-full max-w-sm bg-card rounded-2xl shadow-lg p-8 flex flex-col gap-6 border border-border text-center">
          <h1 className="text-2xl font-bold text-foreground">Invalid link</h1>
          <p className="text-muted-foreground">
            This password reset link is expired or invalid. Please request a new one.
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="w-full bg-primary text-primary-foreground rounded-xl px-6 py-3 text-lg font-bold shadow-md transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-ring/50"
          >
            Back to sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <SeoHead title="Reset password" description="Set a new password for your AAC Choice Board account." path="/reset-password" />
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-lg p-8 flex flex-col gap-6 border border-border">
        <header className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Reset password</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Enter a new password for your account
          </p>
        </header>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label htmlFor="new-password" className="sr-only">New password</label>
          <input
            id="new-password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            aria-label="New password"
            autoComplete="new-password"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-4 focus:ring-ring/50"
          />
          <label htmlFor="confirm-password" className="sr-only">Confirm password</label>
          <input
            id="confirm-password"
            type="password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            aria-label="Confirm password"
            autoComplete="new-password"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-4 focus:ring-ring/50"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-primary-foreground rounded-xl px-6 py-3 text-lg font-bold shadow-md transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-ring/50 disabled:opacity-50"
          >
            {submitting ? "Please wait…" : "Update password"}
          </button>
        </form>
      </div>
    </main>
  );
};

export default ResetPassword;
