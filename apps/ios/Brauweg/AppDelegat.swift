import UIKit

/// Einstieg der App. Die Fenster verwaltet der SzenenDelegat (Info.plist,
/// `UIApplicationSceneManifest`) — hier steht nur, was an der App als Ganzem
/// haengt: das Push-Token, das iOS dem AppDelegate zustellt und keiner Szene.
@main
final class AppDelegat: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        Mitteilungen.shared.beimStart()
        return true
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Mitteilungen.shared.erhalten(deviceToken)
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Ohne Push-Faehigkeit im Profil oder im Simulator ohne Konto: Dann gibt
        // es eben keine Mitteilungen, die App laeuft weiter.
        NSLog("Brauweg: Push-Registrierung fehlgeschlagen: %@", error.localizedDescription)
        Mitteilungen.shared.gescheitert()
    }
}
