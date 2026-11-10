#!/usr/bin/env bash
# Create a release: tag the latest main with the given version and push the tag.
# The CI/CD pipeline then publishes the image to
# ghcr.io/tghcastro/capital-care-v2 as <version>, <major>.<minor> and sha-<sha>.
#
# Usage: scripts/release.sh <version>      e.g. scripts/release.sh 1.2.3
#        (a leading "v" is accepted: v1.2.3)
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <version>   (e.g. 1.2.3)" >&2
  exit 1
fi

version="${1#v}"
if ! [[ "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  echo "Error: '$1' is not a valid version. Use MAJOR.MINOR.PATCH, e.g. 1.2.3" >&2
  exit 1
fi
tag="v${version}"

cd "$(git rev-parse --show-toplevel)"

if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working tree has uncommitted changes. Commit or stash them first." >&2
  exit 1
fi

git fetch --quiet origin main --tags

if git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
  echo "Error: tag ${tag} already exists." >&2
  exit 1
fi

git checkout --quiet main
git merge --ff-only --quiet origin/main

commit="$(git rev-parse --short HEAD)"
echo "Tagging ${tag} on main at ${commit}: $(git log -1 --format=%s)"

git tag -a "$tag" -m "Release ${tag}"
git push origin "$tag"

echo
echo "Pushed ${tag}. The pipeline will publish:"
echo "  ghcr.io/tghcastro/capital-care-v2:${version}"
echo "Watch it at: https://github.com/tghcastro/capital-care-v2/actions"
