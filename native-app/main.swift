import Cocoa
import WebKit
import UniformTypeIdentifiers

// ==========================================
// Aria Study — Native macOS Desktop App
// Pure Swift + WKWebView + Native File Dialogs
// ==========================================

let HOME = FileManager.default.homeDirectoryForCurrentUser.path
let PROJECT_DIR = "\(HOME)/Downloads/firstcc/personal-app"
let DATA_FILE = "\(HOME)/.ariastudy-data.json"
let PORT: UInt16 = 3456

// MARK: - Embedded HTTP Server
class AriaServer {
    var running = false
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
        let ok = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { bind(sock, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) }
        }
        guard ok >= 0 else { close(sock); return false }
        guard listen(sock, 128) >= 0 else { close(sock); return false }
        listener = sock; running = true
        DispatchQueue.global(qos: .userInitiated).async { self.acceptLoop(sock) }
        return true
    }

    func stop() { running = false; if listener >= 0 { close(listener); listener = -1 } }

    private func acceptLoop(_ sock: Int32) {
        while running {
            var st = sockaddr_storage(); var len = socklen_t(MemoryLayout<sockaddr_storage>.size)
            let c = withUnsafeMutablePointer(to: &st) { $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { accept(sock, $0, &len) } }
            guard c >= 0 else { break }
            handle(c); close(c)
        }
        close(sock)
    }

    private func handle(_ c: Int32) {
        var buf = [UInt8](repeating: 0, count: 16384)
        let n = read(c, &buf, buf.count); guard n > 0 else { return }
        let req = String(decoding: buf[..<min(n, buf.count)], as: UTF8.self)
        guard let line = req.components(separatedBy: "\r\n").first else { return }
        let parts = line.components(separatedBy: " "); guard parts.count >= 2 else { return }
        let method = parts[0]; var path = parts[1]
        if path == "/" { path = "/index.html" }

        if path == "/api/data" && method == "POST" {
            if let r = req.range(of: "\r\n\r\n") {
                let json = String(req[r.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
                if let d = json.data(using: .utf8) { try? d.write(to: URL(fileURLWithPath: DATA_FILE)) }
            }
            respond(c, 200, d: Data("{\"ok\":true}".utf8), m: "application/json"); return
        }
        if path == "/api/data" && method == "GET" {
            if let d = try? Data(contentsOf: URL(fileURLWithPath: DATA_FILE)) { respond(c, 200, d: d, m: "application/json") }
            else { respond(c, 200, d: Data("{}".utf8), m: "application/json") }
            return
        }

        let cleaned = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let full = (PROJECT_DIR as NSString).appendingPathComponent(cleaned)
        guard full.hasPrefix(PROJECT_DIR) else { respond(c, 403, t: "Forbidden"); return }
        if let d = try? Data(contentsOf: URL(fileURLWithPath: full)) { respond(c, 200, d: d, m: mime((full as NSString).pathExtension)) }
        else { respond(c, 404, t: "Not Found") }
    }

    private func respond(_ c: Int32, _ s: Int, t: String) { if let d = t.data(using: .utf8) { respond(c, s, d: d, m: "text/plain") } }
    private func respond(_ c: Int32, _ s: Int, d: Data, m: String) {
        let st = s == 200 ? "OK" : (s == 404 ? "Not Found" : "Error")
        _ = "HTTP/1.1 \(s) \(st)\r\nContent-Type: \(m)\r\nContent-Length: \(d.count)\r\nConnection: close\r\n\r\n".withCString { write(c, $0, strlen($0)) }
        _ = d.withUnsafeBytes { write(c, $0.baseAddress!, $0.count) }
    }

    private func mime(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "js": return "application/javascript; charset=utf-8"
        case "json": return "application/json"
        case "png": return "image/png"
        case "jpg","jpeg": return "image/jpeg"
        case "svg": return "image/svg+xml"
        default: return "application/octet-stream"
        }
    }
}

// MARK: - Native File Bridge (JS ↔ Swift)
class FileBridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?

    func userContentController(_ ucc: WKUserContentController, didReceive msg: WKScriptMessage) {
        switch msg.name {
        case "importFile":
            showOpenPanel()
        case "exportFile":
            if let json = msg.body as? String { showSavePanel(json) }
        case "saveData":
            if let dict = msg.body as? [String: Any] { saveToDisk(dict) }
        case "loadData":
            loadFromDisk()
        default:
            break
        }
    }

    func showOpenPanel() {
        let panel = NSOpenPanel()
        panel.title = "导入 Aria Study 数据"
        panel.message = "选择之前导出的 JSON 备份文件"
        panel.allowedContentTypes = [UTType.json]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false

        panel.begin { [weak self] result in
            guard result == .OK, let url = panel.url else { return }
            guard let data = try? Data(contentsOf: url) else { return }
            guard let json = String(data: data, encoding: .utf8) else { return }

            // Inject data into localStorage and sync to server
            let js = """
            (function() {
                try {
                    var data = JSON.parse(\(String(reflecting: json)));
                    var keys = ['personal_app_notes','personal_app_words','personal_app_quizzes',
                               'personal_app_settings','personal_app_recent_notes',
                               'personal_app_pinned_notes','personal_app_speaking'];
                    var count = 0;
                    keys.forEach(function(k) {
                        if (data[k] || data[k.replace('personal_app_','')]) {
                            var val = data[k] || data[k.replace('personal_app_','')];
                            localStorage.setItem(k, JSON.stringify(val));
                            count++;
                        }
                    });
                    // Trigger sync to server
                    if (typeof STORAGE !== 'undefined' && STORAGE.syncAllToServer) {
                        STORAGE.syncAllToServer();
                    }
                    return '✅ 已导入 ' + count + ' 项数据';
                } catch(e) { return '❌ ' + e.message; }
            })();
            """
            self?.webView?.evaluateJavaScript(js) { result, _ in
                if let msg = result as? String {
                    self?.webView?.evaluateJavaScript("showToast(\(String(reflecting: msg)))")
                    // Reload current page to reflect data
                    self?.webView?.evaluateJavaScript("if(window.APP)APP.navigateTo(APP.getCurrentPage())")
                }
            }
        }
    }

    func showSavePanel(_ json: String) {
        let panel = NSSavePanel()
        panel.title = "导出 Aria Study 数据"
        panel.nameFieldStringValue = "AriaStudy-\(formattedDate()).json"
        panel.allowedContentTypes = [UTType.json]

        panel.begin { [weak self] result in
            guard result == .OK, let url = panel.url else { return }
            try? json.write(to: url, atomically: true, encoding: .utf8)
            self?.webView?.evaluateJavaScript("showToast('✅ 数据已导出到: \(url.lastPathComponent)')")
        }
    }

    func saveToDisk(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict, options: [.prettyPrinted]) else { return }
        try? data.write(to: URL(fileURLWithPath: DATA_FILE))
    }

    func loadFromDisk() {
        guard let data = try? Data(contentsOf: URL(fileURLWithPath: DATA_FILE)),
              let json = String(data: data, encoding: .utf8) else { return }
        let escaped = json.replacingOccurrences(of: "\\", with: "\\\\")
                         .replacingOccurrences(of: "'", with: "\\'")
        let js = """
        (function() {
            try {
                var data = JSON.parse('\(escaped)');
                var loaded = 0;
                Object.keys(data).forEach(function(k) {
                    localStorage.setItem(k, JSON.stringify(data[k]));
                    loaded++;
                });
                return loaded;
            } catch(e) { return 0; }
        })();
        """
        webView?.evaluateJavaScript(js) { result, _ in
            if let count = result as? Int, count > 0 {
                self.webView?.evaluateJavaScript("if(window.APP)APP.navigateTo(APP.getCurrentPage())")
            }
        }
    }

    private func formattedDate() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date())
    }
}

// MARK: - Inject bridge JS into web pages
let BRIDGE_JS = """
(function() {
    // Override exportData to use native save panel
    window.exportData = function() {
        try {
            var data = {};
            var keys = ['personal_app_notes','personal_app_words','personal_app_quizzes',
                       'personal_app_settings','personal_app_recent_notes',
                       'personal_app_pinned_notes','personal_app_speaking'];
            keys.forEach(function(k) {
                var val = localStorage.getItem(k);
                if (val) data[k] = JSON.parse(val);
            });
            window.webkit.messageHandlers.exportFile.postMessage(JSON.stringify(data, null, 2));
        } catch(e) { alert('Export error: ' + e.message); }
    };
    // Override importData to use native open panel
    window.importData = function() {
        window.webkit.messageHandlers.importFile.postMessage('');
    };
    // Call this after any data change to trigger disk sync
    var origSetItem = localStorage.setItem;
    localStorage.setItem = function(key, val) {
        origSetItem.call(localStorage, key, val);
        try {
            var allKeys = ['personal_app_notes','personal_app_words','personal_app_quizzes',
                          'personal_app_settings','personal_app_recent_notes',
                          'personal_app_pinned_notes','personal_app_speaking'];
            if (allKeys.indexOf(key) >= 0) {
                var data = {};
                allKeys.forEach(function(k) {
                    var v = localStorage.getItem(k);
                    if (v) data[k] = JSON.parse(v);
                });
                window.webkit.messageHandlers.saveData.postMessage(data);
            }
        } catch(e) {}
    };
    // On page load, restore from disk
    setTimeout(function() {
        window.webkit.messageHandlers.loadData.postMessage('');
    }, 100);
})();
"""

// MARK: - App Delegate
class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var server: AriaServer!
    var bridge: FileBridge!

    func applicationDidFinishLaunching(_ notification: Notification) {
        // 1. Start server
        server = AriaServer()
        let started = server.start()

        // 2. Native file bridge
        bridge = FileBridge()
        let uc = WKUserContentController()
        uc.add(bridge, name: "importFile")
        uc.add(bridge, name: "exportFile")
        uc.add(bridge, name: "saveData")
        uc.add(bridge, name: "loadData")
        uc.addUserScript(WKUserScript(source: BRIDGE_JS, injectionTime: .atDocumentEnd, forMainFrameOnly: true))

        // 3. Window
        let rect = NSRect(x: 0, y: 0, width: 1100, height: 760)
        window = NSWindow(contentRect: rect, styleMask: [.titled, .closable, .miniaturizable, .resizable],
                         backing: .buffered, defer: false)
        window.title = "Aria Study"
        window.center()

        // 4. WKWebView
        let config = WKWebViewConfiguration()
        config.userContentController = uc
        config.websiteDataStore = WKWebsiteDataStore.default()
        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.setValue(false, forKey: "drawsBackground")
        window.contentView?.addSubview(webView)

        window.makeKeyAndOrderFront(nil)
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)

        // 5. Load
        bridge.webView = webView
        if started { loadApp() }
    }

    func loadApp() {
        let url = URL(string: "http://127.0.0.1:\(PORT)/")!
        var tries = 0
        func retry() {
            tries += 1; if tries > 30 { return }
            URLSession.shared.dataTask(with: url) { [weak self] (_, resp, _) in
                if let r = resp as? HTTPURLResponse, r.statusCode == 200 {
                    DispatchQueue.main.async { self?.webView.load(URLRequest(url: url)) }
                } else { DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { retry() } }
            }.resume()
        }
        retry()
    }

    func applicationWillTerminate(_ notification: Notification) {
        // Save one last time
        webView?.evaluateJavaScript("""
            try {
                var data = {};
                ['personal_app_notes','personal_app_words','personal_app_quizzes',
                 'personal_app_settings','personal_app_recent_notes',
                 'personal_app_pinned_notes','personal_app_speaking'].forEach(function(k) {
                    var v = localStorage.getItem(k);
                    if (v) data[k] = JSON.parse(v);
                });
                window.webkit.messageHandlers.saveData.postMessage(data);
            } catch(e) {}
        """)
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
