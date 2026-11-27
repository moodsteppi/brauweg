import UIKit

/// Eine nicht wegwischbare native Sperre vor dem gesamten Web-Client.
final class Updateschirm: UIView {
    var beimStore: (() -> Void)?
    var beimPruefen: (() -> Void)?
    private let beschreibung = UILabel()
    private let status = UILabel()
    private let pruefen = UIButton(type: .system)

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = UIColor(red: 0.035, green: 0.09, blue: 0.20, alpha: 1)
        accessibilityViewIsModal = true
        let scroll = UIScrollView()
        scroll.translatesAutoresizingMaskIntoConstraints = false
        addSubview(scroll)
        let symbol = UIImageView(image: UIImage(systemName: "arrow.down.app.fill"))
        symbol.tintColor = UIColor(red: 0.48, green: 0.91, blue: 0.92, alpha: 1)
        symbol.contentMode = .scaleAspectFit
        symbol.isAccessibilityElement = false
        symbol.heightAnchor.constraint(equalToConstant: 78).isActive = true
        let titel = UILabel()
        titel.text = "Ein Update wartet auf dich"
        titel.font = .preferredFont(forTextStyle: .largeTitle)
        titel.accessibilityTraits.insert(.header)
        beschreibung.font = .preferredFont(forTextStyle: .body)
        status.font = .preferredFont(forTextStyle: .footnote)
        status.textColor = UIColor.white.withAlphaComponent(0.7)
        for text in [titel, beschreibung, status] {
            text.numberOfLines = 0
            text.textAlignment = .center
            text.adjustsFontForContentSizeCategory = true
            if text !== status { text.textColor = .white }
        }
        let store = UIButton(type: .system)
        var stil = UIButton.Configuration.filled()
        stil.title = "Jetzt aktualisieren"
        stil.image = UIImage(systemName: "arrow.up.right")
        stil.imagePlacement = .trailing
        stil.imagePadding = 12
        stil.baseBackgroundColor = UIColor(red: 1, green: 0.80, blue: 0.28, alpha: 1)
        stil.baseForegroundColor = backgroundColor
        stil.cornerStyle = .large
        stil.contentInsets = NSDirectionalEdgeInsets(top: 17, leading: 24, bottom: 17, trailing: 24)
        store.configuration = stil
        store.addAction(UIAction { [weak self] _ in self?.beimStore?() }, for: .touchUpInside)
        pruefen.setTitle("Erneut prüfen", for: .normal)
        pruefen.tintColor = .white
        pruefen.addAction(UIAction { [weak self] _ in self?.beimPruefen?() }, for: .touchUpInside)
        let stapel = UIStackView(arrangedSubviews: [symbol, titel, beschreibung, store, pruefen, status])
        stapel.axis = .vertical
        stapel.spacing = 20
        stapel.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(stapel)
        let inhalt = scroll.contentLayoutGuide, rahmen = scroll.frameLayoutGuide
        let mittig = stapel.centerYAnchor.constraint(equalTo: rahmen.centerYAnchor)
        mittig.priority = .defaultLow
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: safeAreaLayoutGuide.topAnchor),
            scroll.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor),
            scroll.leadingAnchor.constraint(equalTo: leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: trailingAnchor),
            stapel.topAnchor.constraint(greaterThanOrEqualTo: inhalt.topAnchor, constant: 28),
            stapel.bottomAnchor.constraint(equalTo: inhalt.bottomAnchor, constant: -28),
            stapel.centerXAnchor.constraint(equalTo: rahmen.centerXAnchor),
            stapel.widthAnchor.constraint(equalTo: rahmen.widthAnchor, constant: -48),
            inhalt.widthAnchor.constraint(equalTo: rahmen.widthAnchor), mittig,
        ])
    }

    required init?(coder: NSCoder) { fatalError("Updateschirm wird aus Code angelegt") }

    func anzeigen(version: String, prueft: Bool) {
        beschreibung.text = "Version \(version) von BroweGGames ist im App Store verfügbar. Aktualisiere die App, um weiterzuspielen. Dein Konto und deine Sammlung bleiben erhalten."
        pruefen.isEnabled = !prueft
        status.text = prueft ? "Verfügbarkeit wird geprüft …" : "Nach der Aktualisierung kannst du die App wieder öffnen."
    }

    func storeNichtGeoeffnet() { status.text = "Der App Store konnte nicht geöffnet werden. Bitte versuche es erneut." }
}
