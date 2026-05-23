#!/usr/bin/env python3
"""
Scans supabase/migrations/*.sql for overly-permissive RLS policies.
Exempts shared read-only catalogue tables (cards, card_modifiers, bandit_arms)
which legitimately use USING (true) because there are no INSERT/UPDATE/DELETE
policies on them.

Exit 0 = clean. Exit 1 = violations found.
"""
import re
import glob
import sys

EXEMPT = re.compile(
    r"\bON\s+public\.(cards|card_modifiers|bandit_arms)\b", re.IGNORECASE
)
DANGER = re.compile(
    r"USING\s*\(\s*true\s*\)|WITH\s+CHECK\s*\(\s*true\s*\)", re.IGNORECASE
)

found = []
for f in sorted(glob.glob("supabase/migrations/*.sql")):
    text = open(f).read()
    for m in re.finditer(r"CREATE\s+POLICY\b.*?;", text, re.DOTALL | re.IGNORECASE):
        block = m.group(0)
        if DANGER.search(block) and not EXEMPT.search(block):
            found.append(f"{f}: {block[:120].strip()}")

for v in found:
    print(v)

sys.exit(1 if found else 0)
