# Startanimation nach dem Rebranding

Drei Pinguine und eine Giraffe erscheinen als eigenständige Figuren. Sie
stehen kurz getrennt, gleiten zusammen und verschmelzen mit einem weichen
farbigen Schein zum originalen runden Logo. Danach erscheint die Wortmarke.
Der Aufbau endet nach etwa 2,45 Sekunden; bei geladener App folgt die kurze
Ausblendung. Das vorhandene finale Logo wird nicht verändert.

Alle vier Figuren liegen in einem transparenten 2×2-Atlas (768×768,
84.010 Bytes). CSS bewegt nur die einzelnen Ausschnitte. Kein Video und
keine zusätzliche Animationsbibliothek; das Bild wird beim Start vorgeladen.

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
Bibliothek. Ein gemeinsames Figurenbild ergänzt die vorhandenen Markenbilder. Auth-/Hub-Logogrößen und native Startfarbe
angepasst. Der lokale Tafel-Zugang antwortet mit 401 „Token ungültig“;
diese Notiz dient deshalb als Übergabe für die spätere Übernahme.

## Grafik und Ablage

Werkzeug: eingebautes Imagegen. Das bestehende Logo ist die Identitätsreferenz.
Auslieferung: /Users/emileklerner/.codex/worktrees/logo-startanimation/brauweg/packages/client/public/hub/start-tiere.webp
Original: /Users/emileklerner/Broweg/repos/brauweg-art/startanimation/tiere-original.png

### Verwendeter Bildprompt

Use case: identity-preserve. Asset type: a single 2-by-2 transparent character sprite atlas for the startup animation of the supplied BroweGGames brand. Reference image supplies EXACT character identities, flat rounded hand-drawn vector-like illustration, thick dark navy outlines, cream faces, gentle original shading and colors. Separate the FOUR animals from the emblem and reconstruct their full independent clean silhouettes. Atlas layout: perfectly square image, four equal square cells in a 2 by 2 grid, each character centered within its own cell, generous transparent padding, no touching or overlap between cells. Top LEFT: the friendly purple penguin from upper-left of emblem, navy face, cream cheeks, orange beak, purple hood/body. Top RIGHT: the cheerful golden yellow giraffe with orange-brown spots, cream muzzle, two ossicones and ears, full rounded neck/body silhouette. Bottom LEFT: the friendly coral-orange penguin, navy face cream cheeks, orange beak, coral body with cream plus symbol on belly from the emblem. Bottom RIGHT: the friendly turquoise-teal penguin with navy face, cream cheeks, orange beak, teal body with the same four cream controller-button dots on belly. Penguins are stubby round stylized characters, giraffe taller but fits cell. All face slightly toward atlas center so they can move together in animation. Original faces, not new unrelated mascots. DO NOT reproduce any circular logo border, playing cards, wordmark, text, background, grid lines, labels, decorations, watermarks or shadows cast outside silhouettes. Precisely FOUR separated animals, one per cell, entire silhouettes visible. True transparent alpha background throughout empty space. Keep all shapes opaque and edges crisp.
