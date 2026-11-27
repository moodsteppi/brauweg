import Foundation
import StoreKit

@MainActor
final class UpdatePruefer {
    var beiAenderung: ((UpdateRegel.Ziel?, Bool) -> Void)?
    private(set) var ziel: UpdateRegel.Ziel?
    private var auftrag: Task<Void, Never>?
    private var zuletzt: Date?
    private var bestaetigtAm: Date?
    private let ablage = UserDefaults.standard
    private let schluessel = "broweg.appstore-update.v1"

    private var eingeschaltet: Bool {
        #if DEBUG
        return false
        #else
        return Huelle.serverHost == "www.brauweg-spielen.de"
            && Bundle.main.appStoreReceiptURL?.lastPathComponent != "sandboxReceipt"
        #endif
    }

    func pruefen(sofort: Bool = false) {
        guard eingeschaltet, auftrag == nil else { return }
        let abstand = zuletzt.map { Date().timeIntervalSince($0) } ?? .infinity
        guard abstand >= (sofort || ziel != nil ? 5 : 900) else { return }
        zuletzt = Date()
        if let zeit = bestaetigtAm, Date().timeIntervalSince(zeit) >= 86400 { ziel = nil }
        beiAenderung?(ziel, true)
        auftrag = Task { [weak self] in
            guard let self else { return }
            defer { self.auftrag = nil; self.beiAenderung?(self.ziel, false) }
            guard let storefront = await Storefront.current,
                  let land = UpdateRegel.land(storefront.countryCode),
                  let bundle = Bundle.main.bundleIdentifier,
                  let installiert = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String,
                  let url = UpdateRegel.lookup(bundle: bundle, land: land) else { return }
            let system = ProcessInfo.processInfo.operatingSystemVersion
            let ios = "\(system.majorVersion).\(system.minorVersion).\(system.patchVersion)"
            if let daten = ablage.data(forKey: schluessel),
               let merker = try? JSONDecoder().decode(UpdateRegel.Merker.self, from: daten) {
                bestaetigtAm = merker.zeit
                ziel = UpdateRegel.gemerkt(merker, bundle: bundle, installiert: installiert, ios: ios, land: land)
                beiAenderung?(ziel, true)
            }
            let sitzung = URLSession(configuration: .ephemeral)
            defer { sitzung.finishTasksAndInvalidate() }
            do {
                let anfrage = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 10)
                let (daten, antwort) = try await sitzung.data(for: anfrage)
                guard !Task.isCancelled, (antwort as? HTTPURLResponse)?.statusCode == 200, daten.count < 1_000_000 else { return }
                let katalog = try JSONDecoder().decode(UpdateRegel.Antwort.self, from: daten)
                guard katalog.resultCount == katalog.results.count else { return }
                if let eintrag = katalog.results.first(where: { $0.bundleId == bundle }),
                   let angebot = UpdateRegel.ziel(eintrag, bundle: bundle, installiert: installiert, ios: ios, land: land) {
                    ziel = angebot
                    bestaetigtAm = Date()
                    let merker = UpdateRegel.Merker(eintrag: eintrag, land: land, zeit: Date())
                    ablage.set(try JSONEncoder().encode(merker), forKey: schluessel)
                } else {
                    // Ein zurückgezogenes oder nicht mehr verfügbares Release
                    // darf keinen dauerhaften, unerfüllbaren Update-Zwang erzeugen.
                    ziel = nil
                    ablage.removeObject(forKey: schluessel)
                }
            } catch {
                // Offline oder ungültige Store-Antwort: nur eine zuvor bestätigte,
                // höchstens einen Tag alte Pflicht behalten, niemals neu sperren.
            }
        }
    }

    deinit { auftrag?.cancel() }
}
