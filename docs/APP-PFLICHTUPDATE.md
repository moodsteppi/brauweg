# Verpflichtende App-Store-Aktualisierung

Die native iOS-Hülle prüft beim Start und bei Rückkehr in den Vordergrund, ob Apple eine neuere öffentliche Version derselben Bundle-ID im Store des angemeldeten Apple-Kontos ausliefert. Normale Prüfungen erfolgen höchstens alle 15 Minuten, eine sichtbare Update-Sperre kann nach fünf Sekunden erneut geprüft werden. Debug, Staging und TestFlight nehmen nicht an der Pflicht teil.

`UpdateRegel.swift` vergleicht die Versionsbestandteile numerisch (1.10 > 1.9, 1.0 = 1.0.0), prüft Veröffentlichungsdatum, App-ID und unterstützte iOS-Version. Keine Sperre bei unveröffentlichten, fremden oder auf dem Gerät nicht installierbaren Releases. StoreKit liefert das tatsächliche Store-Land; es wird nicht aus der Gerätesprache geraten. Die App-Store-URL wird ausschließlich aus geprüfter App-ID und fester Apple-Domain erzeugt.

`UpdatePruefer.swift` liest Apples öffentliche Lookup-Schnittstelle ohne API-Schlüssel. Ein gültig bestätigtes Update wird innerhalb der App in UserDefaults gemerkt (Privacy-Manifest: CA92.1). Netzwerkfehler erzeugen keine neue Sperre. Eine bestehende Bestätigung gilt höchstens 24 Stunden; eine gültige Antwort ohne verfügbares Update hebt sie auf. Dadurch bleibt eine zurückgezogene Version oder ein dauerhafter Store-Ausfall kein unerfüllbarer Zwang.

`Updateschirm.swift` liegt über dem gesamten Client, hat keinen Schließen-/Überspringen-Knopf und sperrt WebView-Bedienung, Zurückgesten, Dialoge, Teilen und eingehende Links. „Jetzt aktualisieren“ öffnet den App Store. Installieren muss der Nutzer dort selbst. Nach einer Installation verschwindet die Sperre anhand der tatsächlich installierten Version, nicht durch Antippen des Knopfes. Konto und Sammlung werden nicht verändert.

Die Logik muss einmal als reguläres App-Update ausgeliefert werden. Bereits installierte ältere Apps ohne diese Prüfung lassen sich dadurch nicht nachträglich sperren. Ein Git-Merge auf Staging verteilt keinen neuen iOS-Build. Kein TestFlight-/App-Store-Upload ist Teil dieser Änderung.

Prüfung: `UpdateRegelTests.swift` deckt Versionsvergleiche, Verfügbarkeit, Gerätekompatibilität, Store-Wechsel und Ablauf der Offline-Bestätigung ab. Zusätzlich nativer Build und bestehende iOS-Manifest-/Konfigurationstests.

Apple-Quellen: [Lookup-Schnittstelle](https://performance-partners.apple.com/search-api), [Storefront](https://developer.apple.com/documentation/storekit/storefront), [Manuelles Aktualisieren auch bei stufenweiser Freigabe](https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases), [Required-Reason-APIs](https://developer.apple.com/documentation/technotes/tn3183-adding-required-reason-api-entries-to-your-privacy-manifest).
