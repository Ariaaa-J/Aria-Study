import Cocoa
import WebKit

// ==========================================
// Aria Study — Native macOS App
// ==========================================

class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var serverTask: Process?

    let PROJECT_PATH = "/Users/wenyiji/Downloads/firstcc/personal-app"
    let NODE_PATH = "/Users/wenyiji/.local/node/bin/node"

    func applicationDidFinishLaunching(_ notification: Notification) {
        startServer()

        let windowRect = NSRect(x: 0, y: 0, width: 1100, height: 760)
        window = NSWindow(
            contentRect: windowRect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Aria Study"
        window.center()

        let config = WKWebViewConfiguration()
        config.websiteDataStore = WKWebsiteDataStore.default()

        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.setValue(false, forKey: "drawsBackground")
        window.contentView?.addSubview(webView)

        window.makeKeyAndOrderFront(nil)
        NSApp.setActivationPolicy(.regular)

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            self?.loadApp()
        }
    }

    func startServer() {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/bin/bash")
        task.arguments = ["-c", "cd '\(PROJECT_PATH)' && exec '\(NODE_PATH)' server.js"]
        task.standardOutput = FileHandle.nullDevice
        task.standardError = FileHandle.nullDevice
        serverTask = task
        try? task.run()
    }

    func loadApp() {
        let url = URL(string: "http://127.0.0.1:3000")!
        func retry(_ n: Int = 0) {
            if n > 50 { return }
            URLSession.shared.dataTask(with: url) { [weak self] (_, resp, _) in
                if let r = resp as? HTTPURLResponse, r.statusCode == 200 {
                    DispatchQueue.main.async {
                        self?.webView.load(URLRequest(url: url))
                    }
                } else {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                        retry(n + 1)
                    }
                }
            }.resume()
        }
        retry()
    }

    func applicationWillTerminate(_ notification: Notification) {
        serverTask?.terminate()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}

// Manual start — `@main` doesn't work correctly for NSApplication delegates
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
