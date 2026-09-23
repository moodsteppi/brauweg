import Foundation
import UniformTypeIdentifiers
import WebKit

/// Wohin ein Pfad unter `brauweg://app` im App-Paket zeigt.
enum Paketziel: Equatable {
    /// Die index.html — fuer jeden Pfad ohne Dateiendung.
    case index
    /// Eine Datei, relativ zu `web/`.
    case datei(String)
    /// Ein Pfad, der aus `web/` hinausfuehren wuerde.
    case verboten
}

/// Eine fertige Antwort des Schemas, ohne WebKit — damit pruefbar.
struct Paketantwort {
    let status: Int
    let kopf: [String: String]
    let daten: Data

    static let nichtGefunden = Paketantwort(
        status: 404,
        kopf: ["Content-Type": "text/plain; charset=utf-8", "Content-Length": "0"],
        daten: Data()
    )
}

/// Liefert den gebuendelten Client aus `web/` im App-Paket unter
/// `brauweg://app` aus — das Gegenstueck zu `PaketLader.kt` der Android-Huelle.
///
/// Warum diese Herkunft traegt:
///
/// - **localStorage:** WebKit gibt einem Schema mit eigenem
///   `WKURLSchemeHandler` eine echte Herkunft (`brauweg://app`, nicht `null`
///   wie der Android-WebView). Darunter liegen `localStorage` und
///   `sessionStorage` im Standard-Datenspeicher des WKWebView und ueberleben
///   Neustarts. Dort liegt das Sitzungstoken (`laufzeit.ts`).
/// - **fetch:** Aufrufe an den Server gehen mit `Origin: brauweg://app` hinaus.
///   Der Server gibt genau dieser Herkunft die CORS-Freigabe (`APP_ORIGINS`,
///   `credentials: false`) und beim Anmelden das Token. Cookies spielen
///   bewusst keine Rolle: Fuer WebKit waere das Sitzungs-Cookie ein
///   Drittanbieter-Cookie, und der Client schickt `credentials: 'omit'`.
///   Getragen wird die Sitzung vom `Authorization: Bearer …`-Kopf.
/// - **WebSocket:** Der Handshake an `wss://…/ws` traegt ebenfalls
///   `Origin: brauweg://app` — der Gateway laesst sie zu (`allowedOrigins`
///   in packages/server/src/index.ts) — und das Token als Unterprotokoll
///   hinter `brauweg-token`, weil ein WebSocket keine eigenen Kopfzeilen kennt.
/// - **ATS:** Alles geht ueber HTTPS/WSS; die Info.plist erlaubt Klartext nur
///   zu lokalen Adressen (Entwicklungsserver).
///
/// Zwei Regeln wie beim Server (`setNotFoundHandler` in app.ts): Jeder Pfad
/// ohne Dateiendung ist die index.html (`/beitritt/K7X9MQ` ist eine Adresse
/// des Clients, keine Datei). Eine fehlende Datei ist ehrlich 404 — ein
/// fehlendes Bild soll nicht als HTML-Seite in einem `<img>` landen.
///
/// Alles laeuft synchron im Aufruf von `start`: Dann kann kein `stop`
/// dazwischenkommen, und eine Antwort auf eine abgebrochene Aufgabe (die
/// WebKit mit einer Ausnahme quittiert) gibt es gar nicht erst. Die Dateien
/// sind klein (eine Spielkarte ~80 kB) und werden gemappt, nicht kopiert.
final class PaketSchema: NSObject, WKURLSchemeHandler {

    private let wurzel: URL?

    init(wurzel: URL? = Bundle.main.resourceURL?.appendingPathComponent("web", isDirectory: true)) {
        self.wurzel = wurzel
        super.init()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        let antwort = PaketSchema.antwort(fuer: url, wurzel: wurzel)
        guard let kopf = HTTPURLResponse(url: url, statusCode: antwort.status,
                                         httpVersion: "HTTP/1.1", headerFields: antwort.kopf) else {
            urlSchemeTask.didFailWithError(URLError(.cannotParseResponse))
            return
        }
        urlSchemeTask.didReceive(kopf)
        if !antwort.daten.isEmpty { urlSchemeTask.didReceive(antwort.daten) }
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Nichts zu tun: `start` antwortet synchron, es laeuft nie etwas nach.
    }

    // MARK: - Ohne WebKit, damit pruefbar

    /// Wohin ein Pfad zeigt. `pfad` ist `URL.path`, also schon entschluesselt
    /// (aus `%2e%2e` ist hier `..` geworden).
    static func ziel(fuer pfad: String) -> Paketziel {
        let teile = pfad.split(separator: "/", omittingEmptySubsequences: true).map(String.init)
        if teile.contains("..") { return .verboten }
        guard let letzter = teile.last else { return .index }
        if !letzter.contains(".") { return .index }
        return .datei(teile.joined(separator: "/"))
    }

    static func antwort(fuer url: URL, wurzel: URL?) -> Paketantwort {
        guard url.scheme?.lowercased() == Huelle.schema, url.host?.lowercased() == Huelle.host else {
            return .nichtGefunden
        }
        switch ziel(fuer: url.path) {
        case .verboten:
            return .nichtGefunden
        case .index:
            return index(wurzel: wurzel)
        case .datei(let relativ):
            return datei(relativ, wurzel: wurzel) ?? .nichtGefunden
        }
    }

    private static func index(wurzel: URL?) -> Paketantwort {
        if let wurzel, let daten = try? Data(contentsOf: wurzel.appendingPathComponent("index.html")) {
            return ok(daten, typ: mimeTyp(fuer: "index.html"))
        }
        // Wie unter Android: lieber ein Satz als ein weisser Schirm.
        let hinweis = """
            <!doctype html><meta charset="utf-8">\
            <meta name="viewport" content="width=device-width, initial-scale=1">\
            <body style="background:#1a3f7a;color:#fff;font:17px -apple-system,sans-serif;padding:3em 1.5em">\
            <p>Im App-Paket liegt kein Client.</p>\
            <p>Vor dem Bauen im Repo-Wurzelverzeichnis <code>npm ci</code> und \
            <code>npm run build --workspace @brauweg/client</code> laufen lassen — \
            die Build-Phase „Client ins Paket" legt ihn dann nach <code>web/</code>.</p>
            """
        return ok(Data(hinweis.utf8), typ: mimeTyp(fuer: "index.html"))
    }

    private static func datei(_ relativ: String, wurzel: URL?) -> Paketantwort? {
        guard let wurzel else { return nil }
        let basis = wurzel.standardizedFileURL.path
        let ziel = wurzel.appendingPathComponent(relativ, isDirectory: false).standardizedFileURL
        // Zweite Sicherung neben `.verboten`: Was nicht unter web/ liegt, gibt es nicht.
        guard ziel.path.hasPrefix(basis.hasSuffix("/") ? basis : basis + "/") else { return nil }
        guard let daten = try? Data(contentsOf: ziel, options: .mappedIfSafe) else { return nil }
        return ok(daten, typ: mimeTyp(fuer: relativ))
    }

    private static func ok(_ daten: Data, typ: String) -> Paketantwort {
        Paketantwort(
            status: 200,
            kopf: [
                "Content-Type": typ,
                "Content-Length": String(daten.count),
                // Die Dateien sind ohnehin oeffentlich. Die Freigabe ist eine
                // Versicherung fuer Vite's `<script type="module" crossorigin>`:
                // Die Anfrage laeuft im CORS-Modus, und ob WebKit ein eigenes
                // Schema dabei als gleiche Herkunft zaehlt, soll keine Rolle spielen.
                "Access-Control-Allow-Origin": "*",
            ],
            daten: daten
        )
    }

    /// Der Inhaltstyp einer Datei. Modul-Skripte verlangen einen
    /// JavaScript-Typ — mit `application/octet-stream` bliebe der Schirm leer.
    static func mimeTyp(fuer pfad: String) -> String {
        let endung = (pfad as NSString).pathExtension.lowercased()
        switch endung {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "map": return "application/json"
        case "webmanifest": return "application/manifest+json"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "gif": return "image/gif"
        case "ico": return "image/x-icon"
        case "mp3": return "audio/mpeg"
        case "wav": return "audio/wav"
        case "ogg": return "audio/ogg"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        case "wasm": return "application/wasm"
        case "glb": return "model/gltf-binary"
        case "gltf": return "model/gltf+json"
        case "txt": return "text/plain; charset=utf-8"
        default:
            return UTType(filenameExtension: endung)?.preferredMIMEType ?? "application/octet-stream"
        }
    }
}
