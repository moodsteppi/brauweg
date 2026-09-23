import XCTest
@testable import Brauweg

/// Pfadaufloesung des Schemas `brauweg://app` — dieselben Regeln wie
/// `PaketLader.kt` der Android-Huelle und `setNotFoundHandler` im Server.
final class PaketSchemaTests: XCTestCase {

    func testPfadeOhneEndungSindDerClient() {
        for pfad in ["", "/", "/beitritt/K7X9MQ", "/verify", "/probe/kampf", "/beitritt/K7X9MQ/"] {
            XCTAssertEqual(PaketSchema.ziel(fuer: pfad), .index, pfad)
        }
    }

    func testDateienBleibenDateien() {
        XCTAssertEqual(PaketSchema.ziel(fuer: "/assets/index-abc123.js"), .datei("assets/index-abc123.js"))
        XCTAssertEqual(PaketSchema.ziel(fuer: "/rechtliches/impressum.html"), .datei("rechtliches/impressum.html"))
        XCTAssertEqual(PaketSchema.ziel(fuer: "//karten//herz-7.webp"), .datei("karten/herz-7.webp"))
        XCTAssertEqual(PaketSchema.ziel(fuer: "/index.html"), .datei("index.html"))
    }

    func testNichtsAusserhalbVonWeb() {
        XCTAssertEqual(PaketSchema.ziel(fuer: "/../Info.plist"), .verboten)
        XCTAssertEqual(PaketSchema.ziel(fuer: "/karten/../../Brauweg"), .verboten)
    }

    func testInhaltstypen() {
        // Modul-Skripte verlangen einen JavaScript-Typ, sonst bleibt der Schirm leer.
        XCTAssertEqual(PaketSchema.mimeTyp(fuer: "assets/index.js"), "text/javascript; charset=utf-8")
        XCTAssertEqual(PaketSchema.mimeTyp(fuer: "index.html"), "text/html; charset=utf-8")
        XCTAssertEqual(PaketSchema.mimeTyp(fuer: "karten/HERZ.WEBP"), "image/webp")
        XCTAssertEqual(PaketSchema.mimeTyp(fuer: "3d/pinguin.glb"), "model/gltf-binary")
        XCTAssertEqual(PaketSchema.mimeTyp(fuer: "klang/zug.mp3"), "audio/mpeg")
        XCTAssertEqual(PaketSchema.mimeTyp(fuer: "unbekannt.zzzq"), "application/octet-stream")
    }

    /// Von der Adresse bis zur Antwort, gegen einen echten Ordner.
    func testAntwortenAusEinemOrdner() throws {
        let wurzel = FileManager.default.temporaryDirectory
            .appendingPathComponent("paket-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: wurzel.appendingPathComponent("assets"),
                                                withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: wurzel) }
        try Data("<!doctype html><head></head>".utf8).write(to: wurzel.appendingPathComponent("index.html"))
        try Data("export {}".utf8).write(to: wurzel.appendingPathComponent("assets/a.js"))
        // Neben dem Ordner, nicht darin: dorthin darf keine Adresse fuehren.
        let daneben = wurzel.deletingLastPathComponent().appendingPathComponent("geheim-\(UUID().uuidString).txt")
        try Data("geheim".utf8).write(to: daneben)
        defer { try? FileManager.default.removeItem(at: daneben) }

        let index = PaketSchema.antwort(fuer: URL(string: "brauweg://app/beitritt/K7X9MQ")!, wurzel: wurzel)
        XCTAssertEqual(index.status, 200)
        XCTAssertEqual(index.kopf["Content-Type"], "text/html; charset=utf-8")
        XCTAssertEqual(String(decoding: index.daten, as: UTF8.self), "<!doctype html><head></head>")

        let skript = PaketSchema.antwort(fuer: URL(string: "brauweg://app/assets/a.js")!, wurzel: wurzel)
        XCTAssertEqual(skript.status, 200)
        XCTAssertEqual(skript.kopf["Content-Type"], "text/javascript; charset=utf-8")
        XCTAssertEqual(skript.kopf["Content-Length"], "9")

        // Fehlt eine Datei, ist das ehrlich 404 — keine index.html im <img>.
        XCTAssertEqual(PaketSchema.antwort(fuer: URL(string: "brauweg://app/karten/fehlt.webp")!, wurzel: wurzel).status, 404)
        // Hinaus kommt niemand, auch nicht verschluesselt.
        let hinaus = "brauweg://app/%2e%2e/" + daneben.lastPathComponent
        XCTAssertEqual(PaketSchema.antwort(fuer: URL(string: hinaus)!, wurzel: wurzel).status, 404)
        // Anderer Host unter demselben Schema: nicht unsere Herkunft.
        XCTAssertEqual(PaketSchema.antwort(fuer: URL(string: "brauweg://fremd/assets/a.js")!, wurzel: wurzel).status, 404)
    }

    func testOhneClientEinHinweisStattWeiss() {
        let antwort = PaketSchema.antwort(fuer: URL(string: "brauweg://app/")!, wurzel: nil)
        XCTAssertEqual(antwort.status, 200)
        XCTAssertTrue(String(decoding: antwort.daten, as: UTF8.self).contains("kein Client"))
    }
}
