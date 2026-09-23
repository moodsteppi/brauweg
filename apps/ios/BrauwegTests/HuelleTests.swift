import XCTest
@testable import Brauweg

/// Welche Links die App oeffnet, und was sie dem Client mitgibt.
///
/// Die Einladung (#203) genau in der Form, die der Client selbst liest
/// (einladungslink.ts: 4 bis 24 Zeichen aus Buchstaben, Ziffern und
/// Bindestrich) — dieselben Faelle wie HuelleTest.kt der Android-Huelle.
final class HuelleTests: XCTestCase {

    func testEinladungWirdZumPfadDerHuelle() {
        XCTAssertEqual(Huelle.pfadFuerPfad("/beitritt/K7X9MQ"), "/beitritt/K7X9MQ")
        XCTAssertEqual(Huelle.pfadFuerPfad("/beitritt/k7x-9mq/"), "/beitritt/k7x-9mq")
    }

    func testAllesAndereBleibtAussen() {
        let pfade: [String?] = [nil, "/", "/beitritt/", "/beitritt/ab", "/beitritt/K7X9MQ/mehr", "/verify", "/beitritt/<x>"]
        for pfad in pfade {
            XCTAssertNil(Huelle.pfadFuerPfad(pfad), pfad ?? "nil")
        }
    }

    func testUniversalLinkNurFuerDenEigenenServer() {
        let www = URL(string: "https://www.brauweg-spielen.de/beitritt/K7X9MQ")!
        let staging = URL(string: "https://staging.brauweg-spielen.de/beitritt/K7X9MQ")!
        XCTAssertEqual(Huelle.pfadFuerLink(www, serverHost: "www.brauweg-spielen.de"), "/beitritt/K7X9MQ")
        XCTAssertEqual(Huelle.pfadFuerLink(staging, serverHost: "staging.brauweg-spielen.de"), "/beitritt/K7X9MQ")
        // Ein Code von Staging hat auf der Produktion keinen Tisch.
        XCTAssertNil(Huelle.pfadFuerLink(staging, serverHost: "www.brauweg-spielen.de"))
        XCTAssertNil(Huelle.pfadFuerLink(www, serverHost: "staging.brauweg-spielen.de"))
        // Gross geschriebener Host ist derselbe Host.
        XCTAssertEqual(Huelle.pfadFuerLink(URL(string: "https://WWW.Brauweg-Spielen.de/beitritt/K7X9MQ")!,
                                           serverHost: "www.brauweg-spielen.de"), "/beitritt/K7X9MQ")
    }

    func testFremdeUndUnsichereLinksBleibenAussen() {
        let server = "www.brauweg-spielen.de"
        for link in [
            "http://www.brauweg-spielen.de/beitritt/K7X9MQ",
            "https://example.com/beitritt/K7X9MQ",
            "https://www.brauweg-spielen.de/",
            "https://www.brauweg-spielen.de/verify?token=abc",
            "brauweg://app/beitritt/K7X9MQ",
        ] {
            XCTAssertNil(Huelle.pfadFuerLink(URL(string: link)!, serverHost: server), link)
        }
        XCTAssertNil(Huelle.pfadFuerLink(nil, serverHost: server))
    }

    func testHerkunftPasstZumServer() {
        // APP_ORIGIN in packages/server/src/http/app.ts
        XCTAssertEqual(Huelle.herkunft, "brauweg://app")
        XCTAssertEqual("\(Huelle.schema)://\(Huelle.host)", Huelle.herkunft)
        XCTAssertEqual(Huelle.adresse(fuer: "/beitritt/K7X9MQ").absoluteString, "brauweg://app/beitritt/K7X9MQ")
        XCTAssertEqual(Huelle.adresse(fuer: "verify").absoluteString, "brauweg://app/verify")
    }

    func testApiBasisAusDerBuildEinstellung() {
        XCTAssertEqual(Huelle.bereinigt(" https://staging.brauweg-spielen.de/ "), "https://staging.brauweg-spielen.de")
        XCTAssertEqual(Huelle.bereinigt("http://127.0.0.1:3000"), "http://127.0.0.1:3000")
        for unsinn in [nil, "", "   ", "$(BRAUWEG_API_BASE)", "ftp://x.de", "www.brauweg-spielen.de", "https://"] {
            XCTAssertNil(Huelle.bereinigt(unsinn), unsinn ?? "nil")
        }
        // Die eingebaute Einstellung taugt (Debug: Staging, sofern Lokal.xcconfig nichts anderes sagt).
        XCTAssertNotNil(Huelle.bereinigt(Huelle.apiBasis))
    }

    func testVorspannTraegtDieAbsprache() {
        let js = Huelle.vorspann(apiBasis: "https://a\"b\\c", push: false)
        XCTAssertTrue(js.contains("apiBase: \"https://a\\\"b\\\\c\""), js)
        XCTAssertTrue(js.contains("plattform: 'ios'"))
        XCTAssertTrue(js.contains("push: false"))
        XCTAssertTrue(Huelle.vorspann(apiBasis: "https://x.de", push: true).contains("push: true"))
        // Dieselben Namen wie unter Android (Bruecke.kt).
        for name in ["teilen:", "wachHalten:", "pushErlauben:", "messageHandlers.\(Bruecke.name)"] {
            XCTAssertTrue(js.contains(name), name)
        }
    }

    func testPushTokenUndZurueckHabenDieVereinbartenNamen() {
        let push = Huelle.pushSkript(token: "ab01")
        XCTAssertTrue(push.contains("'brauweg:push-token'"))
        XCTAssertTrue(push.contains("plattform: 'ios', token: \"ab01\""))
        XCTAssertTrue(push.contains("window.BRAUWEG_APP.pushToken = d"))
        XCTAssertTrue(Huelle.zurueckSkript.contains("'brauweg:zurueck', { cancelable: true }"))
        XCTAssertTrue(Huelle.zurueckSkript.contains("return e.defaultPrevented"))
        XCTAssertEqual(Mitteilungen.hex(Data([0x00, 0xAB, 0x0F])), "00ab0f")
    }

    func testJsTextSchuetztZeilenumbrueche() {
        XCTAssertEqual(Huelle.jsText("a\r\nb"), "\"a\\r\\nb\"")
        XCTAssertEqual(Huelle.jsText("\u{2028}"), "\"\\u2028\"")
    }
}
