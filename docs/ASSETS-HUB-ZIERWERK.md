# Hub-Zierwerk: Shop, Profil und Clan

Stand: 28.11.2026. Lokaler Umbau, noch nicht veröffentlicht.

## Gestaltung und Bestellung

Gemeinsame Materialien: dunkles Walnussholz, dezente Messingbeschläge,
waldgrüne Leseflächen und warme Laternen. Die vorhandene Spielstube,
Spielegrafiken und Holzregister bleiben erhalten. Neue Bildmotive mit dem
Bildgenerator erstellt; keine Fremdgrafiken.

| Motiv          | Auslieferung        | Einsatz / Freihaltefläche                                                                                                  |
| -------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `rahmen.webp`  | 384 × 384, Alpha    | Neun Segmente, 13 % Schnitt. Transparente Mitte, gerade Kanten und feste Ecken für breite Buttons, Zähler und hohe Tafeln. |
| `uhr.webp`     | 192 px breit, Alpha | Sanduhr mit Messing und Holz für Shop-Wechsel. Silhouette bei 58 px noch erkennbar.                                        |
| `angebot.webp` | 256 px breit, Alpha | Verdecktes Angebot als grüner Samtbeutel auf Holzsockel. Name, Rabatt und Seltenheit außerhalb des Bildes.                 |
| `halle.webp`   | 960 × 640           | Gildenhalle als Clan- und Profilkulisse. Mitte frei für Wappen, Avatar und lesbaren Text.                                  |

Originale: `packages/client/art/hub-zierwerk/originale/` (ignoriert).
Verkleinerte Arbeitskopien: `wappen/` und `szene/` daneben.
WebP: `packages/client/public/hub/zierwerk/`. Umwandlung mit
`~/bildwerkzeug/wandeln.mjs`, Profile `wappen` und `szene`.
Die vier Dateien wiegen zusammen rund 148 KiB.

Abnahme: echter Alphakanal, kein Schachbrett, keine eingebrannten Wörter,
keine Originalauflösung unter public. Text, Preise, Timer, Sperr- und
Auswahlzustände bleiben zugänglich in HTML. Keine dauernden Grafikanimationen,
kein zusätzlicher 3D-Renderer. Hover/Drücken berücksichtigt reduzierte Bewegung.

## Einbau

`hub-zierwerk.css` ist auf den Hub begrenzt und nutzt Bildrahmen für die
bestehenden Bedienelemente. Die Shop-Kategorien verwenden dasselbe
`kategorie-register.css` wie Games und Collection. Der kleine Shop-Einstieg
in Collection verwendet das vorhandene Bildsymbol des Navigationsatlas.

Clan-Chat: Das bisherige `position: fixed` bezog sich auf den verschobenen
Wisch-Track und lag dadurch links außerhalb des Clan-Tabs. Im Hub wird die
Ansicht nun absolut im eigenen `hb-reiterplatz` angeordnet. Außerhalb des
Hubs bleibt das alte Vollbildverhalten erhalten. Die unnötige App-Sperre
entfällt; `imUmfang('clanchat')` bleibt verbindlich. Unsichtbare Tabs pollen
nicht; langsame Chat-Abfragen überlappen sich nicht. Nachrichten der lokalen
Gestaltungsprobe sind ausdrücklich lokale Beispieldaten.

## Tafel-Nachtrag für die spätere Veröffentlichung

- Hub → Zierwerk: gemeinsame Neun-Segment-Bildrahmen, Shop-Register und Gildenhalle.
- Clan → Chat: Position im eigenen Wisch-Tab; Freigabe über Serverumfang auch in iOS.
- ProbeHub → ClanChat: lokale Nachrichten-Fixture ohne echte Chat-Schreibzugriffe.
