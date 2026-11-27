import Foundation

/// Nur eine tatsächlich veröffentlichte, auf diesem iPhone installierbare
/// Store-Version darf sperren. Buildnummern aus TestFlight sind kein Store-Release.
enum UpdateRegel {
    struct Antwort: Decodable {
        let resultCount: Int
        let results: [Eintrag]
    }
    struct Eintrag: Codable {
        let bundleId: String
        let trackId: Int
        let version: String
        let minimumOsVersion: String
        let currentVersionReleaseDate: String
    }
    struct Ziel: Equatable {
        let version: String
        let adresse: URL
    }
    struct Merker: Codable {
        let eintrag: Eintrag
        let land: String
        let zeit: Date
    }

    static func vergleich(_ a: String, _ b: String) -> ComparisonResult? {
        func teile(_ text: String) -> [Int]? {
            guard text.count <= 40, text.range(of: "^[0-9]+(\\.[0-9]+){0,3}$", options: .regularExpression) != nil else { return nil }
            let teile = text.split(separator: ".").compactMap { Int($0) }
            return teile.count == text.split(separator: ".").count ? teile : nil
        }
        guard let links = teile(a), let rechts = teile(b) else { return nil }
        for i in 0..<max(links.count, rechts.count) {
            let l = i < links.count ? links[i] : 0, r = i < rechts.count ? rechts[i] : 0
            if l != r { return l < r ? .orderedAscending : .orderedDescending }
        }
        return .orderedSame
    }

    /// StoreKit liefert ISO-3, Apples Lookup erwartet ISO-2. ICU kennt beide
    /// Schreibweisen; ein unbekanntes Store-Land bekommt keinen geratenen Ersatz.
    static func land(_ iso3: String) -> String? {
        let sprache = Locale(identifier: "en_US_POSIX")
        guard let name = sprache.localizedString(forRegionCode: iso3.uppercased()) else { return nil }
        return Locale.Region.isoRegions.map(\.identifier).first { code in
            code.count == 2 && sprache.localizedString(forRegionCode: code) == name
        }?.lowercased()
    }

    static func lookup(bundle: String, land: String) -> URL? {
        guard land.range(of: "^[a-z]{2}$", options: .regularExpression) != nil else { return nil }
        var url = URLComponents(string: "https://itunes.apple.com/lookup")!
        url.queryItems = [URLQueryItem(name: "bundleId", value: bundle), URLQueryItem(name: "country", value: land), URLQueryItem(name: "entity", value: "software")]
        return url.url
    }

    static func ziel(_ eintrag: Eintrag, bundle: String, installiert: String,
                     ios: String, land: String, jetzt: Date = Date()) -> Ziel? {
        guard eintrag.bundleId == bundle, eintrag.trackId > 0,
              vergleich(eintrag.version, installiert) == .orderedDescending,
              let osVergleich = vergleich(ios, eintrag.minimumOsVersion), osVergleich != .orderedAscending,
              land.range(of: "^[a-z]{2}$", options: .regularExpression) != nil else { return nil }
        let zeit = ISO8601DateFormatter()
        var freigabe = zeit.date(from: eintrag.currentVersionReleaseDate)
        if freigabe == nil {
            zeit.formatOptions.insert(.withFractionalSeconds)
            freigabe = zeit.date(from: eintrag.currentVersionReleaseDate)
        }
        guard let freigabe, freigabe <= jetzt else { return nil }
        // Keine fremde URL aus einem Antwortfeld öffnen: Ziel entsteht aus
        // der geprüften App-ID und der festen Apple-Domain.
        return Ziel(version: eintrag.version, adresse: URL(string: "https://apps.apple.com/\(land)/app/id\(eintrag.trackId)")!)
    }

    static func gemerkt(_ merker: Merker, bundle: String, installiert: String,
                        ios: String, land: String, jetzt: Date = Date()) -> Ziel? {
        let alter = jetzt.timeIntervalSince(merker.zeit)
        guard merker.land == land, alter >= 0, alter < 86400 else { return nil }
        return ziel(merker.eintrag, bundle: bundle, installiert: installiert, ios: ios, land: land, jetzt: jetzt)
    }
}
