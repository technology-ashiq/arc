# org — debt ledger

LOW findings left after the attack rounds, and gaps accepted in writing. Each row names what it
would take to close.

| # | Opened | Item | Why not now | Closes when |
|---|---|---|---|---|
| 1 | 2026-09-30 | The yaml-subset parser (engine lane, ADR-0200) misreads a quoted list item holding `": "` as a mapping. | The parser is the engine lane's shared organ. org works around it (the emitter refuses; the gate fails the misread) and does not edit it. | The engine lane fixes `parseYamlSubset` and a paste-ready report is delivered to that lane. |
