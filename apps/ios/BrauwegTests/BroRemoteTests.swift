import XCTest
@testable import Brauweg

final class BroRemoteTests: XCTestCase {
    @MainActor
    func testLokalerWebSocketTransportInBeideRichtungen() async throws {
        let host = BroRemoteNetz(), handy = BroRemoteNetz()
        let empfangen = expectation(description: "Host empfängt Text"), antwort = expectation(description: "Handy empfängt Antwort")
        var fehler: String?
        host.melden = { d in
            if d["art"] as? String == "bereit", let adressen = d["adressen"] as? [String], let adresse = adressen.first {
                handy.befehl(["art": "verbinden", "id": "pruefhandy", "adresse": adresse])
            }
            if d["art"] as? String == "text", let id = d["id"] as? String, d["text"] as? String == "hin" {
                empfangen.fulfill()
                host.befehl(["art": "senden", "id": id, "text": "zurueck"])
            }
            if d["art"] as? String == "fehler" { fehler = d["text"] as? String }
        }
        handy.melden = { d in
            if d["art"] as? String == "offen" { handy.befehl(["art": "senden", "id": "pruefhandy", "text": "hin"]) }
            if d["art"] as? String == "text", d["text"] as? String == "zurueck" { antwort.fulfill() }
        }
        host.befehl(["art": "host"])
        await fulfillment(of: [empfangen, antwort], timeout: 20)
        host.stoppen(); handy.stoppen()
        XCTAssertNil(fehler)
    }

    func testNurLokaleWebSocketZiele() {
        for ip in ["192.168.1.4", "10.0.0.2", "172.20.10.1", "169.254.1.3"] {
            XCTAssertNotNil(BroRemoteNetz.lokaleAdresse("ws://\(ip):32145/broremote"))
        }
        for url in ["ws://8.8.8.8:80/broremote", "ws://127.0.0.1:80/broremote", "ws://172.32.0.1:80/broremote", "https://192.168.1.1:80/broremote", "ws://192.168.1.1:80/admin", "ws://user@192.168.1.1:80/broremote", "ws://192.168.1.1:80/broremote?token=abc"] {
            XCTAssertNil(BroRemoteNetz.lokaleAdresse(url), url)
        }
    }
    func testBroRemoteLinkBehaeltEinladungImFragment() {
        let link = URL(string: "https://staging.brauweg-spielen.de/broremote#t=relay&r=ABC12345&k=abc")!
        XCTAssertEqual(Huelle.pfadFuerLink(link, serverHost: "staging.brauweg-spielen.de"), "/broremote#t=relay&r=ABC12345&k=abc")
        XCTAssertNil(Huelle.pfadFuerLink(link, serverHost: "www.brauweg-spielen.de"))
        XCTAssertTrue(Huelle.vorspann(apiBasis: "https://staging.brauweg-spielen.de", push: false).contains("window.BroRemoteNativ"))
    }
}
