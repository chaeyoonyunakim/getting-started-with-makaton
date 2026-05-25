[![status: experimental](https://github.com/GIScience/badges/raw/master/status/experimental.svg)](https://github.com/GIScience/badges#experimental)

# The Makaton — UK SEND Pilot

A digital choice board for non-verbal and emerging-verbal pupils in UK
SEN schools. Built mobile-first and tablet-optimised (iPad 10.2"
primary). Symbol artwork is fetched from licensed open sources with a
fallback chain that respects per-school licensing.

This project was inspired by a Makaton lanyard given to the author during
a short-term assistant work at a SEND school in London, 2022; each card
showing a symbol on the front and its hand sign on the back, used for
everyday communication with pupils who had limited verbal speech.

![Physical AAC pocket cards used in the pilot classroom](assets/pocket-cards.png)

This README focuses on **pilot-readiness**: architecture, lawful basis,
retention, sub-processors, and how to handle Subject Access Requests
(SARs) and Right-to-Erasure requests.

---

## Tech stack

- **Frontend**: React 18 + Vite 5 + TypeScript 5, Tailwind CSS v3,
  shadcn/ui, TanStack Query, `react-i18next` (en-GB).
- **Backend**: Supabase (managed Postgres, Auth, Storage, Edge
  Functions on Deno) — provisioned via Lovable Cloud.
- **AuthN/AuthZ**: Supabase Auth (email + password). Authorisation
  enforced by Row-Level Security on every table, scoped through
  `current_user_org()`. Role (`senco` / `ta`) lives on `profiles`,
  protected by the `prevent_role_self_escalation` trigger and an RLS
  policy that forbids self-escalation; checked in policies via `has_role()`.
- **Prediction engine**: Pure-SQL/TypeScript Markov + Thompson-sampling
  bandit running inside the `predictNextCards` Edge Function. **No
  external LLM is called at runtime.** Nightly bandit update via
  `updateBanditNightly`.
- **Symbol sourcing**: Local cache (`/assets/symbols/`) first; on 404
  `BoardCell` calls the `resolveSymbol` edge function: ARASAAC REST API
  → Mulberry CDN → Sclera (high-contrast) → optional AI synthesis (off
  by default). See **Symbol licensing** below.
- **Realtime**: Supabase Realtime channel on the `ta_notifications`
  table for in-app TA alerts (no external webhooks).
- **Testing**: Vitest smoke tests for board rendering, prediction
  blending, session state, and depth routing.

## Edge Functions

| Function | Purpose |
|---|---|
| `predictNextCards` | Markov + bandit Top-3 prediction. No LLM. |
| `updateBanditNightly` | Recomputes bandit posteriors from yesterday's selections. |
| `resolveSymbol` | Licence-aware symbol fallback chain (ARASAAC → Mulberry → Sclera → AI). |
| `makaton-greeting` | Category-arrival greeting text. |
| `makaton-predict` | AI-suggested quick-choice signs (first-session fallback). |
| `makaton-reward` | Generates the Golden Sign celebration image. |
| `makaton-notifier` | Writes in-app TA notifications to `ta_notifications`. |
| `purgeOldSelections` | Nightly retention enforcement. |
| `exportPupilData` | Subject Access Request export (JSON). |
| `deletePupil` | Right-to-Erasure hard delete. |
| `health`, `version` | Liveness and build metadata. |

## Symbol licensing

Open-licensed symbols (ARASAAC CC BY-NC-SA 4.0) are shipped locally
under `/assets/symbols/` for instant first render. Proprietary symbol
sets are never embedded. For any label without a local file, `BoardCell`
calls the `resolveSymbol` edge function, which fetches and caches the
best available alternative, storing source, licence, and attribution on
every `cards` row.

| Source | Licence | Required attribution |
|---|---|---|
| **ARASAAC** (primary) | CC BY-NC-SA 4.0 | *Symbols author: Sergio Palao. Origin: ARASAAC (https://arasaac.org). Licence: Creative Commons (BY-NC-SA).* Property of the Government of Aragón. |
| **Mulberry Symbols** (fallback, lazy-fetched from CDN) | CC BY-SA 2.0 UK | *Mulberry Symbols © 2018–2026 Steve Lee. Licensed under CC BY-SA 2.0 UK: England & Wales.* |
| **Sclera Symbols** (high-contrast fallback) | CC BY-NC 4.0 | *Sclera Symbols — https://www.sclera.be. Licensed under CC BY-NC.* |
| **AI-synthesised** | Internal review only | Feature-flagged behind `ENABLE_AI_SYMBOLS` (default **false**). When disabled, the resolver returns `null` silently and the UI falls back to the placeholder. |
| **School-supplied licensed packs** | Per school's own licence | Stored in `org_symbol_packs` and scoped by `org_id`. Used only when the pupil's organisation has the appropriate licence. |

A live attribution footer (`AttributionFooter`) on the SENCo dashboard
lists every licence in use plus per-source counts. The UI does not use
the word "Makaton" anywhere by default — only pupils flagged
`makaton_licensed` see Makaton-branded packs.

## Lawful basis (UK GDPR)

Children's personal data processed by The Makaton (pupil names,
selections, predictions, session metadata) is processed under:

- **Article 6(1)(e)** — *processing necessary for the performance of a
  task carried out in the public interest.* The controller is the
  pilot school (or MAT); The Makaton acts as **processor**.
- **Article 9(2)(g)** — *processing necessary for reasons of
  substantial public interest, on the basis of UK domestic law*
  (Children and Families Act 2014; Education Act 1996) — where
  selection patterns may reveal health information.

See [`docs/DPIA.md`](docs/DPIA.md) and the draft Article 28 processor
agreement in [`docs/DPA.md`](docs/DPA.md).

## Retention

| Data class | Default retention | Configurable per-school? |
|---|---|---|
| Raw `card_selections` (with `dwell_ms`, `predicted_in_top3`) | 90 days | Yes — `org_settings.retention_days` |
| Aggregated `mv_pupil_transitions` counts | Indefinite (anonymous to the pupil) | No |
| `sessions` summary rows | 90 days | Yes |
| `predictions_log` (Top-3 + chosen) | 90 days | Yes |
| `ta_notifications` | 30 days | Hard-coded |
| AI symbols pending review (`symbol_review_queue`) | Until approved/rejected | n/a |

`purgeOldSelections` runs nightly. Setting `retention_days` to `0`
disables retention beyond aggregation.

## Sub-processors

| Sub-processor | Purpose | UK/EU adequacy | Data shared |
|---|---|---|---|
| **Supabase Inc.** (eu-west-2) | Managed Postgres, Auth, Edge Functions, Storage | EU data residency | All pupil and session data |
| **ARASAAC** (Aragón Government, ES) | Symbol REST API + static CDN | EU | Free-text label only (e.g. "apple") — no pupil identifiers |
| **Mulberry Symbols CDN** (jsDelivr) | Static SVG artwork, lazy-fetched | UK origin via CDN | Label only |
| **Sclera Symbols CDN** | Static PNG artwork (high-contrast theme) | EU | Label only |
| **Lovable AI Gateway** | Optional AI symbol synthesis, off by default | Subject to gateway terms | Label only — disabled unless `ENABLE_AI_SYMBOLS=true` |

No selection, pupil, or session data is sent to any third party. There
is no Slack, no GitHub, and no analytics pixel integration.

## SAR and Right-to-Erasure procedure

1. SENCo verifies the requester's identity.
2. SENCo signs in and navigates to **Settings → Pupils**.
3. **SAR**: "Export data" calls `exportPupilData` and downloads a JSON
   archive of every row referencing that pupil. Deliver within **one
   calendar month** (UK GDPR Art. 12(3)).
4. **Erasure**: "Delete pupil" calls `deletePupil`, hard-deleting the
   pupil row and cascading to selections, sessions, predictions, and
   notifications. Aggregated counts in `mv_pupil_transitions` are also
   removed.
5. SENCo records the request in the school's information-rights
   register.

Both endpoints require a valid SENCo JWT and are scoped by `org_id`
RLS — a SENCo at one school cannot export or delete pupils at another.

## Accessibility

- WCAG 2.2 AA targeted; AAA contrast (≥ 7:1) on default theme.
- Tap targets ≥ 64 × 64 px.
- High-contrast yellow-on-black theme (≈ 19.5:1) for low-vision users.
- `prefers-reduced-motion` respected; in-app **Reduce motion** toggle.
- Screen-reader tested with VoiceOver (iPadOS) and NVDA (Windows).
- Full keyboard navigation; visible focus rings (`focus:ring-4
  focus:ring-ring/50`).

## Internationalisation

UI strings flow through `react-i18next` with **en-GB** as the default
and currently the only shipping locale. The `pupils.home_language`
column records a pupil's home language for SENCo reference.

## Observability

- `GET /functions/v1/health` — liveness probe.
- `GET /functions/v1/version` — semantic version + commit.
- Every Edge Function emits structured JSON logs via
  `supabase/functions/_shared/logger.ts`. Logs contain UUIDs and
  counts only — no pupil names, free text, or selection labels.

## Engineering

- `bun install`
- `bun run dev`
- `bun run lint` — ESLint (TypeScript + React rules)
- `bunx vitest run` — Vitest smoke tests
- See [`CHANGELOG.md`](CHANGELOG.md) for release history and
  [`docs/pilot-smoke-test.md`](docs/pilot-smoke-test.md) for the TA
  manual verification checklist.

## Credentials and secrets

`.env` is tracked in version control. It contains only publishable
`VITE_` variables — the Supabase project URL, project ID, and anon JWT
(`role: anon`). These are embedded in the frontend bundle at build time
and are safe to commit; security is enforced by RLS, not by keeping the
anon key secret. They are also allowlisted in `.gitleaks.toml` so the
secret scan does not flag them.

**Never** store `SUPABASE_SERVICE_ROLE_KEY` or any key with
`role: service_role` in `.env` or anywhere else in the repository.
Edge functions read the service key from a Supabase-injected environment
variable at runtime only.

## CI

Every push to `main`, pull request, and weekly schedule run `.github/workflows/security.yml`:

| Job | Tool | What it checks |
|---|---|---|
| `dependency-audit` | `bun audit` | No critical-severity advisories in production deps |
| `secret-scan` | Gitleaks | No credentials or API keys committed to history |
| `static-analysis` | Semgrep | OWASP Top 10, security-audit, TypeScript, React, and secrets rulesets |
| `supabase-policy-lint` | Python + awk | No `DISABLE ROW LEVEL SECURITY`; no `USING (true)` / `WITH CHECK (true)` on non-catalogue tables; `SECURITY DEFINER` functions must pin `search_path` |
| `rls-regression` | `scripts/check-rls-regression.ts` | Key RLS guards still present after each migration |
| `docs-freshness` | `scripts/check-docs-freshness.ts` | Documented file paths, database tables, and CI job names still match the repo |
| `hibp-protection` | `scripts/check-hibp-protection.ts` | HIBP leaked-password check enabled; no bypass patterns in source |
| `unit-tests` | Vitest + ESLint | Smoke tests pass; zero lint errors |

---

## Licence

MIT — see [LICENSE](./LICENSE).
