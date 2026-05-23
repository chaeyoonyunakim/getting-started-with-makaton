# File Structure

Top-level layout of the Choice Board pilot codebase. Kept in sync
with the post-hardening repo (May 2026).

## Database (Lovable Cloud / Supabase)

| Table                    | Purpose                                                                 |
|--------------------------|-------------------------------------------------------------------------|
| `organisations`          | Schools / settings. All tenant data is scoped per `org_id`.             |
| `profiles`               | One row per auth user. Holds `org_id`, `home_language`. **No role column.** |
| `user_roles`             | Separate table holding `(user_id, role)` — `senco` / `ta`. Checked via `has_role()`. |
| `pupils`                 | Children using the board. `grid_size`, `depth_setting`, EHCP tags, `makaton_licensed`. |
| `cards`                  | Shared symbol catalogue (`label`, `symbol_url`, `source`, `licence`).   |
| `scenes` / `scene_cards` | Configurable choice scenes and their ordered cards.                     |
| `card_selections`        | Raw selection events (with `dwell_ms`, `predicted_in_top3`).             |
| `sessions`               | Session summaries.                                                       |
| `predictions_log`        | Top-3 prediction snapshots per selection.                                |
| `bandit_arms`            | Thompson-sampling posteriors per scene/card.                             |
| `mv_pupil_transitions`   | Materialised view of Markov transitions (admin-only).                    |
| `ta_notifications`       | In-app TA alerts (replaces the old Slack webhook).                       |
| `org_symbol_packs`       | School-licensed symbol overlays (e.g. Makaton).                          |
| `symbol_review_queue`    | AI-generated symbols pending SENCo review.                               |
| `org_settings`           | Per-org retention and feature flags.                                     |

Row-level security:
- Tenant tables filter on `current_user_org()`.
- Role checks go through `public.has_role(auth.uid(), 'senco' | 'ta')` —
  a `SECURITY DEFINER` function with pinned `search_path`.
- `cards` is readable by any authenticated user.
- `mv_pupil_transitions` is revoked from API roles and read only via the
  service-role client inside `predictNextCards`.

## Frontend

```
src/
├── App.tsx                         Routes + providers; wraps protected routes in <ProtectedRoute>.
├── main.tsx                        Vite entry.
├── pages/
│   ├── Auth.tsx                    Email + password sign-in / sign-up.
│   ├── Index.tsx                   Authenticated home: header + ChoiceBoard.
│   ├── Settings.tsx                SENCo settings: retention, depth, attribution, sessions list.
│   ├── SessionDetail.tsx           Per-session timeline for SENCo review.
│   ├── ReviewSymbols.tsx           SENCo queue for approving AI-generated symbols.
│   └── NotFound.tsx
├── hooks/
│   ├── useAuth.tsx                 Supabase session listener + signOut.
│   ├── usePupilBoard.ts            React Query hook returning {coreItems, gridItems, rows, cols}.
│   ├── useSession.ts               Session lifecycle (start, append selection, end).
│   ├── useNextCardPredictions.ts   Calls predictNextCards Edge Function.
│   ├── useHighContrast.ts          Persistent high-contrast toggle.
│   ├── useReducedMotion.ts         prefers-reduced-motion + manual override.
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── contexts/
│   └── StudentContext.tsx          Selected pupil (display_name + id) for the session.
├── components/
│   ├── ProtectedRoute.tsx          Redirects unauthenticated users to /auth.
│   ├── SeoHead.tsx                 react-helmet-async wrapper (title / meta / JSON-LD).
│   ├── ChoiceBoard.tsx             Orchestrator: greeting, AI fallback, rewards, interaction lock.
│   ├── Header.tsx
│   ├── NavLink.tsx
│   ├── StudentSetupModal.tsx       First-run pupil-name prompt.
│   ├── StudentProfileChip.tsx      Switches pupil; shows current name.
│   ├── QuickChoices.tsx            Predictive core-word suggestions (Markov + bandit blend).
│   ├── MakatonPlaceholder.tsx
│   ├── board/                      Composable board primitives.
│   │   ├── BoardGrid.tsx           CSS grid shell.
│   │   ├── BoardCell.tsx           Card + tooltip + prediction ring.
│   │   ├── CoreStrip.tsx           Core-word strip above the grid.
│   │   ├── CoreStripBar.tsx        Sticky bar variant for tablet portrait.
│   │   └── SceneNav.tsx            Scene/depth breadcrumb + Back.
│   ├── session/
│   │   └── SessionShell.tsx        Frames a live session; mounts realtime listeners.
│   ├── settings/
│   │   ├── AttributionFooter.tsx   Live licence + per-source attribution counts.
│   │   └── DepthSelector.tsx       Depth 1/2/3 picker.
│   └── ui/                         shadcn primitives (unchanged).
├── lib/
│   ├── depthRouter.ts              Depth-aware navigation helper.
│   ├── predictionBlend.ts          Markov + bandit blend (mirrors Edge Function).
│   ├── sessionState.ts             Pure session reducer.
│   ├── i18n.ts                     react-i18next bootstrap (en-GB default).
│   └── utils.ts
├── data/
│   └── makaton.tsx                 Local fallback fixtures; DB is source of truth.
├── types/
│   └── choiceBoard.ts              ChoiceItem / Category types.
├── test/                           Vitest setup + RLS / sanitiser tests.
└── integrations/supabase/          Auto-generated client + types — DO NOT EDIT.
```

## Edge Functions

```
supabase/functions/
├── _shared/
│   ├── logger.ts                   Structured JSON logger (UUIDs + counts only).
│   └── sanitizePromptInput.ts      Trims + length-caps + strips prompt-injection markers.
├── predictNextCards/               Markov + Thompson-sampling Top-3. No external LLM.
├── updateBanditNightly/            Recomputes bandit posteriors nightly.
├── resolveSymbol/                  Licence-aware fallback: org pack → ARASAAC → Mulberry → Sclera → AI (flag).
├── makaton-greeting/               Category-arrival greeting (proxied via Edge Function).
├── makaton-notifier/               Writes in-app TA notifications (Slack webhook removed).
├── makaton-predict/                Legacy AI-predicted signs (Golden Reward fallback grid).
├── makaton-reward/                 Generates the celebratory Golden Sign image.
├── purgeOldSelections/             Nightly retention enforcement.
├── exportPupilData/                Subject Access Request export (JSON).
├── deletePupil/                    Right-to-Erasure hard delete.
├── health/                         Liveness probe.
└── version/                        Build metadata.
```

## Scripts

```
scripts/
├── check-hibp-protection.ts        CI: HIBP leaked-password protection is on.
├── check-rls-regression.ts         CI: key RLS guards still present.
└── seedPredictionsDemo.ts          Local demo seed for the prediction engine.
```

## Theme

Yellow/black CBeebies palette in `src/index.css` (`--accent: 45 100% 55%`,
`--foreground: 260 40% 20%`). The `.high-contrast` class overrides
`--background`, `--foreground`, `--card`, and `--border` only and tunes
contrast to ≈19.5:1 (WCAG AAA). All animation respects
`prefers-reduced-motion` plus the in-app Reduce-motion toggle.
