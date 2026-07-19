#!/bin/bash
# Build Aria Study macOS App (pure Swift, no Node)

APP_DIR="$HOME/Desktop/Aria Study.app"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔨 Compiling..."
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"

swiftc -o "$APP_DIR/Contents/MacOS/AriaStudy" \
  -target arm64-apple-macos11.0 \
  "$SRC_DIR/main.swift" \
  -framework WebKit -framework Cocoa 2>&1

if [ $? -ne 0 ]; then echo "❌ Failed"; exit 1; fi

# Icon
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
    <string>2.0</string>
    <key>CFBundleVersion</key>
    <string>2</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsLocalNetworking</key>
        <true/>
    </dict>
</dict>
</plist>
PLIST

codesign --force --deep --sign - "$APP_DIR" 2>/dev/null
echo "✅ Build complete! → $APP_DIR"
