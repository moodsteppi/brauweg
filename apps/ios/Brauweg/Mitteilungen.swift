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
final class Mitteilungen {

    static let shared = Mitteilungen()

    /// Das zuletzt erhaltene Token (hex), oder nil.
    private(set) var token: String?

    /// Wer das Token an den Client weiterreicht (HauptController).
    var beiToken: ((String) -> Void)?

    private init() {}

    /// Beim Start: nur, wenn eingeschaltet UND schon erlaubt — dann das Token auffrischen.
    func beimStart() {
        guard Huelle.pushEingeschaltet else { return }
        UNUserNotificationCenter.current().getNotificationSettings { einstellungen in
            let erlaubt = einstellungen.authorizationStatus == .authorized
                || einstellungen.authorizationStatus == .provisional
            guard erlaubt else { return }
            DispatchQueue.main.async { UIApplication.shared.registerForRemoteNotifications() }
        }
    }

    /// Auf Wunsch des Clients: um Erlaubnis fragen und registrieren.
    func erlauben() {
        guard Huelle.pushEingeschaltet else { return }
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { erlaubt, _ in
            guard erlaubt else { return }
            DispatchQueue.main.async { UIApplication.shared.registerForRemoteNotifications() }
        }
    }

    /// Aus dem AppDelegat.
    func erhalten(_ geraeteToken: Data) {
        let hex = Mitteilungen.hex(geraeteToken)
        token = hex
        beiToken?(hex)
    }

    static func hex(_ daten: Data) -> String {
        daten.map { String(format: "%02x", $0) }.joined()
    }
}
