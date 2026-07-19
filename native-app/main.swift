import Cocoa
import WebKit

// ==========================================
// Aria Study — Native macOS App
// Pure Swift — no Node, no browser needed
// ==========================================

let HOME = FileManager.default.homeDirectoryForCurrentUser.path
let PROJECT_DIR = "\(HOME)/Downloads/firstcc/personal-app"
let DATA_FILE = "\(HOME)/.ariastudy-data.json"
let PORT: UInt16 = 3456

// MARK: - Embedded HTTP Server
class AriaServer {
    var listener: Int32 = -1

    func start() -> Bool {
        var addr = sockaddr_in()
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_addr.s_addr = INADDR_ANY
        addr.sin_port = CFSwapInt16HostToBig(PORT)

        let sock = socket(AF_INET, SOCK_STREAM, 0)
        guard sock >= 0 else { return false }
        var opt: Int = 1
        setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, &opt, socklen_t(MemoryLayout<Int>.size))

        let bindRes = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                bind(sock, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        guard bindRes >= 0 else { close(sock); return false }
        guard listen(sock, 128) >= 0 else { close(sock); return false }

        listener = sock

        DispatchQueue.global(qos: .userInitiated).async {
            while true {
                var st = sockaddr_storage()
                var len = socklen_t(MemoryLayout<sockaddr_storage>.size)
                let client = withUnsafeMutablePointer(to: &st) {
                    $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                        accept(sock, $0, &len)
                    }
                }
                guard client >= 0 else { break }
                self.handle(client)
                close(client)
            }
            close(sock)
        }
        return true
    }

    func stop() {
        if listener >= 0 { close(listener); listener = -1 }
    }

    private func handle(_ client: Int32) {
        var buf = [UInt8](repeating: 0, count: 16384)
        let n = read(client, &buf, buf.count)
        guard n > 0 else { return }

        let req = String(decoding: buf[..<min(n, buf.count)], as: UTF8.self)
        guard let line = req.components(separatedBy: "\r\n").first else { return }
        let parts = line.components(separatedBy: " ")
        guard parts.count >= 2 else { return }

        let method = parts[0]
        var path = parts[1]
        if path == "/" { path = "/index.html" }

        // Save data
        if path == "/api/data" && method == "POST" {
            if let range = req.range(of: "\r\n\r\n") {
                let json = String(req[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
                if let d = json.data(using: .utf8) {
                    try? d.write(to: URL(fileURLWithPath: DATA_FILE))
                    respond(client, 200, "{\"ok\":true}", "application/json")
                    return
                }
            }
            respond(client, 400, "Bad Request", "text/plain")
            return
        }

        // Load data
        if path == "/api/data" && method == "GET" {
            if let d = try? Data(contentsOf: URL(fileURLWithPath: DATA_FILE)) {
                respond(client, 200, d, "application/json")
            } else {
                respond(client, 200, "{}", "application/json")
            }
            return
        }

        // Static files
        let cleaned = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let fullPath = (PROJECT_DIR as NSString).appendingPathComponent(cleaned)
        guard fullPath.hasPrefix(PROJECT_DIR) else {
            respond(client, 403, "Forbidden", "text/plain")
            return
        }

        if let d = try? Data(contentsOf: URL(fileURLWithPath: fullPath)) {
            let ext = (fullPath as NSString).pathExtension
            respond(client, 200, d, mimeType(ext))
        } else {
            respond(client, 404, "Not Found", "text/plain")
        }
    }

    private func respond(_ client: Int32, _ status: Int, _ text: String, _ mime: String) {
        if let d = text.data(using: .utf8) { respond(client, status, d, mime) }
    }

    private func respond(_ client: Int32, _ status: Int, _ data: Data, _ mime: String) {
        let st = status == 200 ? "OK" : (status == 404 ? "Not Found" : "Error")
        let h = "HTTP/1.1 \(status) \(st)\r\nContent-Type: \(mime)\r\nContent-Length: \(data.count)\r\nConnection: close\r\n\r\n"
        _ = h.withCString { write(client, $0, strlen($0)) }
        _ = data.withUnsafeBytes { write(client, $0.baseAddress!, $0.count) }
    }

    private func mimeType(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "css":  return "text/css; charset=utf-8"
        case "js":   return "application/javascript; charset=utf-8"
        case "json": return "application/json"
        case "png":  return "image/png"
        case "jpg","jpeg": return "image/jpeg"
        case "svg":  return "image/svg+xml"
        default:     return "application/octet-stream"
        }
    }
}

// MARK: - App Delegate
class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var server: AriaServer!

    func applicationDidFinishLaunching(_ notification: Notification) {
        // 1. Start embedded server
        server = AriaServer()
        let started = server.start()

        // 2. Create window
        let rect = NSRect(x: 0, y: 0, width: 1100, height: 760)
        window = NSWindow(contentRect: rect,
                         styleMask: [.titled, .closable, .miniaturizable, .resizable],
                         backing: .buffered, defer: false)
        window.title = "Aria Study"
        window.center()

        // 3. WKWebView (independent data store from Safari)
        let config = WKWebViewConfiguration()
        config.websiteDataStore = WKWebsiteDataStore.default()
        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.setValue(false, forKey: "drawsBackground")
        window.contentView?.addSubview(webView)

        window.makeKeyAndOrderFront(nil)
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)

        // 4. Load app once server is ready
        if started {
            loadApp()
        }
    }

    func loadApp() {
        let url = URL(string: "http://127.0.0.1:\(PORT)/")!
        var retries = 0
        func retry() {
            retries += 1
            if retries > 30 { return }
            URLSession.shared.dataTask(with: url) { [weak self] (_, resp, _) in
                if let r = resp as? HTTPURLResponse, r.statusCode == 200 {
                    DispatchQueue.main.async {
                        self?.webView.load(URLRequest(url: url))
                    }
                } else {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { retry() }
                }
            }.resume()
        }
        retry()
    }

    func applicationWillTerminate(_ notification: Notification) {
        server?.stop()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}

// MARK: - Entry
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
