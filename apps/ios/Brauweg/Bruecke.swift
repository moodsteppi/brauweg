import UIKit
import WebKit

/// Was der Client geteilt haben will — aus dem JSON von `navigator.share`.
struct Teilgut: Equatable {
    let text: String?
    let url: URL?

    /// `{title, text, url}` wie bei `navigator.share`; nil, wenn nichts zu teilen ist.
    static func aus(json: String?) -> Teilgut? {
        guard let json, let daten = json.data(using: .utf8),
              let objekt = (try? JSONSerialization.jsonObject(with: daten)) as? [String: Any] else { return nil }
        func feld(_ name: String) -> String? {
            guard let wert = (objekt[name] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !wert.isEmpty else { return nil }
            return wert
        }
        let url = feld("url").flatMap { URL(string: $0) }
        let text = feld("text") ?? feld("title")
        if text == nil && url == nil { return nil }
        return Teilgut(text: text, url: url)
    }

    /// Fuer den Teilen-Dialog: Text und Adresse getrennt, damit Nachrichten und
    /// WhatsApp die Adresse als Link mit Vorschau zeigen.
    var dinge: [Any] {
        var ergebnis: [Any] = []
        if let text { ergebnis.append(text) }
        if let url { ergebnis.append(url) }
        return ergebnis
    }
}

/// Die Handgriffe, die der Client nativ braucht (siehe `Huelle.vorspann`) —
/// dieselben Namen wie `Bruecke.kt` der Android-Huelle: `teilen` und
/// `wachHalten`, dazu `summen` (Android nimmt dafuer `navigator.vibrate` des
/// WebViews, WebKit kennt es nicht) und `pushErlauben`.
///
/// Bewusst nur das. Alles, was die Oberflaeche ausmacht, bleibt im Client —
/// eine zweite Oberflaeche in Swift waere eine zweite Wahrheit.
///
/// Nur die eigene Seite spricht mit der Bruecke: Nachrichten aus einem
/// eingebetteten Rahmen oder von einer anderen Herkunft verwirft sie. Fremde
/// Adressen oeffnet der `HauptController` ohnehin nie im WebView.
final class Bruecke: NSObject, WKScriptMessageHandler {

    /// `window.webkit.messageHandlers.brauweg`
    static let name = "brauweg"

    /// Schwach: Der WebView haelt die Bruecke (ueber seinen
    /// WKUserContentController), der Controller haelt den WebView.
    private weak var controller: HauptController?
    private let haptik = Haptik()

    init(controller: HauptController) {
        self.controller = controller
        super.init()
    }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        let herkunft = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame,
              herkunft.protocol == Huelle.schema,
              herkunft.host == Huelle.host else { return }
        guard let rumpf = message.body as? [String: Any], let art = rumpf["art"] as? String else { return }
        let daten = rumpf["daten"]
        switch art {
        case "teilen":
            teilen(daten as? String)
        case "wachHalten":
            wachHalten((daten as? Bool) ?? false)
        case "summen":
            haptik.spielen(Haptik.pulse(aus: daten))
        case "pushErlauben":
            Mitteilungen.shared.erlauben()
        default:
            break
        }
    }

    /// `navigator.share({title, text, url})` — der Teilen-Dialog des Systems.
    private func teilen(_ json: String?) {
        guard let gut = Teilgut.aus(json: json) else { return }
        controller?.zeigeTeilen(gut.dinge)
    }

    /// Bildschirm anlassen, solange der Client es will (Partykiste: das Handy
    /// liegt auf dem Tisch, useTischwache.ts). Gilt nur, solange die App vorne
    /// ist — mehr kann und soll `isIdleTimerDisabled` nicht.
    private func wachHalten(_ an: Bool) {
        UIApplication.shared.isIdleTimerDisabled = an
    }

    /// Bei jeder neuen Seite (Neuladen, Einladungslink): Die Sperren des
    /// alten Dokuments sind mit ihm verschwunden, ohne je `release` gesagt zu
    /// haben. Ohne das bliebe der Schirm nach einem Neuladen fuer immer an.
    func zuruecksetzen() {
        UIApplication.shared.isIdleTimerDisabled = false
        haptik.stoppen()
    }
}
