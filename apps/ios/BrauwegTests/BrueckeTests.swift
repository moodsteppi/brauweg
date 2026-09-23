import XCTest
@testable import Brauweg

/// Die reinen Teile der Bruecke: Haptik-Muster und Teilen.
final class BrueckeTests: XCTestCase {

    private func zahlen(_ werte: [Double]) -> [NSNumber] {
        werte.map { NSNumber(value: $0) }
    }

    func testDuBistDranSummtZweimal() {
        // useTischwache.ts: MUSTER_DRAN = [120, 80, 120]
        XCTAssertEqual(Haptik.pulse(aus: zahlen([120, 80, 120])),
                       [Puls(nach: 0, staerke: .stark), Puls(nach: 0.2, staerke: .stark)])
    }

    func testEinzelneZahlen() {
        // EasyPoker: vibrate(4) am Regler — ein Ticken.
        XCTAssertEqual(Haptik.pulse(aus: NSNumber(value: 4)), [Puls(nach: 0, staerke: .tick)])
        XCTAssertEqual(Haptik.pulse(aus: NSNumber(value: 40)), [Puls(nach: 0, staerke: .leicht)])
        XCTAssertEqual(Haptik.pulse(aus: NSNumber(value: 200)), [Puls(nach: 0, staerke: .stark)])
    }

    func testNichtsUndUnsinn() {
        XCTAssertEqual(Haptik.pulse(aus: NSNumber(value: 0)), [])
        XCTAssertEqual(Haptik.pulse(aus: [NSNumber]()), [])
        XCTAssertEqual(Haptik.pulse(aus: "summ"), [])
        XCTAssertEqual(Haptik.pulse(aus: nil), [])
        XCTAssertEqual(Haptik.pulse(aus: NSNull()), [])
        // Eine Pause am Anfang verschiebt den ersten Puls.
        XCTAssertEqual(Haptik.pulse(aus: zahlen([0, 100, 30])), [Puls(nach: 0.1, staerke: .leicht)])
    }

    func testObergrenzen() {
        let lang = zahlen(Array(repeating: 50, count: 100))
        XCTAssertEqual(Haptik.pulse(aus: lang).count, Haptik.hoechstensPulse)
        let zaeh = zahlen([100, 10_000, 100])
        XCTAssertEqual(Haptik.pulse(aus: zaeh).count, 1, "nach mehr als fuenf Sekunden ist Schluss")
    }

    func testTeilenNimmtTextUndAdresse() {
        let gut = Teilgut.aus(json: #"{"title":"Brauweg","text":"Komm an den Tisch K7X9MQ","url":"https://www.brauweg-spielen.de/beitritt/K7X9MQ"}"#)
        XCTAssertEqual(gut, Teilgut(text: "Komm an den Tisch K7X9MQ",
                                    url: URL(string: "https://www.brauweg-spielen.de/beitritt/K7X9MQ")!))
        XCTAssertEqual(gut?.dinge.count, 2)
        // Ohne Text gilt der Titel.
        XCTAssertEqual(Teilgut.aus(json: #"{"title":"Brauweg"}"#), Teilgut(text: "Brauweg", url: nil))
        for leer in [nil, "", "{}", "[]", "kaputt", #"{"text":"  "}"#] {
            XCTAssertNil(Teilgut.aus(json: leer), leer ?? "nil")
        }
    }
}
