# The verify workflow

`verify` is the only gate on a pull request. It runs on every push to `main`, on
every pull request, and on a manual dispatch.

## Jobs

- **unit** — the bats suite, split across four shards.
  Each shard is independent, and `fail-fast` is off so one red shard does not
  hide another.
- **lint** — shellcheck plus the process linters.

## Shards

`scripts/shard.sh <n>` picks the files for shard `n` by index modulo the shard
count. Adding a test file reshuffles which shard owns which file, so a test that
reads ambient repo state passes only by shard luck.

## Adding a job

Give every job an explicit `runs-on`, and keep only the matrix axes it actually
reads. A job that declares an axis it never consumes still runs one leg per
value, so the run count doubles and nothing new is covered.
