#!/bin/bash
# Build Aria Study macOS App
# Run this from native-app/ directory

APP_DIR="$HOME/Desktop/Aria Study.app"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔨 Compiling launcher..."
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

cc -o "$APP_DIR/Contents/MacOS/AriaStudy" "$SRC_DIR/launcher.c" -Wall -O2
if [ $? -ne 0 ]; then
  echo "❌ Compilation failed"
  exit 1
fi

# Copy icon
cp "$SRC_DIR/AppIcon.icns" "$APP_DIR/Contents/Resources/AppIcon.icns" 2>/dev/null

# Info.plist
cat > "$APP_DIR/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>AriaStudy</string>
    <key>CFBundleIdentifier</key>
    <string>com.ariastudy.app</string>
    <key>CFBundleName</key>
    <string>Aria Study</string>
    <key>CFBundleDisplayName</key>
    <string>Aria Study</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
</dict>
</plist>
PLIST

chmod +x "$APP_DIR/Contents/MacOS/AriaStudy"
codesign --force --deep --sign - "$APP_DIR" 2>/dev/null

echo "✅ Build complete!"
echo "📦 $APP_DIR"
