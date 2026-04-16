#!/usr/bin/env bash
# postinstall-reapply.sh
# Reapplies the hermes-paperclip-adapter instructionsFilePath patch after pnpm install.
# Exits non-zero if patch cannot be applied — blocks subsequent pnpm scripts.

set -euo pipefail

ADAPTER_REPO="${HOME}/Documents/data/research/projects/hermes-paperclip-adapter"
SERVER_REPO="${HOME}/Documents/data/research/projects/paperclip-server"

if [ ! -d "$ADAPTER_REPO" ]; then
  echo "postinstall-reapply: adapter repo not found at $ADAPTER_REPO — skipping (this is not a ZHC install)"
  exit 0
fi

ADAPTER_V=$(grep '"version"' "$ADAPTER_REPO/package.json" | head -1 | awk '{print $2}' | sed 's/[",]//g')
TARGET_DIR="$SERVER_REPO/node_modules/.pnpm/hermes-paperclip-adapter@${ADAPTER_V}/node_modules/hermes-paperclip-adapter"

if [ ! -d "$TARGET_DIR" ]; then
  echo "postinstall-reapply: target not found at $TARGET_DIR — adapter not installed from npm cache yet"
  exit 0
fi

echo "postinstall-reapply: building adapter from $ADAPTER_REPO"
(cd "$ADAPTER_REPO" && npm run build)

echo "postinstall-reapply: copying dist into pnpm store"
cp -R "$ADAPTER_REPO"/dist/* "$TARGET_DIR/dist/"

EXECUTE_JS="$TARGET_DIR/dist/server/execute.js"
HITS=$(grep -c "instructionsFilePath" "$EXECUTE_JS" || echo 0)

if [ "$HITS" -lt 5 ]; then
  echo "postinstall-reapply: PATCH VERIFICATION FAILED ($HITS hits, expected >=5)" >&2
  exit 1
fi

echo "postinstall-reapply: OK ($HITS hits in execute.js)"
