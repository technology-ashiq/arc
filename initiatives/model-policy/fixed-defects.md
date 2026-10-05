# fixed-defects.md — model-policy v2

Every hole an attacker found and this lane fixed. `arc-attack` hands this list to the next attacker, which checks each
pattern in every OTHER file of its diff ("a fix is not applied until it has been attacked somewhere it was never made").

| # | Found by | Pattern | Fixed in |
|---|---|---|---|
| 1 | attack d63004e B1 (medium) | A reason string from a store that holds secrets was printed verbatim to stderr; stderr reaches transcripts and CI logs. Print fixed text, blank anything quoted | `arc-run.mjs` profile preflight `refuse` |
| 2 | attack d63004e B3 (medium) | A preflight refusal exited before `--dry-run` could report it, so the preview said nothing about why. A refusal must also speak in the preview, with the same exit | `arc-run.mjs` profile preflight `refuse` |
| 3 | attack d63004e B2 (low) | `?? "none"` lets an empty-string key through to the driver as "unset" | `arc-run.mjs` profile snapshot `key` |
| 4 | attack d63004e B4 (low) | A test listener closed without dropping keep-alive sockets, and a spawned child with no deadline, can stall a CI shard | `tests/engine-model-profile-probe.mjs` |
| 5 | attack d63004e B5 (low) | Store-sourced strings served by the door without the file's `scrub` and a length bound | `hq/lib/face/reads.mjs` `profileOf`, `unroutable` |
