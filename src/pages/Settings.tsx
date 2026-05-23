import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useStudent } from "@/contexts/StudentContext";
import DepthSelector from "@/components/settings/DepthSelector";
import AttributionFooter from "@/components/settings/AttributionFooter";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useHighContrast } from "@/hooks/useHighContrast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { Depth } from "@/lib/depthRouter";
import { toast } from "sonner";

const SettingsPage = () => {
  const { currentPupilId, currentStudent } = useStudent();
  const [depth, setDepth] = useState<Depth>(2);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [homeLanguage, setHomeLanguage] = useState<string>("");
  const { reducedMotion, setReducedMotion } = useReducedMotion();
  const { highContrast, toggle: toggleContrast } = useHighContrast();
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentPupilId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("pupils")
        .select("depth_setting, home_language")
        .eq("id", currentPupilId)
        .maybeSingle();
      if (!cancelled && data) {
        const d = (data as { depth_setting?: number }).depth_setting;
        if (d === 1 || d === 2 || d === 3) setDepth(d);
        setHomeLanguage((data as { home_language?: string | null }).home_language ?? "");
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
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <>
            <DepthSelector value={depth} onChange={handleChange} disabled={saving} />

            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="reduce-motion" className="text-base font-semibold">
                    {t("settings.reduceMotion")}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.reduceMotionHelp")}
                  </p>
                </div>
                <Switch
                  id="reduce-motion"
                  checked={reducedMotion}
                  onCheckedChange={setReducedMotion}
                  aria-label={t("settings.reduceMotion")}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="high-contrast" className="text-base font-semibold">
                    {t("settings.highContrast")}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.highContrastHelp")}
                  </p>
                </div>
                <Switch
                  id="high-contrast"
                  checked={highContrast}
                  onCheckedChange={toggleContrast}
                  aria-label={t("settings.highContrast")}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <Label htmlFor="home-language" className="text-base font-semibold">
                {t("settings.homeLanguage")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.homeLanguageHelp")}
              </p>
              <Input
                id="home-language"
                className="min-h-16 text-base"
                placeholder="e.g. Polish, Urdu, BSL"
                value={homeLanguage}
                onChange={(e) => setHomeLanguage(e.target.value)}
                onBlur={async () => {
                  if (!currentPupilId) return;
                  const { error } = await supabase
                    .from("pupils")
                    .update({ home_language: homeLanguage || null })
                    .eq("id", currentPupilId);
                  if (error) toast.error("Could not save home language");
                }}
              />
            </div>
          </>
        )}

        <Link
          to="/review-symbols"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 font-semibold min-h-16 hover:bg-muted focus:outline-none focus:ring-4 focus:ring-ring/50"
        >
          Review pending symbols →
        </Link>

        <AttributionFooter />
      </section>
    </main>
  );
};

export default SettingsPage;
