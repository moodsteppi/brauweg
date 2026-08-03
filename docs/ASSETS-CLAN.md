# Bildbestellung: Clan

Der Clan-Tab wird von einer Attrappe zur echten Halle: gründen, suchen,
beitreten, Mitglieder verwalten. Dafür fehlen zehn Bilder. Alles andere
(Namen, Zahlen, Rollen, Knöpfe) setzt die App darüber.

Vorhandenes wird weiterverwendet und muss **nicht** neu gemalt werden:
`bg-clan.png` (die Halle mit Kamin) trägt weiter den Clan-Tab, `schild.png`
bleibt die Überschrift, `tafel.png` bleibt der Rahmen für Listenzeilen.

---

## Für alle Bilder verbindlich

**Format**
- PNG, **1024 × 1536** (Hochkant 2:3) für Hintergründe.
- Freigestellte Einzelteile: PNG mit **echtem Alphakanal**.
- Farbraum sRGB.

**Echte Transparenz — der häufigste Fehler**
Freigestellte Teile brauchen einen echten Alphakanal. **Kein Schachbrett-
Muster** und **keine weiße Fläche** als „Transparenz". Zur Probe: Das Bild
auf einen knallroten Grund legen — sichtbar wird nur, was sichtbar sein
soll, ohne hellen Saum. Das ist uns schon dreimal passiert.

**Was NICHT ins Bild gehört**
- **Keine Schrift.** Keine Namen, keine Zahlen, keine Buchstaben — auch
  nicht auf Wappen. Der Clanname steht daneben und ist frei wählbar.
- **Keine Bedienelemente**, keine Tab-Leiste, kein Handyrahmen.
- **Kein Alkohol**: keine Krüge, Fässer, Hopfen.
- **Keine Hakenkreuze, Runen oder militärischen Rangabzeichen.** Wappen
  sind Vereinswappen, keine Wehrabzeichen — Clans heißen bei uns nach
  Kegelclub, nicht nach Kaserne.

**Beschnitt**
Auf hohen Handys bleiben verlässlich nur die **mittleren 70 % der Breite**
sichtbar (15 % bis 85 %). Alles Wichtige gehört in diesen Streifen, die
volle Höhe bleibt sichtbar.

**Ton und Stil**
Wie `bg-clan.png`, `weltkarte.png` und `bg-spieltisch.png`: gemalt, warm,
satt, freundlich. Handyspiel, kein Fotorealismus, kein Comic-Umriss.

---

## 1 bis 8 — `wappen-1.png` bis `wappen-8.png` (freigestellt)

**Wozu:** Beim Gründen wählt man ein Wappen aus acht Vorlagen. Es steht
danach im Clan-Tab, in der Clanliste und neben dem Clannamen.
**Format:** PNG mit Alpha, **512 × 512**, Wappen mittig, gleiche Größe im
Bild — sie liegen später nebeneinander in einem Raster und dürfen nicht
unterschiedlich groß wirken.

**Vorbild:** Das vorhandene `clan-wappen.png` (blauer Schild, Goldrand,
Stern, kleiner Pinguin). Gleiche Machart, gleicher Goldrand, gleiche
Wölbung — **nur Farbe und Zeichen wechseln**. Es soll aussehen wie ein Satz
aus einer Hand, nicht wie acht Einzelstücke.

| Datei | Grundfarbe | Zeichen in der Mitte |
| --- | --- | --- |
| `wappen-1.png` | Blau | Stern |
| `wappen-2.png` | Rot | Herz |
| `wappen-3.png` | Grün | Eichenblatt |
| `wappen-4.png` | Violett | Krone |
| `wappen-5.png` | Orange | Flamme |
| `wappen-6.png` | Türkis | Anker |
| `wappen-7.png` | Dunkelgrau mit Silberrand | Hammer |
| `wappen-8.png` | Gold auf Dunkelrot | Hirschgeweih |

**Wichtig:** Der Pinguin aus dem vorhandenen Wappen **entfällt** bei diesen
acht. Er gehört zum Brauweg-Clan selbst; ein fremder Verein soll sein
eigenes Zeichen tragen. `clan-wappen.png` bleibt unverändert daneben
bestehen.

Die Zeichen bitte **flächig und einfach** halten. Ein Wappen wird auch
40 Pixel klein in einer Liste angezeigt — feine Verzierungen verschwinden
dort zu Matsch.

---

## 9 — `bg-clan-suche.png`

**Wo:** Die Liste aller Clans, in die man eintreten kann.
**Motiv:** Ein Gang oder Vorraum der Halle, an dessen Wänden viele
verschiedene Vereinsbanner hängen — jedes in einer anderen Farbe, alle
angedeutet und **ohne erkennbare Zeichen darauf** (die echten Wappen setzt
die App). Warmes Licht von oben, dunkles Holz. Der Eindruck soll sein:
Hier hängen viele Vereine aus, such dir einen.

**Zonen**
| Höhe | Was dort liegt | Anforderung |
| --- | --- | --- |
| 0–12 % | Kopfzeile mit Schild | ruhig, dunkel |
| 12–22 % | Suchfeld | ruhig, dunkel |
| 22–88 % | **Die Clanliste** | sehr ruhig, gleichmäßig dunkel — hier steht die meiste Schrift |
| 88–100 % | Rand | ruhig |

Die Banner also bitte **an die Ränder und nach oben**, nicht in die Mitte.

---

## 10 — `bg-clan-gruenden.png`

**Wo:** Der Bildschirm zum Gründen eines eigenen Clans.
**Motiv:** Dieselbe Halle wie `bg-clan.png`, aber **leer und erwartungs-
voll**: An der Wand hängt ein einzelnes, unbedrucktes Banner in gedecktem
Stoff, davor gedämpftes Licht. Kein Kamin im Vordergrund, keine Menschen.
Der Raum wartet darauf, dass jemand einzieht.

**Zonen**
| Höhe | Was dort liegt | Anforderung |
| --- | --- | --- |
| 0–12 % | Kopfzeile mit Schild | ruhig, dunkel |
| 12–90 % | **Große Holztafel mit Name, Wappenwahl, Beitrittsart** | flächig, keine Muster, kein starker Verlauf |
| 90–100 % | Rand | ruhig |

---

## 11 bis 15 — Knopf-Icons (freigestellt)

**Wozu:** Die Knöpfe in der Clanhalle tragen keine Wörter mehr, sondern
Bilder. Fünf gleich große runde Knöpfe nebeneinander, darunter jeweils ein
kurzes Wort in der App-Schrift — das Wort setzt die App, **nicht das Bild.**

**Format:** PNG mit Alpha, **256 × 256**, Gegenstand mittig, gleicher
Randabstand bei allen fünf.

**Vorbild — bitte genau daran halten:** `truhe.png`, `pokal.png`,
`tab-clan.png`, `tab-shop.png`. Also gemalte, plastische Gegenstände mit
kräftigem Gold, Blau und Violett, weichem Licht von oben links, ohne
Comic-Umriss und ohne Schlagschatten auf den Boden. Sie liegen später in
einer Reihe nebeneinander — **gleiche Größe im Bild, gleiche Blickrichtung,
gleiche Lichtquelle**, sonst wirkt die Reihe unruhig.

| Datei | Gegenstand | Bedeutung |
| --- | --- | --- |
| `icon-chat.png` | Sprechblase aus Holz mit Goldrand, oder eine gerollte Nachricht mit Siegel | Clanchat |
| `icon-truhe.png` | Kleine Truhe, leicht geöffnet, Goldschimmer heraus | Clantruhe |
| `icon-krieg.png` | Zwei gekreuzte Turnierlanzen mit Wimpeln, oder Schild und Fahne | Clankrieg |
| `icon-anfragen.png` | Aufgeklappter Brief mit Siegel, oder ein Handschlag | Beitrittsanfragen |
| `icon-einstellungen.png` | Messingzahnrad mit Holzkern | Clan-Einstellungen |

**Bitte keine Waffen mit Klinge** bei `icon-krieg.png` — Turnier statt
Schlacht, das passt zum Ton und vermeidet Ärger bei der Altersfreigabe im
App Store.

**Wichtig:** Die Gegenstände werden auch **44 Pixel klein** angezeigt. Ein
Zahnrad mit zwölf feinen Zähnen wird dort zu Matsch — lieber sechs kräftige.

---

## 16 — `mitgliederband.png` (freigestellt, dehnbar)

**Wozu:** Die Mitgliederliste ist derzeit eine Reihe schmuckloser Zeilen.
Jede Zeile bekommt ein Band als Unterlage.
**Format:** PNG mit Alpha, **600 × 200**.
**Aufbau:** Ein waagerechtes Band aus dunklem Holz mit dünner Messingkante
oben und unten. Der Rahmen ist **exakt 40 Pixel** an allen vier Seiten, die
innere Fläche ist ruhig und gleichmäßig — sie wird in die Breite gedehnt.
Links darf eine angedeutete runde Einfassung sitzen, in der später das
Profilbild liegt; sie muss aber ohne Bild ebenfalls gut aussehen.

Wenn das zu aufwendig ist: Das vorhandene `tafel.png` tut es zur Not auch,
dann wirkt die Liste nur etwas schwerer.

---

## Ablage

Alles nach `packages/client/public/hub/` unter genau diesen Namen.

**Geliefert und eingebaut:** die acht Wappen, die fuenf Knopf-Icons und das
Mitgliederband. **Noch offen:** `bg-clan-suche.png` und
`bg-clan-gruenden.png` — dort laeuft weiter `bg-clan` als Platzhalter.



**Bitte in voller Auflösung liefern — ich verkleinere selbst.** Nicht
vorher herunterrechnen: Was einmal weich ist, wird nicht wieder scharf.

## Prüfung vor der Übergabe

1. Kein Text, keine Zahlen, keine Buchstaben — auch nicht auf den Wappen.
2. Die acht Wappen nebeneinandergelegt: gleiche Größe, gleiche Machart,
   erkennbar ein Satz.
3. Ein Wappen auf 40 Pixel verkleinert: Zeichen noch erkennbar?
4. Freigestellte Teile auf rotem Grund geprüft: echtes Alpha, kein
   Schachbrett, kein heller Saum.
5. Hintergründe genau 1024 × 1536, ruhige Zonen wirklich ruhig.
