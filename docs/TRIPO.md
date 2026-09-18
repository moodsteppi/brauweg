# Tripo 3D — der Weg von der Beschreibung zum Modell

Tripo ist **kein neues Werkzeug in diesem Repo**, sondern das, mit dem die
3D-Modelle hier ohnehin schon entstanden sind. Nachgezaehlt am 07.09.2026:
**alle 27 `.glb` unter `packages/client/public/3d/`** tragen in ihren
Materialnamen `tripo_node_<uuid>_material` — der Pinguin, die Truhe, die
Muetze, alle 18 Subway-Requisiten. Bisher lief das von Hand ueber die
Weboberflaeche. Neu ist nur, dass es jetzt von der Kommandozeile geht.

Das ist der Grund, warum diese Datei existiert: Nicht "koennen wir Tripo
benutzen" (wir tun es seit Monaten), sondern "wie kommt das, was es kann, an
die Stelle, an der Tafelrunde es braucht".

---

## 1. Wo der API-Schluessel hingehoert

**Nicht in einen Chat, nicht ins Repo, nicht in eine Commit-Nachricht.**
Das ist keine Vorsicht aus dem Bauch — es steht so in den ARBEITSREGELN
(Nr. 6, "Secrets"), und die Tripo-eigene Agentendoku sagt denselben Satz von
sich aus: *"never ask the human to paste a key into the chat"*.

Es gibt drei Wege. Der erste ist der bequemste, der dritte der richtige fuer
Server und CI.

### Weg A — Anmelden im Browser (empfohlen)

```bash
tripo login --region ov      # ov = international (Stripe), cn = China (Alipay)
```

Der Befehl druckt eine Adresse und einen Einmal-Code, oeffnet den Browser und
**wartet dann bis zu 15 Minuten** auf die Freigabe. Danach liegt der
Schluessel von selbst am richtigen Platz. Man bekommt den Schluessel dabei nie
zu Gesicht, und genau das ist der Vorteil: Was man nicht sieht, kann man nicht
versehentlich weiterreichen.

Wer noch kein Konto hat, legt es auf der Seite an — die Anmeldung bringt ein
Startguthaben mit.

### Weg B — Schluessel direkt uebergeben

Wenn der Schluessel schon vorliegt (`tsk_…`), aus der Konsole von
[developers.tripo3d.ai](https://developers.tripo3d.ai):

```bash
tripo login --key tsk_XXXXXXXX
```

Die Region erkennt der Befehl selbst. Der Schluessel landet in

```
C:\Users\tomti\.tripo\config.json        (Windows)
~/.tripo/config.json                     (macOS, Linux)
```

Diese Datei ist der **einzige Ort im Dateisystem, an dem der Schluessel stehen
soll**. Sie liegt ausserhalb des Repos, `packages/` sieht sie nie.

### Weg C — Umgebungsvariable (Server, CI, Agentenlauf)

```bash
export TRIPO_API_KEY=tsk_XXXXXXXX          # bash
$env:TRIPO_API_KEY = "tsk_XXXXXXXX"        # PowerShell
```

`TRIPO_API_KEY` **sticht die Konfigurationsdatei** und umgeht die Profile
komplett — nachgelesen in `dist/config/config.js` des Pakets:

> `Precedence for every setting: env var > directory context > global config.`
> `TRIPO_API_KEY bypasses profiles entirely — agent/CI setups never touch the profile machinery.`

Das ist der Weg fuer den Worker: Wer den Schluessel als Variable setzt, muss an
`~/.tripo/config.json` gar nicht ruehren.

### Nachsehen, ob es geklappt hat

```bash
tripo doctor      # prueft Schluessel, Netz, Region — sagt auch, WOHER der Schluessel kommt
tripo balance     # Guthaben
```

`doctor` nennt die Quelle ausdruecklich (`env:TRIPO_API_KEY` oder
`profile:default`). Das ist bei zwei Konten die Frage, an der man sonst
haengenbleibt.

---

## 2. Was Tripo fuer Tafelrunde kann — und was nicht

Tafelrunde ist der **einzige** Teil des Spiels, dessen Figuren nicht aus Tripo
kommen. Sie sind CC0-Modelle von KayKit, und das hat einen Grund: Die Arena
braucht nicht nur ein Modell, sondern ein **gerigtes** Modell mit **fuenf
benannten Bewegungen**. Die hat der Weg ueber die Weboberflaeche nicht
hergegeben.

Der CLI-Weg gibt sie her. `tripo anim rig` und `tripo anim retarget` sind genau
die Luecke, an der der KayKit-Umweg noetig war.

### Die fuenf Bewegungen gehen auf

`BEWEGUNGEN` in `packages/client/src/figuren3d/bildfolgen-rendern.mjs` verlangt
fuenf Clips. Die Rig-Fassung v2.5 (Vorgabe des CLI) kennt elf Vorlagen:
`idle walk run dive climb jump slash shoot hurt fall turn`. Sie decken alle
fuenf ab:

| Tafelrunde  | Tripo-Vorlage  | Anmerkung |
| ----------- | -------------- | --------- |
| `stand`     | `preset:idle`  | |
| `lauf`      | `preset:walk`  | |
| `schlag`    | `preset:slash` | Nahkampf; fuer den Schuetzen `preset:shoot` |
| `getroffen` | `preset:hurt`  | |
| `tod`       | `preset:fall`  | Die naechstliegende — eine eigene Todesvorlage gibt es nicht |

**Fuenf ist gleichzeitig die Obergrenze:** `retarget` nimmt hoechstens fuenf
Animationen je Auftrag und rechnet **je Animation** ab. Der Bedarf passt also
genau in einen Auftrag — aber ohne Luft.

`tod` → `preset:fall` ist die einzige Zuordnung, die nicht offensichtlich ist.
Ob ein Sturz als Tod durchgeht, entscheidet das Auge an der fertigen
Bildfolge, nicht diese Tabelle.

### Der Befehl

```bash
tripo make "a hooded forest healer with a wooden staff, T-pose" --for anim --json --yes \
  | tripo anim check --json \
  | tripo anim rig --spec mixamo --out-format glb --json \
  | tripo anim retarget --animation preset:idle preset:walk preset:slash \
                        preset:hurt preset:fall --animate-in-place --json
```

Zu den drei Schaltern, die nicht selbsterklaerend sind:

- `anim check` **vor** dem Riggen: Es prueft, ob die Figur ueberhaupt riggbar
  ist, und bricht die Kette ab, wenn nicht — **bevor** Guthaben fuer das Riggen
  draufgeht.
- `--animate-in-place` haelt die Figur an Ort und Stelle, statt sie
  weglaufen zu lassen. Der Renderer nimmt eine feste Kamera und schneidet die
  Zelle mittig zu; eine Figur, die aus dem Bild laeuft, ist dort unbrauchbar.
- `--spec mixamo` gibt ein Unity-Humanoid-Rig. Ob das noetig ist, entscheidet
  sich erst am ersten Modell — siehe die offenen Punkte unten.

### Was Tripo fuer die Arena NICHT ist

Die offene Karte zur Arena (`ef63931d`) will einen **gemalten Hintergrund**,
weil der Raum heute aus CSS gebaut ist. Tripo liefert Modelle, keine Malerei.

Der Umweg ginge: ein Arena-Modell erzeugen, es mit demselben Chromium rendern,
mit dem schon die Figurenblaetter entstehen, und das Ergebnis als WebP
ablegen. Das ist **machbar, aber nicht dasselbe** wie eine bestellte
Hintergrundmalerei nach `docs/ASSETS-*.md` — und es ist eine Entscheidung ueber
die Optik, nicht ueber die Technik. Sie gehoert Robin, nicht diesem Dokument.

---

## 3. Wie das Ergebnis ins Spiel kommt

Ein fertiges Tripo-Modell ist noch kein Blatt im Repo. Dazwischen steht der
Renderer:

```
tripo make → anim rig → anim retarget     ergibt   <rolle>.glb (gerigt, 5 Clips)
        ↓
bildfolgen-rendern.mjs                    ergibt   <rolle>.webp (Sprite-Sheet)
        ↓
packages/client/public/tafelrunde/figuren3d/
```

Die Naht liegt in der Tabelle `ROLLEN` (ab Zeile 229 in
`bildfolgen-rendern.mjs`). Dort steht je Rolle, welche KayKit-Figur genommen
wird und **wie die fuenf Clips in dieser Datei heissen**:

```js
animationen: {
  stand: 'Idle', lauf: 'Walking_A', schlag: '1H_Melee_Attack_Chop',
  getroffen: 'Hit_A', tod: 'Death_A',
}
```

Ein Tripo-Modell bringt **andere Clipnamen** mit. Wer eine Rolle umstellt,
aendert also nicht nur die Quelle, sondern diese Zuordnung — und `hole()` muss
die Datei lokal statt von GitHub nehmen. Beides sind kleine Eingriffe an einer
Stelle, die dafuer gebaut ist; keiner davon ist gemacht.

**Die Dateigroesse vorher ansehen** (CLAUDE.md, Regel 4). Was Tripo an Texturen
mitliefert, ist fuer ein Sprite-Sheet zu gross. Beim Rendern faellt das weg —
aber nur, solange niemand das rohe `.glb` nach `public/` legt.

---

## 4. Was offen ist

Drei Dinge, die dieses Dokument **nicht** beantwortet, weil sie sich ohne
Schluessel und ohne ein erstes Modell nicht beantworten lassen:

1. **Die Lizenz der erzeugten Modelle.** Das CLI-Paket selbst ist MIT — das
   sagt ueber die *Ergebnisse* nichts. Die Nutzungsbedingungen von Tripo liegen
   dem Paket nicht bei. Praktisch ist die Frage entschieden, denn alle 27
   vorhandenen Modelle stehen schon ausgeliefert im Spiel; sauber dokumentiert
   ist sie nicht. Die KayKit-Figuren tragen eine `LIZENZ.txt` neben den
   Bildern, die 27 Tripo-Modelle tragen nichts dergleichen.
2. **Die Kosten.** `retarget` rechnet je Animation ab, `rig` und `make`
   zusaetzlich. Was fuenf Rollen kosten, sagt erst `tripo usage` nach dem
   ersten Durchlauf.
3. **Ob die Figuren zusammenpassen.** Die fuenf heutigen Rollen kommen aus
   einer Hand und haben denselben Stil. Fuenf einzeln erzeugte Tripo-Figuren
   haben das nicht von selbst — sie stehen im selben Bild nebeneinander auf
   dem Brett. Das ist die eigentliche Frage, und sie entscheidet sich am
   `preview.png` des ersten Versuchs, nicht vorher.

---

## 5. Fehlerschluessel

Das CLI hat stabile Rueckgabewerte; ein Skript darf sich darauf verlassen:

| Code | Bedeutung | Was zu tun ist |
| ---- | --------- | -------------- |
| 0 | fertig | |
| 2 | falscher Aufruf | Parameter pruefen |
| 3 | Anmeldung | `tripo doctor` — nennt meist eine Region-Verwechslung |
| 4 | Guthaben leer | `tripo topup` (braucht einen Menschen) |
| 5 | Inhaltsregel | Beschreibung umformulieren |
| 6 | Auftrag gescheitert | Guthaben kommt von selbst zurueck |
| 7 | Netz | erneut versuchen |
| 8 | nicht gefunden | |
| 9 | zu viele Anfragen | mit wachsendem Abstand erneut |

`tripo make` **blockiert bis zum Ende** und laedt die Dateien selbst herunter.
Wer eine Auftragskennung im Protokoll sieht, ist noch nicht fertig — nicht
abbrechen, keine eigene Frist unter 15 Minuten setzen.
