import UIKit
import UserNotifications

/// Push-Mitteilungen („du bist dran").
///
/// Seit dem 13.10.2026 eingeschaltet (`BRAUWEG_PUSH = YES` in project.yml).
/// Ist es aus, tut hier nichts etwas: keine Frage nach der Erlaubnis, keine
/// Registrierung, und im Signierprofil steht kein `aps-environment`
/// (Konfiguration/Push-NO.entitlements). Zugestellt wird erst, wenn auf dem
/// Server der APNs-Schluessel gesetzt ist (docs/PUSH.md, Abschnitt 1) — bis
/// dahin meldet die App ihr Token, und der Server schreibt jede Mitteilung
/// nur ins Log.
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
/// Mitteilungen, waehrend die App vorne ist, zeigen wir nicht an — gewollt
/// (PUSH.md: kein Banner ueber der App). Der Delegat ist trotzdem da, weil
/// er das ANTIPPEN meldet: Die Mitteilung traegt `tableId` und `gameId`, und
/// der Client springt damit an den Tisch (`Huelle.tischSkript`).
///
/// APNs-Umgebung: `aps-environment` steht in Push-YES.entitlements auf
/// `development`. Ein Bau aus Xcode (Debug, Entwicklerprofil) bekommt damit
/// ein Sandbox-Token; beim Export fuer TestFlight und den Store setzt Xcode
/// es selbst auf `production`. Fest `production` in die Datei zu schreiben,
/// liesse schon das Archiv scheitern, weil es mit dem Entwicklerprofil
/// signiert wird. Der Server muss dazu passen (`APNS_UMGEBUNG`).
final class Mitteilungen: NSObject, UNUserNotificationCenterDelegate {

    static let shared = Mitteilungen()

    /// Ist dem Client schon etwas zu melden — ein Token oder ein Nein?
    private(set) var gemeldet = false
    /// Das zuletzt erhaltene Token (hex), oder nil (abgelehnt, fehlgeschlagen).
    private(set) var token: String?

    /// Wer das Token an den Client weiterreicht (HauptController). nil = kein Token.
    var beiToken: ((String?) -> Void)?

    /// Zuletzt angetippte Mitteilung, bis der Client sie abgeholt hat. Beim
    /// Kaltstart tippt man, BEVOR die Seite geladen ist — dann holt sie
    /// HauptController nach dem Laden ab.
    private(set) var angetippt: (tableId: String, gameId: String)?
    /// Wer das Antippen an den Client weiterreicht (HauptController).
    var beiAntippen: ((String, String) -> Void)?

    private override init() {}

    /// Beim Start: nur, wenn eingeschaltet. Schon erlaubt → frisches Token
    /// holen, ohne zu fragen; abgelehnt → das dem Client sagen.
    func beimStart() {
        guard Huelle.pushEingeschaltet else { return }
        // Vor dem Ende von didFinishLaunching setzen: Nur dann bekommt der
        // Delegat auch das Antippen, das die App erst gestartet hat.
        UNUserNotificationCenter.current().delegate = self
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

    /// Der Client hat den Tisch uebernommen; nicht noch einmal melden.
    func angetipptAbgeholt() {
        angetippt = nil
    }

    // MARK: - UNUserNotificationCenterDelegate

    /// Im Vordergrund: nichts anzeigen (siehe oben).
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([])
    }

    /// Angetippt: an den Tisch, von dem die Mitteilung handelt. Die Daten
    /// stehen neben `aps` (docs/PUSH.md, Abschnitt 3).
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let daten = response.notification.request.content.userInfo
        if let tableId = daten["tableId"] as? String, let gameId = daten["gameId"] as? String {
            angetippt = (tableId, gameId)
            beiAntippen?(tableId, gameId)
        }
        completionHandler()
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
