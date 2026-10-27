# Team-Schnittstelle: brotool-Dashboard und Münz-Codes

Stand 27.10.2026. Der brotool-Tab **„Spielen"** zeigt ein Dashboard aus der
Tagesstatistik (`stats_tag`, Niklas' „Tracking Stufe 0", #328) und verwaltet
**Münz-Codes**. brotool spricht nicht direkt mit brauweg, sondern über den
bro-server; der hält je Umgebung einen Dienstzugang mit dem Schlüssel.

| Route | Was | Schutz |
| --- | --- | --- |
| `GET /api/team/statistik?von=JJJJ-MM-TT&bis=…` | Tagessummen roh + Kontenzahl, Gäste, Code-Stand. Ohne Angabe die letzten 30 Tage, höchstens 366 | `x-team-schluessel` |
| `GET /api/team/codes?grenze=200` | die letzten Codes mit Stand (eingelöst von wem, wann; gesperrt) | `x-team-schluessel` |
| `POST /api/team/codes` `{anzahl, muenzen, notiz?, gueltigBis?}` | 1–200 Einmal-Codes à 1–1.000.000 Münzen | `x-team-schluessel` |
| `POST /api/team/codes/:id/sperren` | offenen Code sperren | `x-team-schluessel` |
| `POST /api/me/code` `{code}` | einlösen | Konto, **nur Webseite** |

- **`TEAM_SCHLUESSEL`** (≥ 20 Zeichen) je Umgebung in Railway setzen —
  Produktion und staging bekommen verschiedene Werte. Ohne ihn antworten die
  Team-Routen 404.
- **Einmal-Codes:** Jeder Code gilt genau einmal, für ein Konto
  (`BW-XXXX-XXXX`, ohne verwechselbare Zeichen). Verbraucht, gesperrt,
  abgelaufen und unbekannt bekommen dieselbe Antwort.
- **Nicht in der App:** Apple-Regel 3.1.1 verbietet eigene Freischalt-Codes in
  Apps. Der Server lehnt Einlösungen mit App-Herkunft ab (`codeNurImWeb`), die
  App zeigt das Feld nicht. Die Münzen gelten danach auch in der App.
- Auf staging lässt der Zugangsschutz (`STAGING_ZUGANG`) Aufrufe mit
  `x-…-schluessel`-Kopfzeile durch.
