#!/usr/bin/env bash

set -eu

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

current_hooks_path="$(git config --local --get core.hooksPath || true)"

if [ "$current_hooks_path" = ".husky" ] || [ "$current_hooks_path" = ".husky/_" ]; then
  git config --local --unset core.hooksPath || true
fi

pnpm exec lefthook install
