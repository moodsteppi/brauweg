# UMFANG: die restlichen Nur-Web-Teile — Fertigmeldung

Karte d4da0bd8 (Projekt #9, Robin 23.10.2026): Auf der Produktion zeigt die
Webseite strikt den App-Umfang, einzige Ausnahme die Anmeldung mit Apple und
Google. Grundlage ist der Abgleich in `ios-web-abgleich.md`; die Regeln für
den Betrieb stehen in `docs/APP-RELEASE.md` unter „UMFANG".

Diese Datei steht im Repo, damit die Fertigmeldung mit dem Diff freigegeben
wird und nicht nur in einem Lauf-Protokoll liegt.

## Herkunft der Commits

Die Karte lief dreimal. Der erste Anlauf (f017f1d5, „Mood Stand PC") wurde
abgebrochen, weil der Rechner pausiert war; der Vermerk des Orchestrators
sagte, es sei kein Zweig bekannt. Das traf nicht zu: Der Lauf hatte vor dem
Abbruch zwei Commits gepusht (`98e63ca6`, `18893fef`). Der zweite Anlauf hat
sie Zeile für Zeile gegen die Karte gelesen, übernommen und um den Wächter
für die Spielsperre ergänzt (`e7176e63`). Der dritte (diese Nachbesserung)
ergänzt die Client-Tests je Funktion und diese Datei.

**Ob der Stand des abgebrochenen Laufs als Ergebnis der Karte gelten soll,
entscheidet die Freigabe** — er ist hier vollständig sichtbar und durch die
Tests unten gedeckt, aber niemand hat ihn außerhalb der Worker angesehen.

## Funktion | Routenmuster | Client-Stelle

Gesperrt wird im Server (`FUNKTION_ZU_ROUTE` und `SPIEL_ZU_ROUTE` in
`packages/server/src/http/app.ts`, Antwort `nichtImUmfang` bzw.
`gameNotPlayable`); der Client blendet nur den Einstieg aus
(`imUmfang` aus `packages/client/src/umfang.ts`).

| Funktion | Routenmuster | Client-Stelle |
| --- | --- | --- |
| `shop` | `^/api/shop/(pakete\|truhen)(/\|$)`; Kauf mit `waehrung: 'gems'` an `POST /api/shop/:itemId/buy` | `zeigeKaufbares` (`GameSelect.tsx`, Shop-Reiter), `mitEdelsteinen()` (`laufzeit.ts` → `HubRahmen.tsx`, `Kleiderschrank.tsx`), `sperrgrund` (`inhaltspakete.ts`), Wappenraster (`Clan.tsx`) |
| `abstimmung` | `^/api/games/:gameId/vote$` | `mitAbstimmung` (`SpieleNeu.tsx`): Knopf „Dafür" und Stimmenzahl |
| `profilbild` | `^/api/me$`, nur `PATCH` | `ProfilBild` (`GameSelect.tsx`): ohne Hochladen, ein vorhandenes Bild bleibt sichtbar |
| `figur` | `^/api/me/figur$` | „Deine Figur" im Profil (`GameSelect.tsx`), Pinguin-Karte (`SammlungNeu.tsx`) |
| `geburtstag` | `^/api/me/birthday-reward$`; `/api/me` meldet `birthdayRewardClaimable: false` | `mitGeburtstag` (`GameSelect.tsx`): Abschnitt, Geschenk, Zeile unter dem Namen |
| Spiel (jede Kennung) | jede Route mit `:gameId` (zehn heute, festgehalten im Test) | Spielliste kommt gefiltert aus `/api/games` |
| `mememory` | `^/api/mememory(/\|$)` | — (über `/api/games`) |
| `doppelkopf` | `^/api/lernpfad/uebung$` (die Übungsrunde) | `mitTisch` (`lernen/LektionSpieler.tsx`): Ende ohne „Runde starten" |
| `brocooked` | keine — läuft allein ohne Tisch | Weiche in `App.tsx` (`onPick`) |
| Profilstatistik | `/api/me` (`stats`), `/api/players/:accountId` (`ranking`) zeigen nur Spiele im Umfang | — |

Bewusst **nicht** im Umfang: die Anmeldung (Apple, Google, E-Mail), Konto
löschen (`DELETE /api/me` bleibt offen, eigener Test), Kleiderschrank,
Klanghalle, Rangliste, Aufgaben, Trophäenweg, Freunde, Melden, der Kauf mit
Münzen. Ohne Variable bleibt alles an.

## Tests je Funktion

Server, `packages/server/test/umfang.test.ts`:

- alle Funktionen: „jede Funktion hat hier mindestens einen Aufruf", „…
  ausserhalb des Umfangs: jeder direkte Aufruf wird abgewiesen, auf Webseite
  und App", „… im Umfang: die Sperre greift nicht"
- `profilbild`: „ohne Profilbild bleibt /api/me lesbar", „… Konto loeschen
  eingeschlossen"
- `shop`: „ohne Shop wird mit Muenzen weiter gekauft, nur nicht mit Edelsteinen"
- `geburtstag`: „ohne Geburtstag liegt kein Geschenk bereit"
- Spiele: „ausgeblendetes Spiel: Rangliste, Bestleistungen, Vorgaben,
  Aussehen und Mememory sind zu", „die Spielsperre trifft genau diese Routen
  mit :gameId", „Profilstatistiken zeigen je Spiel nur den Umfang"
- `doppelkopf`: „die Uebungsrunde des Lernpfads haengt an Doppelkopf"

Client, je Funktion ein Fall mit und einer ohne die Kennung:

| Funktion | Datei |
| --- | --- |
| `shop` | `screens/HubNeu.umfang.test.tsx` (Reiter, Edelsteine), `screens/SpieleNeu.umfang-web.test.tsx` (`mitEdelsteinen`, `sperrgrund`) |
| `abstimmung` | `screens/SpieleNeu.umfang-web.test.tsx` |
| `profilbild`, `figur`, `geburtstag` | `screens/HubNeu.umfang.test.tsx` |
| `doppelkopf` (Übungsrunde) | `lernen/LektionSpieler.test.tsx` |
| `brocooked` | `App.umfang.test.tsx` |

Die Zahlen des vollen Laufs stehen in der Zusammenfassung des CI-Jobs
„Bauen und prüfen" zum jeweiligen Commit — nicht hier (CLAUDE.md, „Die
Zahlen trägt niemand mehr von Hand nach").

## Vorgeschlagene UMFANG-Zeile für die Produktion

```
UMFANG=doppelkopf,skat,filler,brochess,kartenmanufaktur,browort,clanwort,lernpfad
```

Begründung in `docs/APP-RELEASE.md`. Gesetzt wird sie erst mit dem Release;
das ist ein eigener Handgriff in Railway, nicht Teil dieses Zweigs.
