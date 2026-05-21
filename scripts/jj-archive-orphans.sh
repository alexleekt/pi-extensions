#!/bin/bash
# jj-archive-orphans.sh
# Preserve jj orphan commits (kept only by refs/jj/keep/* with no git branch)
# by creating lightweight git tags before jj migration.
# Run from repo root.

set -euo pipefail

ARCHIVE_PREFIX="jj-archive"
LOG_FILE=".jj-archive-orphans.log"

echo "=== JJ Orphan Commit Archiver ==="
echo "Scanning for commits only reachable via refs/jj/keep/* ..."

orphan_count=0
tagged_count=0
skipped_count=0
> "$LOG_FILE"

for keep_ref in .git/refs/jj/keep/*; do
  [ -f "$keep_ref" ] || continue
  commit=$(cat "$keep_ref")

  # Skip if already on a git branch/tag/remote
  contained=$(git branch -a --contains "$commit" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$contained" -gt 0 ]; then
    skipped_count=$((skipped_count + 1))
    continue
  fi

  orphan_count=$((orphan_count + 1))

  # Build tag name from description or fallback
  desc=$(git log -1 --format=%s "$commit" 2>/dev/null || echo "")
  short=$(git rev-parse --short=8 "$commit")
  if [ -n "$desc" ]; then
    # Sanitize: lowercase, replace spaces/non-alnum with dash, truncate
    slug=$(echo "$desc" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-50)
    tag_name="${ARCHIVE_PREFIX}/${slug}-${short}"
  else
    tag_name="${ARCHIVE_PREFIX}/orphan-${short}"
  fi

  # Ensure uniqueness
  suffix=1
  base_tag="$tag_name"
  while git show-ref --verify --quiet "refs/tags/${tag_name}" 2>/dev/null; do
    tag_name="${base_tag}-${suffix}"
    suffix=$((suffix + 1))
  done

  git tag "$tag_name" "$commit"
  tagged_count=$((tagged_count + 1))

  # Log
  echo "${tag_name} ${commit} ${desc}" >> "$LOG_FILE"
  echo "  [${tagged_count}] ${tag_name} -> ${short} ${desc}"
done

echo ""
echo "=== Summary ==="
echo "Orphan commits found:     $orphan_count"
echo "Tagged for preservation:  $tagged_count"
echo "Already on branches:    $skipped_count"
echo "Log written to:           $LOG_FILE"
echo ""
echo "To list archived commits:"
echo "  git tag -l '${ARCHIVE_PREFIX}/*'"
echo "To view one:"
echo "  git show <tag-name>"
echo "To clean up later (after verifying nothing is needed):"
echo "  git tag -d \$(git tag -l '${ARCHIVE_PREFIX}/*')"
