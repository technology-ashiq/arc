#!/usr/bin/env bash
# NEGATIVE CONTROL for tests/embedded-program-guard.bats. Broken ON PURPOSE; never sourced,
# never executed by anything.
#
# It reproduces the exact break that has happened five times in this repository: an apostrophe
# inside a COMMENT inside a program embedded in a single-quoted shell string. The apostrophe
# closes the shell string, so what the shell hands to node is truncated mid-comment and the
# remainder becomes shell words.
#
# `bash -n` DOES reject this one, and that is worth stating plainly rather than claiming the
# opposite: an earlier draft of this comment asserted the file passed bash -n, and it does not.
# bash -n is therefore the cheap first net and the guard is the second. The guard exists for
# the shape bash -n cannot see -- a truncation whose remainder still happens to be valid shell
# -- and for the shape a PARSER cannot see either: the region left behind here is
# `// this comment doesn`, an unterminated line comment, which is a perfectly valid JavaScript
# program. The first draft of the guard reported this file INTACT for exactly that reason. So
# the guard checks what FOLLOWS the closing quote: shell, or the rest of an English word.
set -u
node -e '
  const fs = require("node:fs");
  // this comment doesn't need an apostrophe, and that is exactly the point
  const data = fs.readFileSync(process.argv[1], "utf8");
  process.stdout.write(String(data.length));
' "$1"
