# BroCooked — hektische Küche für 1 bis 4 Köche

Stand: 22. September 2026. Dieses Blatt ist die **Web-Fassung** einer
Spezifikation, die ursprünglich für ein Xcode-Projekt geschrieben war
(iOS 17, Swift, SpriteKit, MultipeerConnectivity). Übernommen sind Spielidee,
Stationen, Rezepte, Wertung und die Bau-Reihenfolge; ersetzt ist alles, was am
Gerät hing. Wer den Unterschied sucht, findet ihn in Abschnitt 1 und 3.

**Rechtlicher Rahmen, unverändert aus der Vorlage:** Spielmechaniken sind frei
nachbaubar. Grafiken, Figuren, Küchenlayouts, Musik oder Namen aus Overcooked
werden **nicht** übernommen. Das Wort „Overcooked-artig" gehört ins Briefing,
nicht in die Oberfläche.

---

## 1. Was aus der iOS-Vorlage wird

| Vorlage (iOS) | Hier (Web) | Warum |
| --- | --- | --- |
| Xcode-Projekt, Swift 6 | Paket `packages/game-brocooked` + `packages/client/src/minispiele/brocooked/` | Ein neues Spiel ist hier ein Paket, kein Eingriff in Server oder Client (CLAUDE.md, „Wie der Code gebaut ist") |
| SwiftUI für Menüs, SpriteKit für das Spiel | React für Lobby und Rahmen, **Canvas 2D** für die Küche | Wie Golf: React zeichnet nicht 60-mal je Sekunde |
| `UIInterfaceOrientationMask.landscape` | **Kein Zwang**, aber Querformat-Hinweis am Handy | Im Browser gibt es keine Sperre. Hochkant wird gespielt, nur enger: Die Kamera zeigt weniger Küche, der Hinweis „Gerät quer halten" steht einmal über dem Bild |
| 1334 × 750 Punkte, `aspectFill` | Sichtfeld in **Spieleinheiten** (1 Kachel = 64), Kamera rechnet auf die Leinwand | Eine feste Pixelgröße gibt es im Browser nicht |
| MultipeerConnectivity, Host autoritativ | **Plattform-Räume im Gleichschritt** (`docs/GOLF-PLAN.md`, Weg B) | Es gibt schon eine Lobby, Bots, Ausstiegsregeln und Trophäen. Ein zweiter Netzweg wäre eine zweite Wahrheit |
| 20 Snapshots je Sekunde vom Host | **Nur Eingaben** über die Leitung, jedes Gerät rechnet dieselbe Küche | Determinismus statt Zustandsfunk — dasselbe Verfahren wie Golf und Feldherr |
| CoreHaptics | `navigator.vibrate` wo vorhanden, sonst nichts | Kein Ersatz auf dem Rechner nötig |
| `AVAudioEngine`, `SKAction.playSoundFileNamed` | Töne nach `docs/KLANG.md` (MP3, vorgeladen) | Safari spielt kein Ogg |
| Profil als JSON im Documents-Verzeichnis | Sterne und Einstellungen im Browser (`localStorage`), Ergebnis einer Online-Partie über die Plattform | Der Browser hat kein Documents-Verzeichnis |

Was **gleich bleibt:** ein Koch trägt genau ein Ding; Teller mit Inhalt zählt
als ein Ding; Stationen, Rezepte, Tickets, Wertung, Sterne, Feuer.

---

## 2. Spielarten

| Art | Köche | Umsetzung |
| --- | --- | --- |
| Allein | 1 | Ein Koch. Der zweite Koch bleibt als Bot stehen, wenn das Level zwei verlangt |
| Geteilter Bildschirm | 2 | Ein Gerät: links Stick und Knöpfe für Koch 1, rechts für Koch 2. Am Rechner WASD + Leertaste/E gegen Pfeiltasten + Block-Tasten |
| Am Tisch | 2–4 | Ein Gerät je Koch, über die Plattform-Lobby. Freie Plätze füllt ein Bot |

„Am Tisch" ist der Ersatz für Local Party. Es läuft über das Internet, nicht
über Bluetooth — dafür ohne zweite Lobby, ohne Kopplungscode und mit den
Bots, Trophäen und Ausstiegsregeln, die die Plattform schon hat.

---

## 3. Netz: Gleichschritt statt Schnappschüsse

Der Server rechnet die Küche **nicht**. Das Modul `packages/game-brocooked`
verwahrt nur, was alle Geräte brauchen, um zur selben Partie zu kommen:
Saatkorn, Regelsatz, Levelkennung, Bot-Sitze, die **Eingabeliste** und die
Ergebnismeldungen. Gerechnet wird auf den Geräten
(`packages/client/src/minispiele/brocooked/kueche.ts`).

- **Takt:** 50 ms (20 Takte je Sekunde). Gezeichnet wird mit
  `requestAnimationFrame`; zwischen zwei Takten wird für das Auge
  zwischengeblendet, gerechnet nie.
- **Über die Leitung geht nur Eingabe:** `{ takt, nr, art, ... }` mit
  `art: 'richtung' | 'greifen' | 'werken'`. Richtungen sind auf vier
  Nachkommastellen gerundete Einheitsvektoren, „werken" hat Anfang und Ende.
  Mehr braucht niemand: Wer wann was hält, ergibt die Küche von selbst.
- **Zurückspulen wie bei Golf:** Trifft eine Eingabe mit einem Takt in der
  Vergangenheit ein, springt das Gerät auf den letzten Schnappschuss davor,
  wendet alle Ereignisse in kanonischer Reihenfolge (Takt, Sitz, Laufnummer)
  neu an und rechnet bis zur Gegenwart vor. Ein Schnappschuss der Küche
  (vier Köche, bis zu 40 Stationen, bis zu 5 Tickets) wiegt wenige Kilobyte.
- **Determinismus:** In der Simulation nur `+ - * /` und `Math.sqrt`; kein
  `sin`, `cos`, `atan2`, `pow`, `hypot` (letzte Stelle weicht zwischen Safari
  und V8 ab). Zufall ausschließlich aus mulberry32 mit dem Saatkorn — das
  betrifft nur, **welches** Ticket als Nächstes kommt. Deko-Zufall (Dampf,
  Funken) läuft getrennt und ungeseedet.
- **Plattform-Eigenheiten** wie bei Golf: `currentActor` ist immer `null`,
  `legalActions` ist leer (die Knöpfe entstehen aus der Küche auf dem Gerät,
  nicht aus einer Liste vom Server), und `interludeMs` liefert eine
  Stillstandsgrenze, damit ein toter Tisch nicht ewig offen bleibt.

---

## 4. Steuerung

- **Berührung:** Joystick erscheint dort, wo der Daumen aufsetzt (linke
  Hälfte, bei geteiltem Bildschirm je Hälfte einer). Knopf **A** (tippen):
  aufheben, ablegen, servieren, in die Station legen. Knopf **B** (halten):
  arbeiten — schneiden, spülen, löschen; ein Fortschrittsring über dem Kopf.
- **Tastatur:** WASD oder Pfeiltasten laufen, **Leertaste** ist A, **E** (bzw.
  **Strg rechts**) ist B. Bei geteiltem Bildschirm: Koch 1 WASD + Leertaste +
  Q, Koch 2 Pfeiltasten + Enter + Block-0.
- **Spurt** (Doppeltippen auf den Stick, Doppeltipp auf die Laufrichtung):
  kurzer Schub, 1,5 s Sperre danach.
- **Eine Hand, ein Ding.** Ein Koch trägt genau ein Ding. Ein Teller mit
  Inhalt ist ein Ding.
- **Rütteln** (`navigator.vibrate`) beim Aufheben, je Schneid-Takt, beim
  Servieren und bei Feuer — nur, wenn der Browser es kann.

---

## 5. Kernschleife

Tickets laufen oben ein: alle 8–12 s eines, höchstens fünf gleichzeitig,
Lebensdauer 45–60 s, Balken läuft ab. Jedes Ticket zeigt sein Rezept als
Kette von Symbolen.

Ablauf je Zutat: **holen → verarbeiten → garen → anrichten → servieren →
Teller zurück → spülen.**

**Stationen**

| Station | Was sie tut |
| --- | --- |
| Kiste | Liefert unbegrenzt eine Zutatenart |
| Schneidebrett | B halten, 2 s → geschnitten |
| Topf / Pfanne / Fritteuse | 6 s → gar; weitere 6 s → verkohlt → Feuer |
| Ablage | Legt ab, nichts weiter |
| Tellerstapel / Rückgabe / Spüle | B halten, 3 s → sauberer Teller |
| Durchreiche | Prüft gegen die Tickets, nimmt nur Passendes |
| Tonne | Vernichtet ein Ding |
| Feuerlöscher | Löscht Feuer; ungelöscht springt es alle 8 s auf ein Nachbarfeld |

**Wertung:** +20 je richtigem Gericht, +5 Trinkgeld in der ersten Hälfte der
Ticketzeit, Kombo ×1,25 ab drei und ×1,5 ab fünf Gerichten in Folge, −10 für
ein abgelaufenes Ticket, Kombo-Reset bei jedem Fehler. Eine Runde dauert
2–4 Minuten, danach Sterne (1/2/3) nach den Schwellen des Levels.

---

## 6. Datenmodell

Aus Swift wird TypeScript, aus `enum` werden Zeichenketten-Vereinigungen. Die
Namen sind deutsch (CLAUDE.md, Regel 2).

```ts
export type Zutat = 'tomate' | 'zwiebel' | 'salat' | 'fleisch' | 'fisch'
                  | 'reis' | 'teig' | 'kaese' | 'kartoffel';

export type Zustand = 'roh' | 'geschnitten' | 'gart' | 'gar' | 'verkohlt';

export type Tragbar =
  | { art: 'zutat'; zutat: Zutat; zustand: Zustand }
  | { art: 'teller'; inhalt: readonly Zutat[]; sauber: boolean }
  | { art: 'topf'; inhalt: readonly Zutat[]; zustand: Zustand };

export interface Rezept {
  readonly id: string;              // 'burger', 'sushi', 'suppe'
  readonly name: string;            // Anzeigename, deutsch
  readonly braucht: readonly { zutat: Zutat; zustand: Zustand }[];
  readonly station: StationsArt | null;
  readonly punkte: number;
  readonly frist: number;           // Takte, nicht Sekunden
}

export interface Ticket { readonly id: number; readonly rezept: string; readonly seitTakt: number; }
```

**Zeiten sind Takte, keine Sekunden.** Eine Sekunde ist eine Wanduhr, und die
geht auf zwei Geräten verschieden. 45 s sind 900 Takte.

**Level sind Daten, kein Code:** JSON mit einem Gitter aus Zeichen
(`.` Boden, `#` Wand, Buchstaben für Stationen), der Liste erlaubter Rezepte,
der Rundenzeit und den Sternschwellen. Ein Lader baut daraus die Küche — neue
Level brauchen keine Codeänderung. Sie liegen wie Golfs Bahnen unter
`packages/client/src/minispiele/brocooked/kuechen/`.

---

## 7. Level und Gimmicks

Sechs bis zehn Runden, ansteigend: (1) einfache Küche, nur Salat.
(2) Schneidebrett und Suppe. (3) Förderbänder. (4) Küche in zwei Hälften, Dinge
müssen über die Theke gereicht werden. (5) bewegliche Bodenplatten. (6) Feuer
bei knapper Zeit. Die Auswahl zeigt die Runden mit ihren Sternen.

---

## 8. Bildschirme

Lobby (Plattform) → Rundenwahl → „3 – 2 – 1 – los" → Küche → Pause →
Ergebnis mit Sternen, Punkten und „noch einmal".

Anzeige: Tickets oben links nebeneinander, Restzeit oben Mitte, Punkte und
Kombo oben rechts, Steuerung unten links und rechts, unter jedem Koch ein Ring
in seiner Farbe.

---

## 9. Bau-Reihenfolge

Jeder Schritt läuft für sich:

1. Paket und Gerüst: Modul, Kachelgitter, leere Küche auf der Leinwand.
2. Ein Koch: Joystick, Tastatur, Laufen, Stöße gegen Wände und Theken.
3. Dinge: Aufheben und Ablegen an Ablage und Kiste.
4. Verarbeiten: Schneidebrett und Topf mit Takten und Zustandswechsel.
5. Teller, Durchreiche, ein einziges Rezept.
6. Tickets, Wertung, Rundenzeit, Ergebnis.
7. Zweiter Koch am selben Gerät.
8. Gleichschritt: Eingaben über die Plattform, Zurückspulen, Bots.
9. Restliche Rezepte, Level-JSONs, Gimmicks, Feuer.
10. Töne, Rütteln, Feinschliff.

---

## 10. Grafik

Zuerst gezeichnete Flächen und Symbole auf der Leinwand — spielbar, ohne auf
Bilder zu warten. Die Bestellung der echten Bilder steht in
`docs/ASSETS-BROCOOKED.md` (Maße, Freihalte-Zonen, Abnahme, und was **nicht**
ins Bild gehört). Bis die Lieferung da ist, kommt kein `<img>` auf eine Datei,
die es nicht gibt (CLAUDE.md, „Was regelmäßig Zeit kostet").
