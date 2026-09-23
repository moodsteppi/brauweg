import XCTest
@testable import Brauweg

/// Wohin der WebView eine Adresse oeffnen darf — der Grundsatz: nie eine fremde Seite.
final class WegweiserTests: XCTestCase {

    private let server = "www.brauweg-spielen.de"
    private let basis = "https://www.brauweg-spielen.de"

    private func ziel(_ adresse: String, hauptrahmen: Bool = true) -> Wegweiser.Ziel {
        Wegweiser.ziel(fuer: URL(string: adresse)!, hauptrahmen: hauptrahmen, serverHost: server, apiBasis: basis)
    }

    func testEigeneSeitenBleibenInnen() {
        XCTAssertEqual(ziel("brauweg://app/"), .innen)
        XCTAssertEqual(ziel("brauweg://app/beitritt/K7X9MQ"), .innen)
        XCTAssertEqual(ziel("about:blank"), .innen)
        XCTAssertEqual(ziel("brauweg://fremd/"), .verwerfen)
    }

    func testRechtstexteImSafariBlatt() {
        XCTAssertEqual(ziel("brauweg://app/rechtliches/impressum.html"),
                       .blatt(URL(string: "https://www.brauweg-spielen.de/rechtliches/impressum.html")!))
        XCTAssertEqual(ziel("brauweg://app/rechtliches/datenschutz.html"),
                       .blatt(URL(string: "https://www.brauweg-spielen.de/rechtliches/datenschutz.html")!))
        // In einem eingebetteten Rahmen kein Blatt.
        XCTAssertEqual(ziel("brauweg://app/rechtliches/impressum.html", hauptrahmen: false), .innen)
    }

    func testEinladungBleibtInDerApp() {
        XCTAssertEqual(ziel("https://www.brauweg-spielen.de/beitritt/K7X9MQ"), .innenLaden("/beitritt/K7X9MQ"))
        // Staging-Einladung, waehrend die App mit der Produktion spricht: Webseite.
        XCTAssertEqual(ziel("https://staging.brauweg-spielen.de/beitritt/K7X9MQ"),
                       .blatt(URL(string: "https://staging.brauweg-spielen.de/beitritt/K7X9MQ")!))
    }

    func testFremdesNieImWebView() {
        XCTAssertEqual(ziel("https://example.com/hilfe"), .blatt(URL(string: "https://example.com/hilfe")!))
        XCTAssertEqual(ziel("https://www.brauweg-spielen.de/"), .blatt(URL(string: "https://www.brauweg-spielen.de/")!))
        XCTAssertEqual(ziel("mailto:hilfe@brauweg-spielen.de"), .system(URL(string: "mailto:hilfe@brauweg-spielen.de")!))
        XCTAssertEqual(ziel("tel:+49301234"), .system(URL(string: "tel:+49301234")!))
        XCTAssertEqual(ziel("javascript:alert(1)"), .verwerfen)
        // Eingebettete Rahmen duerfen laden; die Bruecke hoert nur den Hauptrahmen.
        XCTAssertEqual(ziel("https://example.com/einbettung", hauptrahmen: false), .innen)
    }
}
