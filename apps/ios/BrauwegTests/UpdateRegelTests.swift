import XCTest
@testable import Brauweg

final class UpdateRegelTests: XCTestCase {
    private let bundle = "de.broweg.brauweg-spielen"
    private let jetzt = Date(timeIntervalSince1970: 1800000000)
    private func eintrag(version: String = "1.10", os: String = "16.0", datum: String = "2026-01-01T12:00:00Z", bundle: String = "de.broweg.brauweg-spielen") -> UpdateRegel.Eintrag {
        .init(bundleId: bundle, trackId: 123, version: version, minimumOsVersion: os, currentVersionReleaseDate: datum)
    }
    private func ziel(_ e: UpdateRegel.Eintrag, installiert: String = "1.9") -> UpdateRegel.Ziel? {
        UpdateRegel.ziel(e, bundle: bundle, installiert: installiert, ios: "18.2", land: "de", jetzt: jetzt)
    }
    func testVersionenWerdenNumerischVerglichen() {
        XCTAssertEqual(UpdateRegel.vergleich("1.10", "1.9"), .orderedDescending)
        XCTAssertEqual(UpdateRegel.vergleich("1.0", "1.0.0"), .orderedSame)
        XCTAssertEqual(UpdateRegel.vergleich("2", "2.0.1"), .orderedAscending)
        XCTAssertNil(UpdateRegel.vergleich("1.beta", "1.0"))
        XCTAssertNil(UpdateRegel.vergleich("", "1"))
    }
    func testNurNeuereVersionDerEigenenAppSperrt() {
        XCTAssertEqual(ziel(eintrag())?.adresse.absoluteString, "https://apps.apple.com/de/app/id123")
        XCTAssertNil(ziel(eintrag(version: "1.9.0")))
        XCTAssertNil(ziel(eintrag(version: "1.8")))
        XCTAssertNil(ziel(eintrag(bundle: "fremde.app")))
    }
    func testNichtInstallierbareUndZukuenftigeVersionenSperrenNicht() {
        XCTAssertNil(ziel(eintrag(os: "19.0")))
        XCTAssertNil(ziel(eintrag(datum: "2099-01-01T00:00:00Z")))
        XCTAssertNil(ziel(eintrag(datum: "ungueltig")))
        XCTAssertNotNil(ziel(eintrag(datum: "2026-01-01T12:00:00.000Z")))
    }
    func testMerkerGiltNurImSelbenStoreBisEinenTagUndBisZurInstallation() {
        let m = UpdateRegel.Merker(eintrag: eintrag(), land: "de", zeit: jetzt.addingTimeInterval(-300))
        XCTAssertNotNil(UpdateRegel.gemerkt(m, bundle: bundle, installiert: "1.9", ios: "18.2", land: "de", jetzt: jetzt))
        XCTAssertNil(UpdateRegel.gemerkt(m, bundle: bundle, installiert: "1.10", ios: "18.2", land: "de", jetzt: jetzt))
        XCTAssertNil(UpdateRegel.gemerkt(m, bundle: bundle, installiert: "1.9", ios: "18.2", land: "us", jetzt: jetzt))
        XCTAssertNil(UpdateRegel.gemerkt(m, bundle: bundle, installiert: "1.9", ios: "18.2", land: "de", jetzt: jetzt.addingTimeInterval(86400)))
    }
    func testStoreLandUndLookupAdresse() {
        XCTAssertEqual(UpdateRegel.land("DEU"), "de")
        XCTAssertEqual(UpdateRegel.land("USA"), "us")
        XCTAssertNil(UpdateRegel.land("KEINLAND"))
        let url = UpdateRegel.lookup(bundle: bundle, land: "de")!
        XCTAssertEqual(url.host, "itunes.apple.com")
        XCTAssertEqual(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "bundleId" })?.value, bundle)
        XCTAssertNil(UpdateRegel.lookup(bundle: bundle, land: "../fremd"))
    }
}
