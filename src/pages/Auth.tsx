import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import SeoHead from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Lock, ArrowLeft } from "lucide-react";

type AuthMode = "signin" | "signup" | "forgot";

interface FieldErrors {
  email?: string;
  password?: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validate = (mode: AuthMode, email: string, password: string): FieldErrors => {
  const errors: FieldErrors = {};
  if (!email.trim()) {
    errors.email = "Email is required";
  } else if (!emailRegex.test(email)) {
    errors.email = "Please enter a valid email address";
  }
  if (mode !== "forgot") {
    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
  }
  return errors;
};

const AuthPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [errors, setErrors] = useState<FieldErrors>({});

  const title = mode === "forgot" ? "Reset password" : mode === "signin" ? "Sign in" : "Create account";
  const subtitle = mode === "forgot"
    ? "Enter your email and we'll send you a reset link."
    : "For Teaching Assistants and SENCOs";


  const validateFields = (nextMode = mode) => {
    const errs = validate(nextMode, email, password);
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setErrors({});
    setTouched({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!validateFields()) return;

    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Account created!", { description: "Check your inbox to confirm your email." });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Reset link sent", { description: "Check your inbox for the password reset email." });
        switchMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/", { replace: true });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (!result.redirected) {
        navigate("/", { replace: true });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const modeLabel = useMemo(() => {
    if (mode === "forgot") return "Send reset link";
    if (mode === "signin") return "Sign in";
    return "Sign up";
  }, [mode]);

  // All hooks above run unconditionally on every render.
  // Loading and redirect states are handled via conditional rendering below,
  // never via early returns — this keeps hook order stable.
  return (
    <>
      {loading ? null : !user ? (


    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <SeoHead
        title="Sign in — The Makaton for SEND classrooms"
        description="Teaching Assistants and SENCOs sign in to manage Makaton pupil profiles and start communication sessions."
        path="/auth"
      />
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-lg p-8 flex flex-col gap-6 border border-border animate-fade-in">

        <header className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="auth-email" className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              Email
            </Label>
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (touched.email) validateFields();
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, email: true }));
                validateFields();
              }}
              placeholder="you@school.edu"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              className={errors.email ? "border-destructive focus-visible:ring-destructive/30" : ""}
            />
            {errors.email && (
              <p id="email-error" className="text-xs text-destructive font-medium">
                {errors.email}
              </p>
            )}
          </div>

          {mode !== "forgot" && (
            <div className="space-y-2">
              <Label htmlFor="auth-password" className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                Password
              </Label>
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (touched.password) validateFields();
                }}
                onBlur={() => {
                  setTouched((t) => ({ ...t, password: true }));
                  validateFields();
                }}
                placeholder={mode === "signup" ? "Create a password (min. 6 chars)" : "Enter your password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
                className={errors.password ? "border-destructive focus-visible:ring-destructive/30" : ""}
              />
              {errors.password && (
                <p id="password-error" className="text-xs text-destructive font-medium">
                  {errors.password}
                </p>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            size="lg"
            className="w-full text-base font-semibold shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Please wait…
              </>
            ) : (
              modeLabel
            )}
          </Button>
        </form>

        {mode !== "forgot" && (
          <>
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full text-base font-medium shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  <path fill="none" d="M0 0h48v48H0z"/>
                </svg>
              )}
              {mode === "signin" ? "Sign in with Google" : "Sign up with Google"}
            </Button>
          </>
        )}

        <div className="flex flex-col items-center gap-3 pt-1">
          {mode === "signin" && (
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Forgot password?
            </button>
          )}

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
            </button>
          )}

          <button
            type="button"
            onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {mode === "signin"
              ? "No account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </main>
      ) : (
        <Navigate to="/" replace />
      )}
    </>
  );
};

export default AuthPage;
