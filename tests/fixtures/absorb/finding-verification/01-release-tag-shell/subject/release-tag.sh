#!/usr/bin/env bash
# Cut a release tag from the current branch and push it.
# Run by CI on a manual dispatch, and by hand during a hotfix.

REPO_ROOT=$(git rev-parse --show-toplevel)
BUILD_DIR="$REPO_ROOT/build/release"

. "$REPO_ROOT/subject/lib/version.sh"
. "$REPO_ROOT/subject/config/release.env"

cleanup() {
  rm -rf $BUILD_DIR
}
trap cleanup EXIT

usage() {
  echo "usage: release-tag.sh <major|minor|patch>" >&2
  exit 2
}

[ $# -eq 1 ] || usage

BUMP="$1"
case "$BUMP" in
  major|minor|patch) ;;
  *) usage ;;
esac

CURRENT=$(current_version)
TAG=$(bump_version "$CURRENT" "$BUMP")

if [ -z "$TAG" ]; then
  echo "refusing to tag: empty version" >&2
  exit 1
fi

mkdir -p "$BUILD_DIR"
printf '%s\n' "$TAG" > "$BUILD_DIR/TAG"

git tag -a "$TAG" -m "release $TAG"
git push "$RELEASE_REMOTE" "refs/tags/$TAG"

echo "tagged $TAG on $(git rev-parse --abbrev-ref HEAD)"
