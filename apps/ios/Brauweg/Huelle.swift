import Foundation

/// Was die Huelle ueber sich weiss — an einer Stelle, wie `Huelle.kt` in der
/// Android-Huelle (apps/android).
///
/// Der Client liegt im App-Paket (`web/`, Build-Phase „Client ins Paket",
/// werkzeug/web-einbauen.sh) und wird unter [herkunft] ausgeliefert. Dass es
/// genau diese Adresse ist, hat einen Grund, der im Server steht
/// (`APP_ORIGIN` in packages/server/src/http/app.ts): Nur an `brauweg://app`
/// und an die Android-Herkunft gibt der Server das Sitzungstoken heraus.
/// `packages/server/test/app-ios.test.ts` haelt beide Seiten gegeneinander.
enum Huelle {
    /// Das eigene Schema. Kein `file://`: Dort ist jede Datei eine eigene
    /// Herkunft, und `localStorage`, `fetch` und der WebSocket faenden nicht
    /// zueinander.
    static let schema = "brauweg"
    static let host = "app"
    static let herkunft = "brauweg://app"

    /// Wohin die App ohne Link startet.
    static let startAdresse = URL(string: "brauweg://app/")!

    /// Wo der Server steht — Build-Einstellung `BRAUWEG_API_BASE`, ueber die
    /// Info.plist (`BrauwegApiBasis`). Debug: Staging, Release: Produktion
    /// (project.yml). Ist sie leer oder nicht ersetzt, gilt die Produktion:
    /// Eine App, die ins Leere funkt, waere der schlechtere Fehler.
    static let apiBasis: String = {
        let roh = Bundle.main.object(forInfoDictionaryKey: "BrauwegApiBasis") as? String
        return bereinigt(roh) ?? "https://www.brauweg-spielen.de"
    }()

    /// Der Host des eingestellten Servers, klein geschrieben.
    static var serverHost: String {
        URL(string: apiBasis)?.host?.lowercased() ?? ""
    }

    /// Push-Mitteilungen: nur vorbereitet, Vorgabe AUS (Build-Einstellung
    /// `BRAUWEG_PUSH`, siehe project.yml). Die Server-Seite baut ein anderer
    /// Auftrag; bis sie steht, fragt die App niemanden um Erlaubnis.
    static let pushEingeschaltet: Bool = {
        let roh = Bundle.main.object(forInfoDictionaryKey: "BrauwegPush") as? String ?? ""
        return roh.trimmingCharacters(in: .whitespaces).uppercased() == "YES"
    }()

    /// Die Hosts, deren Einladungslinks die App oeffnet — dieselben wie in den
    /// Associated Domains (Konfiguration/Push-*.entitlements).
    static let linkHosts: Set<String> = ["www.brauweg-spielen.de", "staging.brauweg-spielen.de"]

    /// Der Einladungslink (#203), genau in der Form, die der Client selbst liest
    /// (`PFAD` in packages/client/src/minispiele/partykiste/einladungslink.ts).
    static let beitrittMuster = "^/beitritt/([A-Za-z0-9-]{4,24})/?$"
    private static let beitritt = try! NSRegularExpression(pattern: beitrittMuster)

    /// Eine Adresse aus der Build-Einstellung, ohne Leerraum und ohne
    /// Schraegstrich am Ende — oder nil, wenn sie nicht taugt.
    static func bereinigt(_ roh: String?) -> String? {
        guard var wert = roh?.trimmingCharacters(in: .whitespacesAndNewlines), !wert.isEmpty else { return nil }
        // Nicht ersetzte Build-Einstellung: "$(BRAUWEG_API_BASE)".
        if wert.contains("$(") { return nil }
        while wert.hasSuffix("/") { wert.removeLast() }
        guard let url = URL(string: wert), let schema = url.scheme?.lowercased(),
              schema == "https" || schema == "http", url.host?.isEmpty == false else { return nil }
        return wert
    }

    /// Die Adresse eines Pfades innerhalb der Huelle.
    static func adresse(fuer pfad: String) -> URL {
        let mitSchraegstrich = pfad.hasPrefix("/") ? pfad : "/" + pfad
        return URL(string: herkunft + mitSchraegstrich) ?? startAdresse
    }

    /// Welcher Pfad der Huelle zu einem geoeffneten Link gehoert, oder nil.
    ///
    /// Nur `https://<server>/beitritt/<CODE>`, und nur fuer den Server, mit dem
    /// die App spricht: Ein Staging-Code hat auf der Produktion keinen Tisch.
    /// Solche Links oeffnet der Aufrufer im Safari-Blatt.
    static func pfadFuerLink(_ link: URL?, serverHost: String) -> String? {
        guard let link, link.scheme?.lowercased() == "https",
              let host = link.host?.lowercased(),
              linkHosts.contains(host), host == serverHost.lowercased() else { return nil }
        return pfadFuerPfad(link.path)
    }

    /// Der reine Pfadteil von [pfadFuerLink] — wie `Huelle.pfadFuerPfad` unter Android.
    static func pfadFuerPfad(_ pfad: String?) -> String? {
        guard let pfad else { return nil }
        let bereich = NSRange(pfad.startIndex..<pfad.endIndex, in: pfad)
        guard let treffer = beitritt.firstMatch(in: pfad, options: [], range: bereich),
              let code = Range(treffer.range(at: 1), in: pfad) else { return nil }
        return "/beitritt/" + String(pfad[code])
    }

    /*
     * Die NAMEN zwischen Huelle und Client sind eine Absprache mit dem Client
     * (laufzeit.ts, zuruecktaste.ts) und der Android-Huelle (Huelle.kt, PR #238):
     * `window.BRAUWEG_APP` mit `plattform`, `push`, `pushToken`;
     * `BrauwegNativ.pushErlauben()`; die Ereignisse `brauweg:push-token` und
     * `brauweg:zurueck`. Umbenennen heisst: an allen drei Stellen zugleich.
     */

    /// Ein Push-Token ist da: `detail = {plattform: 'ios', token}`.
    static let pushEreignis = "brauweg:push-token"

    /// „Zurueck" (unter iOS: Wischen vom linken Rand). `cancelable`: Ruft der
    /// Client `preventDefault()`, hat er selbst zurueckgeblaettert.
    static let zurueckEreignis = "brauweg:zurueck"

    /// Was dem Client vor seiner ersten Zeile eingespritzt wird (als
    /// `WKUserScript` am Dokumentanfang — die index.html bleibt unberuehrt).
    ///
    /// `window.BRAUWEG_APP` ist die Absprache mit `laufzeit.ts`: Steht es da,
    /// spricht der Client den Server unter `apiBase` an und traegt sein Token
    /// selbst; `push` sagt, ob sich `BrauwegNativ.pushErlauben()` lohnt.
    ///
    /// `window.BrauwegNativ` hat dieselbe Gestalt wie unter Android, damit der
    /// Client EINEN Aufruf fuer beide Huellen hat: Dort legt der WebView das
    /// Objekt selbst an (`addJavascriptInterface`), hier baut dieses Skript es
    /// aus `window.webkit.messageHandlers.brauweg`. Dazu `summen` fuer die
    /// Haptik (Android nimmt `navigator.vibrate` des WebViews).
    ///
    /// Darauf die Web-Schnittstellen, die der Client benutzt: `navigator.share`,
    /// `navigator.vibrate`, `navigator.wakeLock`. Anders als unter Android
    /// werden sie IMMER ersetzt, nicht nur, wo sie fehlen: `vibrate` kennt
    /// WebKit gar nicht, und ob `share` und `wakeLock` im WKWebView unter einem
    /// eigenen Schema tragen, haengt an der iOS-Version. Die native Fassung
    /// verhaelt sich auf jedem Geraet gleich.
    static func vorspann(apiBasis: String, push: Bool) -> String {
        [
            "(function () {",
            "  if (location.protocol !== '\(schema):') return;",
            "  window.BRAUWEG_APP = { apiBase: \(jsText(apiBasis)), plattform: 'ios', push: \(push ? "true" : "false") };",
            "  var h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.\(Bruecke.name);",
            "  if (!h) return;",
            "  function senden(art, daten) {",
            "    try { h.postMessage({ art: art, daten: daten === undefined ? null : daten }); } catch (e) {}",
            "  }",
            "  var b = window.BrauwegNativ = {",
            "    teilen: function (daten) { senden('teilen', String(daten)); },",
            "    wachHalten: function (an) { senden('wachHalten', !!an); },",
            "    summen: function (muster) { senden('summen', muster); },",
            "    pushErlauben: function () { senden('pushErlauben', null); }",
            "  };",
            // defineProperty statt Zuweisung: `wakeLock` ist in neueren WebKits
            // ein Getter ohne Setter, eine Zuweisung liefe dort stumm ins Leere.
            "  function setze(name, wert) {",
            "    try { Object.defineProperty(navigator, name, { value: wert, configurable: true, writable: true }); } catch (e) {}",
            "  }",
            "  setze('share', function (d) { b.teilen(JSON.stringify(d || {})); return Promise.resolve(); });",
            "  setze('canShare', function () { return true; });",
            "  setze('vibrate', function (m) { b.summen(m); return true; });",
            // Mehrere Sperren gleichzeitig (useTischwache fordert nach jedem
            // Sichtbarwerden neu an): Der Schirm bleibt an, bis die letzte frei ist.
            "  var offen = 0;",
            "  setze('wakeLock', { request: function () {",
            "    offen += 1; if (offen === 1) b.wachHalten(true);",
            "    var s = { released: false, type: 'screen', onrelease: null,",
            "      addEventListener: function () {}, removeEventListener: function () {},",
            "      release: function () {",
            "        if (!s.released) { s.released = true; offen = Math.max(0, offen - 1); if (offen === 0) b.wachHalten(false); }",
            "        return Promise.resolve();",
            "      } };",
            "    return Promise.resolve(s);",
            "  } });",
            "})();",
        ].joined(separator: "\n")
    }

    /// Meldet dem Client das Push-Token — zweimal, weil niemand weiss, wer
    /// zuerst da ist: als Ereignis fuer den, der schon horcht, und als
    /// `window.BRAUWEG_APP.pushToken` fuer den, der erst spaeter hinsieht.
    static func pushSkript(token: String) -> String {
        [
            "(function () {",
            "  var d = { plattform: 'ios', token: \(jsText(token)) };",
            "  if (window.BRAUWEG_APP) window.BRAUWEG_APP.pushToken = d;",
            "  window.dispatchEvent(new CustomEvent('\(pushEreignis)', { detail: d }));",
            "})();",
        ].joined(separator: "\n")
    }

    /// Fragt den Client, ob er „zurueck" selbst verarbeitet (zuruecktaste.ts).
    /// Das Ergebnis ist `true`, wenn er `preventDefault()` rief.
    static let zurueckSkript = [
        "(function () {",
        "  var e = new CustomEvent('\(zurueckEreignis)', { cancelable: true });",
        "  window.dispatchEvent(e);",
        "  return e.defaultPrevented;",
        "})();",
    ].joined(separator: "\n")


    /// Eine Zeichenkette als JavaScript-Literal.
    /// Zeichenweise ueber die Unicode-Skalare, nicht ueber `Character`: "\r\n"
    /// ist in Swift EIN Zeichen und fiele sonst durch beide Faelle.
    static func jsText(_ s: String) -> String {
        var aus = "\""
        for skalar in s.unicodeScalars {
            switch skalar {
            case "\\": aus += "\\\\"
            case "\"": aus += "\\\""
            case "\n": aus += "\\n"
            case "\r": aus += "\\r"
            case "\u{2028}": aus += "\\u2028"
            case "\u{2029}": aus += "\\u2029"
            default: aus.unicodeScalars.append(skalar)
            }
        }
        return aus + "\""
    }
}
