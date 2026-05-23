# File Structure

Top-level layout of the refactored Makaton Choice Board.

## Database (Lovable Cloud)

| Table           | Purpose                                                          |
|-----------------|------------------------------------------------------------------|
| `organisations` | Schools / settings. All access scoped per org.                   |
| `profiles`      | One row per auth user. Holds `role` (`ta` / `senco`) + `org_id`. |
| `pupils`        | Children using the board. `grid_size`, `depth_setting`, EHCP.    |
| `cards`         | Shared Makaton catalogue (`key`, `symbol_url`, `category_key`).  |

Row-level security:
- `pupils` / `profiles` / `organisations` filtered by `current_user_org()`.
- `cards` readable by any authenticated user.
- New signups land in **Default Org** as `ta` via the `on_auth_user_created` trigger.

## Frontend

```
src/
├── App.tsx                         Routes + providers; wraps `/` in <ProtectedRoute>.
├── main.tsx                        Vite entry.
├── pages/
│   ├── Auth.tsx                    Email + password sign-in / sign-up.
│   ├── Index.tsx                   Authenticated home: header + ChoiceBoard.
│   └── NotFound.tsx
├── hooks/
│   ├── useAuth.tsx                 Supabase session listener + signOut.
│   ├── usePupilBoard.ts            Typed React Query hook returning {coreItems, gridItems, rows, cols}.
│   ├── useHighContrast.ts          Persistent high-contrast toggle.
│   └── use-toast.ts
├── contexts/
│   └── StudentContext.tsx          Selected pupil (display_name + id) for the session.
├── components/
│   ├── ProtectedRoute.tsx          Redirects unauthenticated users to /auth.
│   ├── ChoiceBoard.tsx             Orchestrator: greeting, AI fallback, rewards, locking.
│   ├── Header.tsx
│   ├── StudentSetupModal.tsx       First-run pupil-name prompt.
│   ├── StudentProfileChip.tsx      Switches pupil; shows current name.
│   ├── QuickChoices.tsx            Predictive core-word suggestions.
│   ├── MakatonPlaceholder.tsx
│   ├── board/                      Composable board primitives.
│   │   ├── BoardGrid.tsx           <BoardGrid rows cols>: CSS grid shell.
│   │   ├── BoardCell.tsx           <BoardCell symbol intent onSelect>: card + tooltip + save badge.
│   │   └── CoreStrip.tsx           <CoreStrip items>: core-word strip above the grid.
│   ├── __tests__/
│   │   └── board.test.tsx          Vitest smoke render for level-0/1/2 grids.
│   └── ui/                         shadcn primitives (unchanged).
├── data/
│   └── makaton.tsx                 Local fallback fixtures; DB is source of truth.
├── types/
│   └── choiceBoard.ts              ChoiceItem / Category types + Makaton asset helpers.
└── integrations/supabase/          Auto-generated client + types — DO NOT EDIT.

supabase/functions/
├── makaton-greeting/               Category-arrival greeting (CodeWords).
├── makaton-notifier/               TA Slack notification.
├── makaton-predict/                AI predicted signs (Golden Reward fallback grid).
├── makaton-reward/                 Generates the celebratory Golden Sign image.
└── makaton-save-symbol/            Commits AI-generated symbols back to GitHub.
```

## Theme

Yellow/black CBeebies palette in `src/index.css` (`--accent: 45 100% 55%`,
`--foreground: 260 40% 20%`) is untouched. The `.high-contrast` class
overrides `--background`, `--foreground`, `--card`, and `--border` only.
