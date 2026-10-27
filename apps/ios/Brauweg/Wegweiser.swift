import Foundation

/// Wohin eine Adresse gehoert, die der WebView oeffnen will — ohne UIKit,
/// damit pruefbar. Ausgefuehrt wird die Entscheidung im `HauptController`.
///
/// Der Grundsatz ist derselbe wie unter Android (`shouldOverrideUrlLoading`
/// in MainActivity.kt): **Der WebView traegt nie eine fremde Seite.** Sie saehe
/// sonst die Bruecke und bekaeme die App-Herkunft nicht, wohl aber die Kulisse.
enum Wegweiser {

    enum Ziel: Equatable {
        /// Im WebView lassen.
        case innen
        /// Abbrechen und stattdessen diesen Pfad der Huelle laden.
        case innenLaden(String)
        /// Im Safari-Blatt ueber der App zeigen (mit „Fertig").
        case blatt(URL)
        /// An das System geben (Mail, Telefon, App Store).
        case system(URL)
        /// Stillschweigend verwerfen.
        case verwerfen
    }

    /// Eigene Seiten, die trotzdem ins Safari-Blatt gehoeren: Impressum und
    /// Datenschutz. Im Blatt bleibt der Schirm darunter stehen (ein halb
    /// ausgefuelltes Anmeldeformular, ein offener Tisch), und „Fertig" fuehrt
    /// zurueck, statt dass die ganze App neu startet. Geladen werden sie vom
    /// Server — dieselben Dateien, die auch im Paket liegen.
    static let blattPfade = ["/rechtliches/"]

    static func ziel(fuer url: URL, hauptrahmen: Bool, serverHost: String, apiBasis: String) -> Ziel {
        let schema = url.scheme?.lowercased() ?? ""
        switch schema {
        case Huelle.schema:
            guard url.host?.lowercased() == Huelle.host else { return .verwerfen }
            if hauptrahmen, blattPfade.contains(where: { url.path.hasPrefix($0) }),
               let aussen = URL(string: apiBasis + url.path),
               let aussenSchema = aussen.scheme?.lowercased(),
               aussenSchema == "https" || aussenSchema == "http" {
                return .blatt(aussen)
            }
            return .innen
        case "about", "blob", "data":
            return .innen
        case "javascript", "":
            return .verwerfen
        case "https", "http":
            // Ein Einladungslink bleibt in der App — auch wenn er in der App
            // selbst angetippt wird.
            if let pfad = Huelle.pfadFuerLink(url, serverHost: serverHost) { return .innenLaden(pfad) }
            // Eingebettete Rahmen duerfen laden; die Bruecke antwortet nur dem
            // Hauptrahmen der eigenen Herkunft (Bruecke.swift).
            return hauptrahmen ? .blatt(url) : .innen
        default:
            return .system(url)
        }
    }
}
