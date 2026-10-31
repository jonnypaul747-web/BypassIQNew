#!/bin/bash
# JustCilledAI - Easy Launch Script
echo "🚀 Starting JustCilledAI..."

APP_PATH="$(cd "$(dirname "$0")" && pwd)/release/mac-arm64/JustCilledAI.app"
BINARY="$APP_PATH/Contents/MacOS/JustCilledAI"

# Clear quarantine just in case
xattr -cr "$APP_PATH" 2>/dev/null
chmod +x "$BINARY" 2>/dev/null

# Launch the app
echo "✅ Launching app..."
open "$APP_PATH"

