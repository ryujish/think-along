#!/usr/bin/env bash
set -euo pipefail

tools=/home/opc/thinkalong-tools
cli_bin=/home/opc/.local/bin
mkdir -p "$tools" "$cli_bin"
command -v python3 >/dev/null

npm install --prefix "$tools" --omit=dev --no-audit --no-fund @openai/codex@0.169.0
ln -sfn "$tools/node_modules/.bin/codex" "$cli_bin/codex"

installers=$(mktemp -d)
trap 'rm -rf "$installers"' EXIT
curl --fail --silent --show-error --location https://antigravity.google/cli/install.sh -o "$installers/agy.sh"
bash "$installers/agy.sh" --dir "$cli_bin"
curl --fail --silent --show-error --location https://dev.meta.ai/install.sh -o "$installers/muse.sh"
MUSE_INSTALL_DIR="$cli_bin" bash "$installers/muse.sh"

"$cli_bin/codex" --version
"$cli_bin/agy" --version
"$cli_bin/muse" --version

cd "$(dirname "${BASH_SOURCE[0]}")/.."
PATH="$cli_bin:$PATH" node scripts/check-cli-oauth.mjs
