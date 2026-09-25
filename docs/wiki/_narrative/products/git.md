<!-- facts: agents=4f53cda1 commands=2e4720f6 docs=4f53cda1 faceRing=785b1405 faceRoom=ee12d4c2 files=4f53cda1 requires=d7a6ddaf scripts=4f53cda1 version=39fe4a40 -->
git is the smallest product in arc: four commands and not one script of its own. `/arc-commit` groups staged work into conventional commits and never pushes; `/arc-pr` opens the pull request; `/arc-fix-issue` takes a GitHub issue from root cause to fix; `/arc-ship` runs lint, build, tests and deploy in one shot.

It is its own product so that a project can take arc's git habits without the rest of arc — it requires only core.
