import Network
import SafariServices
import UIKit
import WebKit

/// Die ganze iOS-Huelle: ein WKWebView mit dem gebuendelten Client.
///
/// Wie unter Android (MainActivity.kt): Client aus dem Paket, der Server im
/// Netz, Anmeldung per Token. Keine zweite Oberflaeche.
final class HauptController: UIViewController, WKNavigationDelegate, WKUIDelegate, UIGestureRecognizerDelegate {

    private let startPfad: String
    /// Ein Link, mit dem die App gestartet wurde, der aber nicht in sie gehoert
    /// (Staging-Einladung, waehrend die App mit der Produktion spricht).
    private var fremderStartLink: URL?

    private var ansicht: WKWebView!
    private var bruecke: Bruecke!
    private let fehlerschirm = Fehlerschirm()
    private var prueftGerade = false
    /// Meldet, wenn das Netz zurueckkommt — dann verschwindet die Fehlermeldung
    /// von selbst, wie unter Android.
    private let netz = NWPathMonitor()

    init(startLink: URL?) {
        if let pfad = Huelle.pfadFuerLink(startLink, serverHost: Huelle.serverHost) {
            startPfad = pfad
        } else {
            startPfad = "/"
            fremderStartLink = startLink
        }
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("HauptController wird nur aus Code angelegt")
    }

    /// Helle Symbole auf dunkler Kopfzeile — wie `black-translucent` in der
    /// index.html fuer die Safari-Fassung.
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Farben.blau

        let konfiguration = WKWebViewConfiguration()
        // Muss vor dem Anlegen des WebViews stehen; danach nimmt WebKit kein Schema mehr an.
        konfiguration.setURLSchemeHandler(PaketSchema(), forURLScheme: Huelle.schema)
        // Toene am Tisch ohne vorheriges Tippen, und nichts im Vollbild-Spieler.
        konfiguration.allowsInlineMediaPlayback = true
        konfiguration.mediaTypesRequiringUserActionForPlayback = []
        // Keine Telefonnummern- oder Datumslinks in Spielernamen und Karten.
        konfiguration.dataDetectorTypes = []
        let skript = WKUserScript(source: Huelle.vorspann(apiBasis: Huelle.apiBasis, push: Huelle.pushEingeschaltet),
                                  injectionTime: .atDocumentStart, forMainFrameOnly: true)
        konfiguration.userContentController.addUserScript(skript)
        let bruecke = Bruecke(controller: self)
        konfiguration.userContentController.add(bruecke, name: Bruecke.name)
        self.bruecke = bruecke

        let ansicht = WKWebView(frame: view.bounds, configuration: konfiguration)
        ansicht.navigationDelegate = self
        ansicht.uiDelegate = self
        ansicht.isOpaque = false
        ansicht.backgroundColor = Farben.blau
        ansicht.scrollView.backgroundColor = Farben.blau
        /*
         * Randlos bis unter Notch und Home-Balken. Die sicheren Raender holt sich
         * der Client selbst (viewport-fit=cover, env(safe-area-inset-*)); stellte
         * die Scroll-Ansicht zusaetzlich eigene Einrueckungen ein, kaemen die
         * Raender doppelt.
         */
        ansicht.scrollView.contentInsetAdjustmentBehavior = .never
        ansicht.allowsLinkPreview = false
        #if DEBUG
        // Safari → Entwickler → iPhone: Web-Inspektor fuer den Client (ab iOS 16.4).
        if #available(iOS 16.4, *) { ansicht.isInspectable = true }
        #endif
        ansicht.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(ansicht)
        self.ansicht = ansicht

        fehlerschirm.isHidden = true
        fehlerschirm.beimErneutVersuchen = { [weak self] in self?.pruefeServer() }
        fehlerschirm.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(fehlerschirm)

        for kind in [ansicht, fehlerschirm] as [UIView] {
            NSLayoutConstraint.activate([
                kind.topAnchor.constraint(equalTo: view.topAnchor),
                kind.bottomAnchor.constraint(equalTo: view.bottomAnchor),
                kind.leadingAnchor.constraint(equalTo: view.leadingAnchor),
                kind.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            ])
        }

        /*
         * „Zurueck": Unter Android die Taste, unter iOS das Wischen vom linken
         * Rand — die Geste, mit der man auf dem iPhone in jeder App eine Ebene
         * zurueckgeht. Sie fragt den Client (brauweg:zurueck, zuruecktaste.ts);
         * blaettert der nicht (am Tisch, in der Partykiste), passiert NICHTS.
         * Anders als Android schickt sich eine iOS-App nie selbst in den
         * Hintergrund. `cancelsTouchesInView = false`: Der Rand gehoert weiter
         * dem Spiel — eine Karte, die dort angefasst wird, verliert ihren
         * Finger nicht an die Geste. Den Verlauf des WebViews
         * (`allowsBackForwardNavigationGestures`) gibt es bewusst nicht: Die
         * Schirme des Clients sind Zustand in App.tsx, kein Verlauf.
         */
        let wisch = UIScreenEdgePanGestureRecognizer(target: self, action: #selector(vomRandGewischt(_:)))
        wisch.edges = .left
        wisch.cancelsTouchesInView = false
        wisch.delegate = self
        view.addGestureRecognizer(wisch)

        Mitteilungen.shared.beiToken = { [weak self] token in self?.pushTokenMelden(token) }

        netz.pathUpdateHandler = { [weak self] pfad in
            guard pfad.status == .satisfied else { return }
            DispatchQueue.main.async { self?.imVordergrund() }
        }
        netz.start(queue: DispatchQueue(label: "de.brauweg.netz"))

        laden(pfad: startPfad)
        pruefeServer()
    }

    deinit {
        netz.cancel()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if let link = fremderStartLink {
            fremderStartLink = nil
            zeigeBlatt(link)
        }
    }

    // MARK: - Laden und Links

    func laden(pfad: String) {
        bruecke.zuruecksetzen()
        ansicht.load(URLRequest(url: Huelle.adresse(fuer: pfad)))
    }

    /// Ein Universal Link, waehrend die App schon laeuft (SzenenDelegat).
    /// Der Client liest den Code beim Start aus der Adresse — also wird die
    /// Adresse neu geladen. Die Sitzung liegt im localStorage und ueberlebt das.
    func oeffne(link: URL) {
        loadViewIfNeeded()
        let weiter: () -> Void = { [weak self] in
            guard let self else { return }
            if let pfad = Huelle.pfadFuerLink(link, serverHost: Huelle.serverHost) {
                self.laden(pfad: pfad)
            } else {
                self.zeigeBlatt(link)
            }
        }
        if presentedViewController != nil {
            dismiss(animated: false, completion: weiter)
        } else {
            weiter()
        }
    }

    /// Die App kommt wieder nach vorn oder das Netz zurueck: Stand die
    /// Fehlermeldung, gleich noch einmal versuchen.
    func imVordergrund() {
        if isViewLoaded && !fehlerschirm.isHidden { pruefeServer() }
    }

    @objc private func vomRandGewischt(_ wisch: UIScreenEdgePanGestureRecognizer) {
        guard wisch.state == .ended else { return }
        // Ein Stueck weit oder schnell — ein Zucken am Rand ist kein „zurueck".
        guard wisch.translation(in: view).x > 60 || wisch.velocity(in: view).x > 500 else { return }
        guard fehlerschirm.isHidden, presentedViewController == nil else { return }
        ansicht.evaluateJavaScript(Huelle.zurueckSkript) { ergebnis, _ in
            if (ergebnis as? Bool) == true { UISelectionFeedbackGenerator().selectionChanged() }
        }
    }

    /// Die Randgeste neben den Gesten des WebViews, nicht an ihrer Stelle.
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                           shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
        true
    }

    private func ausfuehren(_ ziel: Wegweiser.Ziel, anfrage: URLRequest?) {
        switch ziel {
        case .innen:
            if let anfrage { ansicht.load(anfrage) }
        case .innenLaden(let pfad):
            laden(pfad: pfad)
        case .blatt(let url):
            zeigeBlatt(url)
        case .system(let url):
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        case .verwerfen:
            break
        }
    }

    // MARK: - Server erreichbar?

    private func pruefeServer() {
        guard !prueftGerade else { return }
        prueftGerade = true
        let standDa = !fehlerschirm.isHidden
        fehlerschirm.pruefeGerade(true)
        Erreichbarkeit.pruefen(apiBasis: Huelle.apiBasis) { [weak self] erreichbar in
            guard let self else { return }
            self.prueftGerade = false
            self.fehlerschirm.pruefeGerade(false)
            if erreichbar {
                self.fehlerschirm.isHidden = true
                // Der Client ist ohne Server gestartet und hat seine ersten
                // Anfragen verloren — frisch anfangen statt halb weiter.
                if standDa { self.laden(pfad: "/") }
            } else {
                self.fehlerschirm.isHidden = false
            }
        }
    }

    // MARK: - Blaetter und Dialoge

    func zeigeBlatt(_ url: URL) {
        // SFSafariViewController nimmt nur http(s) und stirbt an allem anderen.
        guard let schema = url.scheme?.lowercased(), schema == "https" || schema == "http" else { return }
        guard presentedViewController == nil else { return }
        let blatt = SFSafariViewController(url: url)
        blatt.preferredBarTintColor = Farben.blau
        blatt.preferredControlTintColor = .white
        blatt.dismissButtonStyle = .done
        present(blatt, animated: true)
    }

    func zeigeTeilen(_ dinge: [Any]) {
        guard !dinge.isEmpty, presentedViewController == nil else { return }
        let teilen = UIActivityViewController(activityItems: dinge, applicationActivities: nil)
        // Nur fuer das iPad noetig (dort ein Popover) — die App ist iPhone-only,
        // laeuft auf dem iPad aber im Kompatibilitaetsmodus, und ohne Anker stuerzte sie ab.
        if let popover = teilen.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 1, width: 1, height: 1)
            popover.permittedArrowDirections = []
        }
        present(teilen, animated: true)
    }

    /// Zeigt einen Dialog — oder ruft `sonst` sofort, wenn gerade nichts
    /// gezeigt werden kann. WebKit wartet auf die Antwort; bliebe sie aus,
    /// stuende der Client fuer immer.
    private func zeigeDialog(_ dialog: UIAlertController, sonst: () -> Void) {
        guard presentedViewController == nil, viewIfLoaded?.window != nil else {
            sonst()
            return
        }
        present(dialog, animated: true)
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        let hauptrahmen = navigationAction.targetFrame?.isMainFrame ?? true
        let ziel = Wegweiser.ziel(fuer: url, hauptrahmen: hauptrahmen,
                                  serverHost: Huelle.serverHost, apiBasis: Huelle.apiBasis)
        if ziel == .innen {
            decisionHandler(.allow)
            return
        }
        decisionHandler(.cancel)
        ausfuehren(ziel, anfrage: nil)
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        bruecke.zuruecksetzen()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Ein Token, das vor dem Laden kam, geht nach jedem Laden noch einmal hin.
        if let token = Mitteilungen.shared.token { pushTokenMelden(token) }
    }

    /// WebKit hat den Inhaltsprozess beendet (Speicherdruck im Hintergrund).
    /// Ohne Neuladen bliebe genau hier der weisse Schirm.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        bruecke.zuruecksetzen()
        if webView.url != nil { webView.reload() } else { laden(pfad: "/") }
    }

    // MARK: - WKUIDelegate

    /// `target="_blank"` und `window.open`: kein zweites Fenster, sondern derselbe Wegweiser.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            let ziel = Wegweiser.ziel(fuer: url, hauptrahmen: true,
                                      serverHost: Huelle.serverHost, apiBasis: Huelle.apiBasis)
            ausfuehren(ziel, anfrage: navigationAction.request)
        }
        return nil
    }

    /*
     * `alert`, `confirm`, `prompt`: Ohne diese drei zeigt der WKWebView gar
     * nichts, und `confirm` liefert stumm false — „Clan verlassen?" oder
     * „für 200 Münzen kaufen?" liessen sich dann nie bestaetigen.
     */

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let antwort = Antwort<Void>(vorgabe: ()) { _ in completionHandler() }
        let dialog = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        dialog.addAction(UIAlertAction(title: "OK", style: .default) { _ in antwort.geben(()) })
        zeigeDialog(dialog) { antwort.geben(()) }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let antwort = Antwort<Bool>(vorgabe: false, completionHandler)
        let dialog = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        dialog.addAction(UIAlertAction(title: "Abbrechen", style: .cancel) { _ in antwort.geben(false) })
        dialog.addAction(UIAlertAction(title: "OK", style: .default) { _ in antwort.geben(true) })
        zeigeDialog(dialog) { antwort.geben(false) }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        let antwort = Antwort<String?>(vorgabe: nil, completionHandler)
        let dialog = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        dialog.addTextField { feld in feld.text = defaultText }
        dialog.addAction(UIAlertAction(title: "Abbrechen", style: .cancel) { _ in antwort.geben(nil) })
        dialog.addAction(UIAlertAction(title: "OK", style: .default) { [weak dialog] _ in
            antwort.geben(dialog?.textFields?.first?.text ?? "")
        })
        zeigeDialog(dialog) { antwort.geben(nil) }
    }

    // MARK: - Push

    private func pushTokenMelden(_ token: String) {
        guard isViewLoaded else { return }
        ansicht.evaluateJavaScript(Huelle.pushSkript(token: token), completionHandler: nil)
    }
}

/// Gibt WebKit die Antwort auf einen Dialog genau einmal — und spaetestens,
/// wenn der Dialog verschwindet, ohne dass jemand getippt hat (etwa weil ein
/// Einladungslink alles Offene schliesst, `HauptController.oeffne`). Kommt
/// die Antwort nie, wirft WebKit eine Ausnahme, und die App ist weg.
private final class Antwort<Wert> {
    private var weiter: ((Wert) -> Void)?
    private let vorgabe: Wert

    init(vorgabe: Wert, _ weiter: @escaping (Wert) -> Void) {
        self.vorgabe = vorgabe
        self.weiter = weiter
    }

    func geben(_ wert: Wert) {
        weiter?(wert)
        weiter = nil
    }

    deinit {
        weiter?(vorgabe)
    }
}
