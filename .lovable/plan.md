# Refactor Plan: Roles, Pupils, Composable Board

Identical UX preserved. Yellow/black theme and high-contrast toggle untouched.

## 1. Database (single migration)

New enum + tables in `public`:

- `app_role` enum: `'ta' | 'senco'`
- `organisations(id uuid pk, name text, region text, created_at)`
- `profiles(id uuid pk → auth.users, org_id uuid → organisations, role app_role default 'ta', display_name text, created_at)`
- `pupils(id, org_id → organisations, display_name, year_group int, ehcp_categories text[], makaton_stage int, grid_size int default 6, depth_setting int default 2, created_at)`
- `cards(id, key text unique, label, symbol_url, source text, licence text, attribution text, makaton_stage int, category_key text, created_at)`

Security:
- Enable RLS on all four tables.
- `public.current_user_org()` SECURITY DEFINER returning `profiles.org_id` for `auth.uid()`.
- `public.has_role(_uid, _role)` SECURITY DEFINER (per Lovable user-roles guidance — role stored on profiles per request, but isolated via function).
- Policies: pupils SELECT/INSERT/UPDATE/DELETE where `org_id = current_user_org()`. Profiles: user can select own + same-org rows; update self. Organisations: select rows where `id = current_user_org()`. Cards: SELECT to authenticated (global catalogue); no writes from client.
- Trigger `on_auth_user_created` → creates profile linked to "Default Org" (auto-seeded), role default `'ta'`.

Seed:
- Insert one organisation `Default Org`.
- Insert 20 `cards` rows mirroring `src/data/makaton.tsx` (4 categories + 16 items), `source='local'`, `symbol_url='/symbols/<key>.png'`, `category_key` matching parent.

## 2. Auth

- Add `/auth` page (email + password sign-in/sign-up; no Google, no email confirm for now).
- `useAuth` hook with `onAuthStateChange` → `getSession` pattern.
- Protected route wrapper around `/`. Unauthed users redirected to `/auth`.
- Existing `StudentSetupModal` / `StudentProfileChip` repurposed: after login, lists pupils in the user's org; selecting one sets `currentPupilId`. "Add pupil" inserts into `pupils`.
- `StudentContext` extended with `currentPupil` (id + display_name) backed by localStorage cache, but source of truth is the `pupils` table.

## 3. Composable board

New files under `src/components/board/`:
- `BoardGrid.tsx` — `{ rows, cols, children }`, CSS grid.
- `BoardCell.tsx` — `{ symbol, intent, onSelect }`, renders image + tooltip + AI-save badge (lifted from current `ChoiceBoard`).
- `CoreStrip.tsx` — `{ items }`, fixed strip of core words above grid.

Data layer:
- `src/hooks/usePupilBoard.ts` — typed React Query hook `usePupilBoard(pupilId, sceneId?)` returning `{ coreItems, gridItems, rows, cols }`. Reads `pupils` for grid_size and queries `cards` filtered by `category_key = sceneId ?? 'home'`. Falls back to local `makaton.tsx` if query empty (defensive only).

Refactor:
- `ChoiceBoard.tsx` becomes a thin orchestrator: calls `usePupilBoard`, renders `<CoreStrip />` + `<BoardGrid>` of `<BoardCell />`. All existing behaviour (3-step sequence, Slack notify, AI fallback for empty categories, Save-to-Library) preserved by moving handlers into `BoardCell` via the `onSelect` prop and keeping the orchestrator side-effects identical.

## 4. Tests (smoke, not pixel)

`src/components/__tests__/board.test.tsx`:
- Mock `usePupilBoard` with seeded fixtures.
- Render `<BoardGrid>` at home (4 cells), level-1 (Food: 4 cells), level-2 (after AI fallback fixture).
- Assert correct count of `BoardCell` rendered + labels present. No errors.

## 5. Theme

Zero edits to `index.css`, `tailwind.config.ts`, or `useHighContrast`.

## 6. Docs + verification

- `docs/filesExplainer.md` — tree of new/changed files with one-line descriptions.
- Build + lint run automatically by harness.

## Technical notes

- Migration runs first (separate tool call), then code edits.
- `supabase/types.ts` regenerates automatically after migration.
- React Query already provided via `QueryClientProvider` in `App.tsx`.
- No changes to existing edge functions (`makaton-reward`, `makaton-notifier`, `makaton-save-symbol`).
- Will keep `src/data/makaton.tsx` as a typed fallback module imported only by the hook's catch path.
