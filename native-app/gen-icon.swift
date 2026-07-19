import Cocoa

// ==========================================
// Aria Study Icon Generator — macOS Rounded
// ==========================================

func createRoundedIcon(size: CGFloat) -> NSImage {
    let image = NSImage(size: NSSize(width: size, height: size))
    image.lockFocus()

    let rect = NSRect(x: 0, y: 0, width: size, height: size)
    let radius = size * 0.22  // macOS standard corner radius

    // Clip to rounded rect
    let clipPath = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
    clipPath.addClip()

    // White background
    NSColor.white.setFill()
    rect.fill()

    // Very thin border
    let borderColor = NSColor(white: 0.88, alpha: 1.0)
    borderColor.setStroke()
    let borderPath = NSBezierPath(roundedRect: rect.insetBy(dx: 0.5, dy: 0.5),
                                  xRadius: radius, yRadius: radius)
    borderPath.lineWidth = 0.5
    borderPath.stroke()

    // Gold accent color (#8f6200)
    let gold = NSColor(red: 143/255, green: 98/255, blue: 0, alpha: 1)

    // Draw 4-point star ✦
    let cx = size / 2
    let cy = size * 0.52  // slightly above center
    let outerR = size * 0.28
    let innerR = size * 0.10

    let starPath = NSBezierPath()
    for i in 0..<8 {
        let angle = Double(i) * .pi / 4 - .pi / 2
        let r = (i % 2 == 0) ? outerR : innerR
        let x = cx + CGFloat(cos(angle)) * r
        let y = cy + CGFloat(sin(angle)) * r
        if i == 0 { starPath.move(to: NSPoint(x: x, y: y)) }
        else { starPath.line(to: NSPoint(x: x, y: y)) }
    }
    starPath.close()

    gold.setFill()
    starPath.fill()

    // Subtle gradient overlay for depth
    let gradient = NSGradient(
        colors: [NSColor.black.withAlphaComponent(0.03),
                 NSColor.clear]
    )
    gradient?.draw(in: rect, angle: -45)

    image.unlockFocus()
    return image
}

// Generate iconset
let iconsetDir = "/tmp/AriaStudy.iconset"
try? FileManager.default.removeItem(atPath: iconsetDir)
try? FileManager.default.createDirectory(atPath: iconsetDir, withIntermediateDirectories: true)

let sizes: [(Int, String)] = [
    (16, "icon_16x16"), (32, "icon_16x16@2x"),
    (32, "icon_32x32"), (64, "icon_32x32@2x"),
    (128, "icon_128x128"), (256, "icon_128x128@2x"),
    (256, "icon_256x256"), (512, "icon_256x256@2x"),
    (512, "icon_512x512"), (1024, "icon_512x512@2x"),
]

for (s, name) in sizes {
    let img = createRoundedIcon(size: CGFloat(s))
    let bitmap = NSBitmapImageRep(data: img.tiffRepresentation!)!
    let png = bitmap.representation(using: .png, properties: [:])!
    try png.write(to: URL(fileURLWithPath: "\(iconsetDir)/\(name).png"))
    print("  ✅ \(name).png")
}

print("\nAll done!")
