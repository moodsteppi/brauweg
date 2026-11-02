# Belege zur Stufe 1 (TikTok-Figuren)

Hier stehen die Werkzeugantworten **wörtlich**, auf die sich `README.md`
stützt. Sie stehen hier, weil ein Zweitleser die Preise und das Guthaben bisher
nur als Behauptung in der README fand und nicht nachprüfen konnte. Die Antworten
sind unverändert eingefügt; gekürzt ist nichts.

## 1. Preis und Guthaben über den versein-MCP

Abgefragt am 02.11.2026 um 17:04 UTC auf `DESKTOP-VL852RM` (= Mood XPS,
Ausgabe von `hostname`). `estimate_cost` erzeugt nichts und rechnet nichts
ab. Erzeugt wurde in diesem Lauf nichts.

`get_balance`:

```json
{"balance":14210,"credits_info_url":"https://www.versein.ai/mcp#credits","next_expiring":{"amount":140,"expires_at":"2026-11-17T12:08:38.872227Z"}}
```

`estimate_cost` mit `media: video`, zwei Posten
`kie-seedance-2.5`, `duration: 4`, `aspect_ratio: 9:16`,
`generate_audio: false`, einmal `480p`, einmal `1080p`:

```json
{"affordable":true,"balance":14210,"billing_note":"Generating through an AI assistant is charged in VerseIn coins. Unlimited-plan allowances do not apply here.","confirmation_threshold_coins":50,"items":[{"cost_coins":234,"index":0,"model":"kie-seedance-2.5","model_name":"Seedance 2.5"},{"cost_coins":520,"index":1,"model":"kie-seedance-2.5","model_name":"Seedance 2.5"}],"requires_confirmation":true,"total_cost_coins":754}
```

`get_model kie-seedance-2.5` (vorheriger Lauf am selben Tag, Auszug der
Felder):

```json
{"aspect_ratios":["16:9","9:16","1:1","4:3","3:4","21:9"],"default_duration":5,"duration_range":[4,30],"resolutions":["480p","720p","1080p"],"starting_cost_coins":650,"supports_audio":true}
```

**Was daraus folgt:**
- Ein Clip kostet über den MCP 234 Münzen (480p) bzw. 520 (1080p).
- 20 Clips kosten also mindestens 4.680 Münzen.
- Der unbegrenzte Plan gilt hier nicht. VerseIn sagt das selbst in
  `billing_note`.
- Unter der Vorgabe „keine Münzen“ kann kein Worker einen Clip erzeugen.

## 2. Die Vorgaben, nach denen gearbeitet wurde

Die Nachbesserungen stehen nicht im Repo, sondern an der Aufgabe in brotool
(Projekt #15 „TikTok Ads für BrowegGames“, Phase „Stufe 1: 20 Figuren“,
Aufgabe 1 von 10). Wörtlich aus dem Auftragstext des Orchestrators:

- **Ursprünglicher Auftrag:** „20 Figuren entwerfen […] je Figur ein kurzer
  Steckbrief […] und ein Bild in bester Qualität […] Dazu ein Kontaktbogen
  aller 20. NICHT: keine Videos, keine Stimmen […]“
- **Nachbesserung 02.11.2026, 15:08 UTC:** „Neue Vorgabe von Tom (02.11.):
  KEINE Muenzen verbrauchen. Nur Seedance (unlimitiert) ueber den
  versein-MCP; kein Nano Banana Pro, keine weiteren Bilder gegen Muenzen
  […] ZU TUN: ein Vorstellungsvideo der 20 Figuren […]“
- **Nachbesserung 02.11.2026, 16:08 UTC:** „Entscheidung von Tom (02.11.,
  16:08): KEINE Muenzen ausgeben. Statt 20 Einzelbildern entsteht EIN
  Vorstellungsvideo der 20 Figuren, nur mit Seedance 2.5 (Toms unlimitierter
  Plan). Damit entfallen dein Weg A (570 Muenzen) und die Einzelbilder 2-20.
  […] Kostet ein Clip mehr als 0 Muenzen, erzeugst du NICHTS, schreibst den
  Preis samt Beleg (Werkzeugantwort) in die Fertigmeldung und meldest nicht
  fertig.“

**Den Widerspruch löst der Zweig nicht auf, und er kann es nicht.** Der
ursprüngliche Auftrag (Bilder, keine Videos) und die Entscheidung (Video,
keine Münzen) lassen sich beide nicht ohne Münzen erfüllen. Welche gilt und ob
Münzen freigegeben werden, entscheidet ein Mensch in brotool. Bis dahin ist
dieser Zweig ein **Teilstand**: Steckbriefe, Bild 1 und diese Belege.

**Nachtrag:** Die jüngere Anweisung aus dem Chat (Abschnitt 3: Bilder mit
kling.ai, keine Videos, keine VerseIn-Münzen) hat den Widerspruch inzwischen
entschieden, und zwar zugunsten von **Bildern**. Das Vorstellungsvideo ist
damit überholt. Offen bleibt nur, dass der Auftragstext in brotool noch
„versien.ai-MCP mit Seedance 2.5“ nennt.

## 3. Kling-Zugang (Anweisung aus dem Chat, 02.11.2026)

Geprüft am 02.11.2026 um 17:31 UTC auf `DESKTOP-VL852RM`. Kein einziger
Weg führt zu Kling:

| Weg | Befehl | Ergebnis |
|---|---|---|
| Werkzeuge der Sitzung | Werkzeugsuche nach `kling` | „No matching deferred tools found“ |
| MCP-Server, angemeldet | `claude mcp list` | nur `versein: https://mcp.versein.ai/mcp (HTTP) - ✔ Connected` |
| `~/.claude.json` | `mcpServers` oben und je Projekt | nur `versein`; die vier Treffer für „kling“ im Text sind Feature-Schalter `tengu_twinkling_*` (kein Zugang) |
| Dienste über den eigenen Server | `node …/worker/dienste.mjs liste` | „Kein Dienstzugang eingerichtet. Anlegen kann ihn ein Admin in brotool.“ |

Ein Guthaben bzw. Credits gibt es deshalb weder vorher noch nachher abzulesen.
Erzeugt wurde nichts, VerseIn-Münzen sind keine geflossen.
