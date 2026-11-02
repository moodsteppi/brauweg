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

**Die Anweisung im Wortlaut.** Sie kam als Nachbesserung des Orchestrators mit
dem Vermerk „Neue Anweisung aus dem Chat (02.11.)“. Zitiert ist sie aus dem
Auftragstext dieses Laufs, ungekürzt:

> Neue Anweisung aus dem Chat (02.11.): Die Bilder entstehen mit kling.ai statt
> VerseIn. Kling soll auf diesem Rechner ebenfalls angebunden sein. SCHRITT 1,
> PFLICHT: Pruefe, ob ein Kling-Zugang da ist (MCP in ~/.claude.json oder
> Werkzeuge mcp__kling*/aehnlich, sonst dienste.mjs liste). Nenne den Namen des
> Zugangs und das Guthaben bzw. die Credits VORHER. Ist kein Kling-Zugang da,
> erzeugst du nichts und meldest genau das mit Beleg. SCHRITT 2: Frag den Preis
> fuer EIN Bild ab (2:3 hochkant, beste Qualitaet). Kostet ein Bild Credits oder
> Geld, das NICHT durch ein Abo abgedeckt ist, erzeugst du NICHTS und meldest
> den Preis je Bild und fuer 19 Bilder plus Kontaktbogen, mit Beleg; wir
> entscheiden dann. SCHRITT 3, nur wenn es nichts extra kostet: Bilder 2 bis 20
> aus den Prompts in figuren.md erzeugen, mit Stilblock und Negativ-Prompt, auf
> den Karten nur Herz- und Pik-Symbole, keine Buchstaben. Fuer Nr. 2 bis 5
> nimmst du Bild 1 (Pelle) als Referenz. Bild 1 neu mit Kling erzeugen, falls
> die VerseIn-Fassung wegen Wasserzeichen nicht taugt. Jedes Bild selbst
> ansehen: Buchstaben, Text, Wasserzeichen, Naehe zu bekannten Figuren.
> Kontaktbogen 5x4 mit sharp. Ablage ausserhalb des Repos; nenne die lokalen
> Pfade. Versuche den Upload ins Creative bb5cd6da-9b44-47c2-902b-3c8bf71f1a63
> mit 'creative datei hochladen'; nimmt es keine Bilder, nur die Pfade nennen.
> NICHT: keine VerseIn-Muenzen, keine Videos, keine Medien ins Repo.
> FERTIGMELDUNG: Kling-Zugang, Credits vorher und nachher, Kling-Kennung je
> Bild, Pfade bzw. Asset-Kennungen, eigene Sichtbefunde je Bild, README
> nachgezogen.

Wer die Anweisung im Chat gegeben hat, steht nicht im Text. Belegen lässt sie
sich nur über die Nachbesserungsliste an der Aufgabe in brotool, so wie die
übrigen Vorgaben in Abschnitt 2. **Der Abnehmer sollte sie bestätigen** und den
Auftragstext daran angleichen.

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

Nachgeprüft am 02.11.2026 um 17:39 UTC, unverändert: `claude mcp list` zeigt
nur `versein`, `dienste.mjs liste` meldet „Kein Dienstzugang eingerichtet.
Anlegen kann ihn ein Admin in brotool.“
