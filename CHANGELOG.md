# Changelog

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1-pilot.1] — 2026-05-23

### Fixed
- CI `static-analysis` job was failing immediately: `semgrep ci` in semgrep
  v1.x does not support `--error` / `--severity` flags (cloud-only subcommand).
  Switched to `semgrep scan` which supports all required flags offline.
- CI workflow YAML was technically invalid: the inline Python heredoc in the
  `supabase-policy-lint` step had unindented content that exits the YAML
  literal block early, causing YAML parse errors. Extracted to
  `scripts/check-rls-policies.py` so the workflow YAML is unambiguously valid.
- Added `.semgrepignore` to exclude `.env` (publishable anon JWT, not a secret)
  and Lovable-managed auto-generated files from semgrep scanning.
- Suppressed `dangerouslySetInnerHTML` semgrep finding in `chart.tsx`
  (shadcn/ui chart injects CSS custom properties from dev-authored config only).

## [0.2.0-pilot.1] — 2026-05-23

### Added
- Repo-access hardening pass (PR #1, merged 2026-05-23):
  - `.github/workflows/security.yml` jobs: `dependency-audit`,
    `secret-scan` (gitleaks), `static-analysis` (semgrep),
    `supabase-policy-lint`, `rls-regression`, `hibp-protection`,
    `unit-tests` + `lint`.
  - `scripts/check-rls-regression.ts` and
    `scripts/check-hibp-protection.ts` guards.
  - `.gitleaks.toml` allowlisting publishable Supabase identifiers.
  - README "Credentials and secrets" section documenting why `.env`
    (containing only `VITE_` publishable values) is intentionally
    tracked.
- SEO: Google Search Console verification meta tag in `index.html`;
  site verified, registered, and sitemap submitted.

### Fixed
- `supabase-policy-lint` CI check false positive: awk `SECURITY DEFINER`
  guard now uses `tolower()` so `SET search_path = public` is matched
  case-insensitively.

### Changed
- Dead code removed (`githubSymbolUrl`, `makatonImageUrl`,
  `useMakatonLicensed.ts`); ESLint clean across the repo.
- TA notifications fully migrated to in-app realtime; the Slack
  webhook path is gone.

### Security
- Roles confirmed to live in `public.user_roles` (never on
  `profiles`), enforced via `public.has_role()` with pinned
  `search_path`.
- Edge Functions sanitise all prompt-bound user input via
  `_shared/sanitizePromptInput.ts`.

## [0.1.0-pilot.1] — 2026-05-23

### Added
- Pilot-hardening pass: WCAG 2.2 AA + AAA contrast on default theme;
  `prefers-reduced-motion` support and in-app Reduce motion toggle.
- `react-i18next` scaffolding with `en-GB` as default locale.
- `pupils.home_language` column and SENCo profile editor field.
- Compliance docs: `docs/DPIA.md`, `docs/DPA.md`,
  `docs/pilot-smoke-test.md`, README section on lawful basis,
  retention, sub-processors, and SAR/erasure procedures.
- Observability: `/health` and `/version` Edge Functions; shared
  structured logger (`supabase/functions/_shared/logger.ts`).

### Changed
- High-contrast theme tuned to ≈19.5:1 contrast (black-on-yellow).

## [0.0.x] — pre-pilot iterations

- Session-bounded interaction model with golden-sign reward.
- License-aware symbol resolver: ARASAAC → Mulberry → Sclera → (AI).
- Next-card prediction (Markov + Thompson sampling bandit blend).
- Configurable-depth interaction tree (depth 1/2/3).
- TA in-app notifications via Realtime (replaced Slack webhook).
