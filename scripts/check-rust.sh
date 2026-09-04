#!/usr/bin/env bash

set -euo pipefail

package_count="$(
  cargo metadata --no-deps --format-version 1 |
    node -e '
      let input = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => {
        input += chunk;
      });
      process.stdin.on("end", () => {
        process.stdout.write(String(JSON.parse(input).packages.length));
      });
    '
)"

if [ "${package_count}" -eq 0 ]; then
  printf 'No Rust packages are present; workspace metadata is valid.\n'
  exit 0
fi

cargo fmt --all -- --check
cargo clippy --workspace --all-targets
cargo test --workspace
