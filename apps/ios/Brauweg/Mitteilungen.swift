import UIKit
import UserNotifications

/// Push-Mitteilungen („du bist dran") — NUR VORBEREITET.
///
/// Solange `Huelle.pushEingeschaltet` aus ist (Vorgabe, Build-Einstellung
/// `BRAUWEG_PUSH = NO`), tut hier nichts etwas: keine Frage nach der
/// Erlaubnis, keine Registrierung, und im Signierprofil steht auch kein
/// `aps-environment` (Konfiguration/Push-NO.entitlements). Die Server-Seite
/// (Tabelle fuer Geraete-Token, APNs-Schluessel) baut ein anderer Auftrag.
///
/// Eingeschaltet laeuft es so: Der Client fragt ueber die Bruecke an
/// (`BrauwegNativ.pushErlauben()`) — nie die App von sich aus beim ersten
/// Start, denn eine Frage ohne Anlass lehnen die meisten ab, und ein Nein
/// laesst sich aus der App heraus nicht mehr umstimmen. Ist die Erlaubnis
/// schon erteilt, holt die App beim Start ein frisches Token. Jedes Token
/// geht als Ereignis `brauweg:push-token` mit `{plattform: 'ios', token}` an
/// den Client (Huelle.pushSkript), der es dem Server meldet.
///
/// Vertrag: docs/PUSH.md, Abschnitt 3 (PR #239). `token: null` heisst
/// „abgelehnt oder nicht da" — auch das bekommt der Client zu hoeren, damit
/// er nicht auf ein Token wartet, das nie kommt.
///
/// Mitteilungen, waehrend die App vorne ist, zeigt iOS ohne
/// `UNUserNotificationCenterDelegate` gar nicht an — gewollt (PUSH.md: kein
/// Banner ueber der App).
///
/// APNs-Umgebung: `aps-environment` steht in Push-YES.entitlements auf
/// `development`. Ein Bau aus Xcode (Debug, Entwicklerprofil) bekommt damit
/// ein Sandbox-Token; beim Export fuer TestFlight und den Store setzt Xcode
/// es selbst auf `production`. Fest `production` in die Datei zu schreiben,
/// liesse schon das Archiv scheitern, weil es mit dem Entwicklerprofil
/// signiert wird. Der Server muss dazu passen (`APNS_UMGEBUNG`).
final class Mitteilungen {

    static let shared = Mitteilungen()

    /// Ist dem Client schon etwas zu melden — ein Token oder ein Nein?
    private(set) var gemeldet = false
    /// Das zuletzt erhaltene Token (hex), oder nil (abgelehnt, fehlgeschlagen).
    private(set) var token: String?

    /// Wer das Token an den Client weiterreicht (HauptController). nil = kein Token.
    var beiToken: ((String?) -> Void)?

    private init() {}

    /// Beim Start: nur, wenn eingeschaltet. Schon erlaubt → frisches Token
    /// holen, ohne zu fragen; abgelehnt → das dem Client sagen.
    func beimStart() {
        guard Huelle.pushEingeschaltet else { return }
        UNUserNotificationCenter.current().getNotificationSettings { einstellungen in
            switch einstellungen.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                DispatchQueue.main.async { UIApplication.shared.registerForRemoteNotifications() }
            case .denied:
                DispatchQueue.main.async { self.melden(nil) }
            default:
                break
            }
        }
    }

    /// Auf Wunsch des Clients: um Erlaubnis fragen und registrieren.
    func erlauben() {
        guard Huelle.pushEingeschaltet else { return }
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { erlaubt, _ in
            DispatchQueue.main.async {
                if erlaubt {
                    UIApplication.shared.registerForRemoteNotifications()
                } else {
                    self.melden(nil)
                }
            }
        }
    }

    /// Aus dem AppDelegat.
    func erhalten(_ geraeteToken: Data) {
        melden(Mitteilungen.hex(geraeteToken))
    }

    /// Aus dem AppDelegat: Registrierung gescheitert (kein Push im Profil,
    /// Simulator ohne Konto).
    func gescheitert() {
        melden(nil)
    }

    private func melden(_ neu: String?) {
        gemeldet = true
        token = neu
        beiToken?(neu)
    }

    static func hex(_ daten: Data) -> String {
        daten.map { String(format: "%02x", $0) }.joined()
    }
}
