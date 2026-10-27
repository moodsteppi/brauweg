import UIKit

/// Das eine Fenster der App — und der Weg, auf dem Universal Links ankommen.
///
/// Ein Einladungslink `https://www.brauweg-spielen.de/beitritt/<CODE>` kommt
/// auf zwei Wegen: beim Kaltstart in `connectionOptions.userActivities`, bei
/// laufender App in `scene(_:continue:)`. Beide landen im HauptController,
/// der ihn als `brauweg://app/beitritt/<CODE>` laedt; den Code liest der
/// Client beim Start selbst (einladungslink.ts). Dass iOS den Link ueberhaupt
/// der App gibt, haengt an den Associated Domains (Konfiguration/Push-*.entitlements)
/// und an `/.well-known/apple-app-site-association` auf dem Server — die gibt es
/// erst, wenn dort `APPLE_TEAM_ID` gesetzt ist (docs/APP-RELEASE.md).
final class SzenenDelegat: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?
    private var haupt: HauptController?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let fensterSzene = scene as? UIWindowScene else { return }
        let aktivitaet = connectionOptions.userActivities.first(where: {
            $0.activityType == NSUserActivityTypeBrowsingWeb
        })
        let link = aktivitaet?.webpageURL
        let haupt = HauptController(startLink: link)
        let fenster = UIWindow(windowScene: fensterSzene)
        fenster.backgroundColor = Farben.blau
        fenster.rootViewController = haupt
        fenster.makeKeyAndVisible()
        window = fenster
        self.haupt = haupt
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
              let link = userActivity.webpageURL else { return }
        haupt?.oeffne(link: link)
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        haupt?.imVordergrund()
    }
}
