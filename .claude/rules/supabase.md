---
description: Supabase data-access rules — RLS, clients, migrations.
paths:
  - "lib/supabase/**"
  - "supabase/**"
---

# Supabase Rules

- Row Level Security ON for every table. Default deny.
- All access via `lib/supabase/` clients (server vs browser). Never instantiate ad hoc.
- Schema changes via `supabase/migrations/` only — never hand-edit schema in the dashboard.
- Service-role key is server-only. Never ship it to the client bundle.
- Regenerate types after schema changes: `supabase gen types typescript`.
- Full setup + auth flow -> ../../docs/supabase-setup.md
