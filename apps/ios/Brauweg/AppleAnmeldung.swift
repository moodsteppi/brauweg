import AuthenticationServices
import UIKit

/// „Mit Apple anmelden" nativ — der eine Handgriff, den der Client dafuer nicht
/// selbst kann.
///
/// Warum nicht Apples Web-Popup wie auf der Webseite: Im WKWebView kommt es
/// nicht zuverlaessig zum oeffnenden Fenster zurueck, und App-Store-Regel 4.8
/// verlangt in einer App den Systemdialog. Die Oberflaeche (Knopf, Nachfrage
/// nach dem Geburtstag, Fehlermeldung) bleibt trotzdem im Client
/// (packages/client/src/anmeldung/AnbieterKnoepfe.tsx); hier entsteht nur das
/// ID-Token.
///
/// Die Nonce kommt vom Server (`POST /api/auth/nonce`) und geht UNGEHASHT an
/// Apple. Apple schreibt sie genau so ins Token, und der Server loest sie dort
/// ein (packages/server/src/auth/apple.ts). Das verbreitete Hashen mit SHA-256
/// braucht nur, wer die Nonce selbst erzeugt und gegen das Token vergleicht —
/// hier vergleicht der Server mit seiner eigenen.
///
/// Das Token geht nicht an den Server, sondern an den Client zurueck: Der
/// schickt es an `/api/auth/apple`, wie im Web, und bekommt dieselben
/// Antworten (Sitzung oder Schein fuer das Geburtsdatum).
final class AppleAnmeldung: NSObject, ASAuthorizationControllerDelegate,
                            ASAuthorizationControllerPresentationContextProviding {

    /// Was der Client zurueckbekommt — `Huelle.appleSkript`.
    enum Ergebnis: Equatable {
        case token(idToken: String, vorname: String?)
        /// Dialog weggewischt oder „Abbrechen": kein Fehler, nur kein Ergebnis.
        case abgebrochen
        case fehlgeschlagen
    }

    private weak var fenster: UIWindow?
    private let fertig: (Ergebnis) -> Void
    /// Haelt den Dialog am Leben, bis Apple geantwortet hat — ASAuthorizationController
    /// haelt sich nicht selbst.
    private var laufend: ASAuthorizationController?

    init(fenster: UIWindow?, fertig: @escaping (Ergebnis) -> Void) {
        self.fenster = fenster
        self.fertig = fertig
        super.init()
    }

    func starten(nonce: String) {
        // Doppelt getippt: Der erste Dialog laeuft noch, der zweite kaeme mit
        // derselben, gleich verbrauchten Nonce.
        guard laufend == nil else { return }
        let anfrage = ASAuthorizationAppleIDProvider().createRequest()
        // Der Name kommt nur beim allerersten Mal (apple.ts) — danach nie wieder.
        anfrage.requestedScopes = [.fullName, .email]
        anfrage.nonce = nonce
        let dialog = ASAuthorizationController(authorizationRequests: [anfrage])
        dialog.delegate = self
        dialog.presentationContextProvider = self
        laufend = dialog
        dialog.performRequests()
    }

    func authorizationController(controller: ASAuthorizationController,
                                 didCompleteWithAuthorization authorization: ASAuthorization) {
        laufend = nil
        guard let nachweis = authorization.credential as? ASAuthorizationAppleIDCredential,
              let daten = nachweis.identityToken,
              let idToken = String(data: daten, encoding: .utf8), !idToken.isEmpty else {
            fertig(.fehlgeschlagen)
            return
        }
        let vorname = nachweis.fullName?.givenName?.trimmingCharacters(in: .whitespacesAndNewlines)
        fertig(.token(idToken: idToken, vorname: vorname?.isEmpty == false ? vorname : nil))
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        laufend = nil
        fertig(AppleAnmeldung.einordnen(error))
    }

    /// Abbrechen ist kein Fehler. `.unknown` meldet iOS auch, wenn jemand den
    /// Dialog ohne angemeldete Apple-ID wegtippt — eine rote Meldung waere
    /// dort falsch, die Person hat schlicht nicht gewollt.
    static func einordnen(_ fehler: Error) -> Ergebnis {
        guard let fehler = fehler as? ASAuthorizationError else { return .fehlgeschlagen }
        switch fehler.code {
        case .canceled, .unknown: return .abgebrochen
        default: return .fehlgeschlagen
        }
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        fenster ?? ASPresentationAnchor()
    }
}
