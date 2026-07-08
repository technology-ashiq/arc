# Supabase Setup

Extended reference. `CLAUDE.md` links here so the main file stays under 200 lines.

## Local dev
1. `npx supabase init`
2. `npx supabase start`  (local stack at http://localhost:54321)
3. Copy the printed keys into `.env.local`.

## Migrations
- New: `npx supabase migration new <name>`
- Apply locally: `npx supabase db reset`
- Push to remote: `npx supabase db push`

## Auth
- Providers (email + OAuth) configured in the dashboard.
- Sessions via `@supabase/ssr`: server client in `lib/supabase/server.ts`, browser in `lib/supabase/client.ts`.

## RLS pattern
- Default deny. Add per-table policies (select/insert/update/delete) scoped to `auth.uid()`.

## Env
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `SUPABASE_ACCESS_TOKEN` (MCP).
