import UIKit

enum Farben {
    /// Dieselbe Farbe wie `theme-color` in packages/client/index.html und
    /// `brauweg_blau` der Android-Huelle. Steht hinter allem, bis der Client
    /// zeichnet — kein weisser Blitz beim Start.
    static let blau = UIColor(red: 0x1A / 255.0, green: 0x3F / 255.0, blue: 0x7A / 255.0, alpha: 1)
}

/// Ist der Server erreichbar? Eine kurze Anfrage an `/api/health`.
///
/// Der Client liegt im Paket und startet immer — ohne Server aber stuende
/// er da und koennte nichts. Apple prueft genau das (Flugmodus), und eine
/// halbe App ohne Erklaerung wirkt wie eine kaputte.
enum Erreichbarkeit {
    static func pruefen(apiBasis: String, fertig: @escaping (Bool) -> Void) {
        guard let url = URL(string: apiBasis + "/api/health") else {
            fertig(false)
            return
        }
        let anfrage = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 10)
        let sitzung = URLSession(configuration: .ephemeral)
        sitzung.dataTask(with: anfrage) { _, antwort, fehler in
            // Alles unter 500 heisst: Da antwortet jemand. Ein 429 der
            // Drosselung ist kein Grund fuer "keine Verbindung".
            let status = (antwort as? HTTPURLResponse)?.statusCode ?? 0
            let erreichbar = fehler == nil && (200..<500).contains(status)
            DispatchQueue.main.async { fertig(erreichbar) }
        }.resume()
        sitzung.finishTasksAndInvalidate()
    }
}

/// Die native Meldung, wenn der Server nicht erreichbar ist — statt einer
/// weissen oder halb leeren Seite. Liegt ueber dem WebView.
final class Fehlerschirm: UIView {

    var beimErneutVersuchen: (() -> Void)?

    private let knopf = UIButton(type: .system)
    private let kreisel = UIActivityIndicatorView(style: .medium)

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = Farben.blau

        let titel = UILabel()
        titel.text = "Keine Verbindung"
        titel.font = UIFontMetrics(forTextStyle: .title2).scaledFont(for: .systemFont(ofSize: 22, weight: .bold))
        titel.adjustsFontForContentSizeCategory = true
        titel.textColor = .white
        titel.textAlignment = .center
        titel.numberOfLines = 0
        titel.accessibilityTraits.insert(.header)

        let text = UILabel()
        text.text = "Brauweg erreicht den Server gerade nicht. Prüf deine Internetverbindung und versuch es noch einmal."
        text.font = .preferredFont(forTextStyle: .body)
        text.adjustsFontForContentSizeCategory = true
        text.textColor = UIColor.white.withAlphaComponent(0.85)
        text.textAlignment = .center
        text.numberOfLines = 0

        var aussehen = UIButton.Configuration.filled()
        aussehen.title = "Erneut versuchen"
        aussehen.baseBackgroundColor = .white
        aussehen.baseForegroundColor = Farben.blau
        aussehen.cornerStyle = .large
        aussehen.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 24, bottom: 12, trailing: 24)
        knopf.configuration = aussehen
        knopf.addTarget(self, action: #selector(tippen), for: .touchUpInside)

        kreisel.color = .white
        kreisel.hidesWhenStopped = true

        let stapel = UIStackView(arrangedSubviews: [titel, text, knopf, kreisel])
        stapel.axis = .vertical
        stapel.alignment = .center
        stapel.spacing = 16
        stapel.setCustomSpacing(28, after: text)
        stapel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stapel)

        let rand = safeAreaLayoutGuide
        // Am liebsten so breit wie der Schirm (abzueglich Rand), hoechstens 420.
        let breite = stapel.widthAnchor.constraint(equalTo: rand.widthAnchor, constant: -64)
        breite.priority = .defaultHigh
        NSLayoutConstraint.activate([
            breite,
            stapel.centerYAnchor.constraint(equalTo: rand.centerYAnchor),
            stapel.centerXAnchor.constraint(equalTo: rand.centerXAnchor),
            stapel.leadingAnchor.constraint(greaterThanOrEqualTo: rand.leadingAnchor, constant: 32),
            stapel.trailingAnchor.constraint(lessThanOrEqualTo: rand.trailingAnchor, constant: -32),
            stapel.widthAnchor.constraint(lessThanOrEqualToConstant: 420),
            text.widthAnchor.constraint(equalTo: stapel.widthAnchor),
            titel.widthAnchor.constraint(equalTo: stapel.widthAnchor),
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("Fehlerschirm wird nur aus Code angelegt")
    }

    @objc private func tippen() {
        beimErneutVersuchen?()
    }

    /// Waehrend einer Pruefung: Knopf aus, Kreisel an.
    func pruefeGerade(_ ja: Bool) {
        knopf.isEnabled = !ja
        if ja { kreisel.startAnimating() } else { kreisel.stopAnimating() }
    }
}
