#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "=== Starting JustCilledAI Desktop Assistant ==="

# Clear macOS quarantine flags for locally built unsigned bundle
if [ -d "release/mac-arm64/JustCilledAI.app" ]; then
  xattr -cr "release/mac-arm64/JustCilledAI.app" 2>/dev/null || true
  chmod -R 755 "release/mac-arm64/JustCilledAI.app" 2>/dev/null || true
  open "release/mac-arm64/JustCilledAI.app"
  echo "JustCilledAI.app launched successfully!"
else
  ELECTRON_RUN_AS_NODE="" ./node_modules/.bin/electron .
fi

