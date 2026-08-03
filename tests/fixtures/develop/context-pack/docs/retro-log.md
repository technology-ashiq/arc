# Retro log — fixture

> Format: `YYYY-MM-DD | project | pattern | prevention | tags`

2026-08-01 | fixture | a token check ran after the handler had already answered | verify the token before the handler, not after | auth,token,ordering
2026-08-01 | fixture | a deploy shipped without the migration | gate the deploy on the migration having run | deploy,ci,migrations
