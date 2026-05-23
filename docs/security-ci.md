# Automated security checks (CI)

`.github/workflows/security.yml` runs on every push, pull request, and weekly
on a schedule. It is designed to catch the same classes of issue that the
in-app Lovable security scanner flagged during the pilot hardening pass.

| Job | Tool | What it catches |
|---|---|---|
| `dependency-audit` | `bun audit --prod --audit-level=critical` | Known CVEs in production dependencies. Fails on critical only (lodash HIGH via recharts has no patched 4.x; `_.template` is not called here). |
| `secret-scan` | `gitleaks` | API keys, JWTs, private keys, tokens committed to the repo. Publishable Supabase identifiers (anon JWT + project URL) are allowlisted in `.gitleaks.toml`. |
| `static-analysis` | `semgrep` (`security-audit`, `owasp-top-ten`, `typescript`, `react`, `secrets`) | XSS, SSRF, prototype pollution, unsafe `dangerouslySetInnerHTML`, hard-coded secrets, insecure crypto, etc. |
| `supabase-policy-lint` | custom Python + awk | `DISABLE ROW LEVEL SECURITY`, `USING (true)` / `WITH CHECK (true)` on non-catalogue tables, `SECURITY DEFINER` without `set search_path`, a `role` column on `profiles`, edits to reserved schemas (`auth`, `storage`, `realtime`, `supabase_functions`, `vault`). |
| `rls-regression` | `scripts/check-rls-regression.ts` | Key RLS guards (org scoping, `has_role` checks, sensitive-policy allowlist in `supabase/security/sensitive-policies.json`) are still present after each migration. |
| `hibp-protection` | `scripts/check-hibp-protection.ts` | HIBP leaked-password protection remains enabled in Supabase Auth; no bypass patterns introduced in source. |
| `unit-tests` | `vitest`, `eslint` | Regressions in board rendering, prediction blending, session state, depth routing, prompt-input sanitiser, and pupil-delete RLS. |

## Running locally

```bash
# Dependency CVEs
bun audit --prod --audit-level=critical

# Secret scan
brew install gitleaks            # or: docker pull zricethezav/gitleaks
gitleaks detect --config .gitleaks.toml --redact

# Static analysis
docker run --rm -v "$PWD:/src" returntocorp/semgrep \
  semgrep scan --config p/security-audit --config p/owasp-top-ten \
               --config p/typescript --config p/react --config p/secrets \
               --error --severity ERROR --severity WARNING

# Tests + lint
bun run test
bun run lint
```

## Triage

1. Fix the underlying issue in code or migrations and re-run the failing job.
2. If a finding is a known false positive, add a narrowly scoped allowlist
   entry (gitleaks) or `# nosemgrep: <rule-id>` comment (semgrep) with a
   one-line justification.
3. Never disable a whole job to make CI green. Reduce scope, do not remove
   coverage.

## What is **not** covered

CI runs static checks only. It cannot prove RLS policies are logically
correct — they may be enabled but still over-permissive in ways grep cannot
see. Continue to:

- Manually review every new RLS policy and migration.
- Run the in-app Lovable security scanner after schema changes.
- Test policies with both SENCo and TA JWTs before shipping.
