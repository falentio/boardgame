#!/usr/bin/env bash
# Serialized commit for parallel citadels workers sharing one worktree and one
# git index. Every worker commits through this script, never bare `git commit`,
# because two concurrent writers would otherwise race on .git/index.
#
# Usage: scripts/citadels-commit.sh "<commit message>" <path> [<path> ...]
# Only the named paths are staged, so a sibling's half-written file is never
# swept into this commit.
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: $0 <message> <path> [<path>...]" >&2
  exit 2
fi

MESSAGE="$1"; shift
ROOT="$(git rev-parse --show-toplevel)"
GITDIR="$(git rev-parse --absolute-git-dir)"
LOCK="$GITDIR/citadels-commit.lock"

for p in "$@"; do
  if [ ! -e "$p" ]; then
    echo "refusing to commit missing path: $p" >&2
    exit 2
  fi
done

exec 9>"$LOCK"
flock 9
git -C "$ROOT" add -- "$@"
if git -C "$ROOT" diff --cached --quiet -- "$@"; then
  echo "no staged changes for: $*" >&2
  exit 3
fi
git -C "$ROOT" commit -q -m "$MESSAGE" -- "$@"
git -C "$ROOT" log --oneline -1
