#!/usr/bin/env bash
set -euo pipefail
repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
dir=$(dirname "$0")
id=$(gh api "repos/$repo/rulesets" --jq '.[] | select(.name == "main protection") | .id')
if [[ -n "$id" ]]; then
  gh api -X PUT "repos/$repo/rulesets/$id" --input "$dir/ruleset.json"
else
  gh api -X POST "repos/$repo/rulesets" --input "$dir/ruleset.json"
fi
