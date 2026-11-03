# Startanimation nach dem Rebranding

Das vorhandene vertikale BroweGGames-Logo wird im Startbildschirm aus vier
maskierten Bildteilen zusammengesetzt. Danach erscheint die Wortmarke.
Nach rund 1,2 Sekunden ersetzt dasselbe vollständige Bild die Teile, damit
keine Maskennähte bleiben. Kein zusätzliches Video und keine neue Bilddatei.

Das Konto und die Startbilder laden parallel. Der Fortschritt läuft nie
voraus. Nach dem Aufbau bleibt die Marke beim Laden am selben Ort; bei
Bereitschaft blendet sie aus und App.tsx öffnet den bisherigen Einstieg.
Bei reduzierter Bewegung erscheint sofort das fertige Logo.

Anmeldung und kleinere horizontale Logo-Bereiche sind für die Proportionen
des neuen Lockups vergrößert. Die native iOS-Startfarbe passt zum dunklen
Animationshintergrund (#050b1d). Der native Startbildschirm selbst bleibt
statisch; der Aufbau beginnt im gebündelten Web-Client.

Vorschau: lokaler Dev-Server, /?dev=start. Mit &halt=laden bleibt das Logo
mit der Ladeanzeige sichtbar. Prüfung: Start-/Anmeldetests, kompletter
Client-Testlauf, vollständiger Root-Build, iPhone-Vorschau 390 × 844.

Kein Push, Deploy oder TestFlight-Upload. Separater Zweig:
codex/logo-startanimation, basierend auf staging a4c5a3e.

TAFEL: Neuer Startablauf im bestehenden Startbildschirm, ohne zusätzliche
Bibliothek oder neue Medien. Auth-/Hub-Logogrößen und native Startfarbe
angepasst. Der lokale Tafel-Zugang antwortet mit 401 „Token ungültig“;
diese Notiz dient deshalb als Übergabe für die spätere Übernahme.
