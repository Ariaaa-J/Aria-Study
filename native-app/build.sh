#!/bin/bash
# Build Aria Study macOS App
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR/Aria Study.app"

echo "🔨 Compiling Aria Study..."
swiftc -o "$APP_DIR/Contents/MacOS/main" \
  -target arm64-apple-macos11.0 \
  "$SCRIPT_DIR/main.swift" \
  -framework WebKit -framework Cocoa 2>&1

if [ $? -eq 0 ]; then
  codesign --force --deep --sign - "$APP_DIR" 2>/dev/null
  echo "✅ Build successful!"
  echo "📦 App at: $APP_DIR"
else
  echo "❌ Build failed"
  exit 1
fi
