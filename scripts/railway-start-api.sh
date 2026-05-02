#!/usr/bin/env sh
# Resolve monorepo root from this script's path so we work regardless of container WORKDIR
# (Railpack/Railway may not use /app at runtime).
set -e
case "$0" in
  /*) SCRIPT_DIR="${0%/*}" ;;
  *) SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)" ;;
esac
ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
if [ -f "$ROOT/server/dist/index.js" ]; then
  cd "$ROOT/server"
  exec node dist/index.js
elif [ -f "$ROOT/dist/index.js" ]; then
  cd "$ROOT"
  exec node dist/index.js
else
  echo "bestie: missing API bundle (expected $ROOT/server/dist/index.js or $ROOT/dist/index.js)" >&2
  ls -la "$ROOT" 2>&1 || true
  exit 1
fi
