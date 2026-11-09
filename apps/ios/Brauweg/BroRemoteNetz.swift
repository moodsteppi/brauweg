import Foundation
import Network

/// Transport allein. Räume, Sitzrechte und Eingaben prüft derselbe TS-Kern wie im Relay.
final class BroRemoteNetz {
    var melden: (([String: Any]) -> Void)?
    private var lauscher: NWListener?
    private var verbindungen: [String: NWConnection] = [:]
    private var wartend: [String: Int] = [:]
    private var raten: [String: (zeit: TimeInterval, anzahl: Int)] = [:]
    private var lauf = UUID()

    static func lokaleAdresse(_ text: String) -> URL? {
        guard let u = URL(string: text), u.scheme == "ws", u.user == nil, u.password == nil,
              u.path == "/broremote", u.query == nil, u.fragment == nil,
              let port = u.port, (1...65535).contains(port), let host = u.host else { return nil }
        let teile = host.split(separator: ".", omittingEmptySubsequences: false)
        guard teile.count == 4, teile.allSatisfy({ !$0.isEmpty && $0.allSatisfy({ $0.isASCII && $0.isNumber }) }) else { return nil }
        let p = teile.compactMap { Int($0) }
        guard p.count == 4, p.allSatisfy({ (0...255).contains($0) }),
              p[0] == 10 || (p[0] == 192 && p[1] == 168) || (p[0] == 172 && (16...31).contains(p[1])) || (p[0] == 169 && p[1] == 254) else { return nil }
        return u
    }

    private func parameter() -> NWParameters {
        let tcp = NWProtocolTCP.Options()
        tcp.noDelay = true
        let p = NWParameters(tls: nil, tcp: tcp)
        let ws = NWProtocolWebSocket.Options()
        ws.autoReplyPing = true
        ws.maximumMessageSize = 8192
        p.defaultProtocolStack.applicationProtocols.insert(ws, at: 0)
        return p
    }

    func befehl(_ d: [String: Any]) {
        guard let art = d["art"] as? String else { return }
        switch art {
        case "host": starten()
        case "verbinden":
            guard let id = d["id"] as? String, id.count <= 80,
                  let adresse = d["adresse"] as? String, let url = Self.lokaleAdresse(adresse), verbindungen.count < 8 else {
                melden?(["art": "fehler", "text": "Ungültige lokale Verbindung."]); return
            }
            trennen(id)
            let c = NWConnection(to: .url(url), using: parameter())
            anbinden(c, id: id)
        case "senden":
            guard let id = d["id"] as? String, let text = d["text"] as? String,
                  text.utf8.count <= 8192, let c = verbindungen[id] else { return }
            let menge = (wartend[id] ?? 0) + text.utf8.count
            guard menge <= 65536 else { trennen(id); return }
            wartend[id] = menge
            let m = NWProtocolWebSocket.Metadata(opcode: .text)
            let kontext = NWConnection.ContentContext(identifier: "broremote", metadata: [m])
            c.send(content: text.data(using: .utf8), contentContext: kontext, isComplete: true,
                   completion: .contentProcessed { [weak self, weak c] fehler in
                guard let self, let c, self.verbindungen[id] === c else { return }
                self.wartend[id] = max(0, (self.wartend[id] ?? 0) - text.utf8.count)
                if fehler != nil { self.trennen(id) }
            })
        case "trennen": if let id = d["id"] as? String { trennen(id) }
        case "stop": stoppen()
        default: break
        }
    }

    private func starten() {
        stoppen()
        let kennung = lauf
        do {
            let l = try NWListener(using: parameter(), on: .any)
            lauscher = l
            l.stateUpdateHandler = { [weak self, weak l] stand in
                guard let self, self.lauf == kennung else { return }
                switch stand {
                case .ready:
                    guard let port = l?.port else { return }
                    let adressen = Self.adressen().map { "ws://\($0):\(port.rawValue)/broremote" }
                    guard !adressen.isEmpty else {
                        self.melden?(["art": "fehler", "text": "Verbinde dieses Gerät mit einem WLAN oder aktiviere deinen persönlichen Hotspot."])
                        self.stoppen(); return
                    }
                    self.melden?(["art": "bereit", "adressen": adressen])
                case .failed:
                    self.melden?(["art": "fehler", "text": "Lokales Netzwerk nicht verfügbar. Prüfe die WLAN-Verbindung und die Freigabe in den iOS-Einstellungen."])
                    self.stoppen()
                default: break
                }
            }
            l.newConnectionHandler = { [weak self] c in
                guard let self, self.lauf == kennung, self.verbindungen.count < 8 else { c.cancel(); return }
                self.anbinden(c, id: UUID().uuidString)
            }
            l.start(queue: .main)
        } catch { melden?(["art": "fehler", "text": "Die lokale Lobby konnte nicht gestartet werden."]) }
    }

    private func anbinden(_ c: NWConnection, id: String) {
        verbindungen[id] = c
        c.stateUpdateHandler = { [weak self, weak c] stand in
            guard let self, let c, self.verbindungen[id] === c else { return }
            switch stand {
            case .ready:
                self.melden?(["art": "offen", "id": id])
                self.empfangen(c, id: id)
            case .failed, .cancelled: self.trennen(id)
            case .waiting:
                self.melden?(["art": "wartet", "id": id, "text": "Warte auf das lokale Netzwerk. Prüfe WLAN und Netzwerkfreigabe."])
            default: break
            }
        }
        c.start(queue: .main)
        // Auch ein Gerät ohne vollständigen WebSocket-Handshake darf keinen Platz ewig belegen.
        DispatchQueue.main.asyncAfter(deadline: .now() + 12) { [weak self, weak c] in
            guard let self, let c, self.verbindungen[id] === c else { return }
            if c.state != .ready { self.trennen(id) }
        }
    }

    private func empfangen(_ c: NWConnection, id: String) {
        c.receiveMessage { [weak self, weak c] daten, kontext, _, fehler in
            guard let self, let c, self.verbindungen[id] === c else { return }
            guard fehler == nil else { self.trennen(id); return }
            let jetzt = ProcessInfo.processInfo.systemUptime
            var rate = self.raten[id] ?? (zeit: jetzt, anzahl: 0)
            if jetzt - rate.zeit >= 1 { rate = (zeit: jetzt, anzahl: 0) }
            rate.anzahl += 1; self.raten[id] = rate
            guard rate.anzahl <= 100 else { self.trennen(id); return }
            let meta = kontext?.protocolMetadata(definition: NWProtocolWebSocket.definition) as? NWProtocolWebSocket.Metadata
            if meta?.opcode == .close { self.trennen(id); return }
            if meta?.opcode == .text, let daten, daten.count <= 8192, let text = String(data: daten, encoding: .utf8) {
                self.melden?(["art": "text", "id": id, "text": text])
            } else if meta?.opcode == .binary { self.trennen(id); return }
            self.empfangen(c, id: id)
        }
    }

    private func trennen(_ id: String) {
        guard let c = verbindungen.removeValue(forKey: id) else { return }
        wartend.removeValue(forKey: id); raten.removeValue(forKey: id)
        c.cancel()
        melden?(["art": "zu", "id": id])
    }

    func stoppen() {
        lauf = UUID()
        lauscher?.cancel(); lauscher = nil
        for id in Array(verbindungen.keys) { trennen(id) }
    }

    func hintergrund() {
        let warHost = lauscher != nil
        stoppen()
        melden?(["art": "hintergrund", "host": warHost])
    }

    private static func adressen() -> [String] {
        var liste: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&liste) == 0, let anfang = liste else { return [] }
        defer { freeifaddrs(liste) }
        var treffer: [(String, String)] = []
        for zeiger in sequence(first: anfang, next: { $0.pointee.ifa_next }) {
            let i = zeiger.pointee
            guard let a = i.ifa_addr, a.pointee.sa_family == UInt8(AF_INET), (i.ifa_flags & UInt32(IFF_UP)) != 0 else { continue }
            let name = String(cString: i.ifa_name)
            guard name == "en0" || name.hasPrefix("bridge") || name.hasPrefix("ap") else { continue }
            var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            guard getnameinfo(a, socklen_t(a.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 else { continue }
            let ip = String(cString: host)
            if lokaleAdresse("ws://\(ip):1/broremote") != nil { treffer.append((name, ip)) }
        }
        // Der eigene Hotspot ist über die Bridge erreichbar, nicht über Mobilfunk.
        return treffer.sorted { $0.0 < $1.0 }.map { $0.1 }
    }
}
