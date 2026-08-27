# Bilder für Mememory

Nach CLAUDE.md Regel 5 gehört zu jeder Grafik eine Bestellung mit Maßen,
Freihalte-Zonen und Abnahmekriterien. Diese Lieferung wurde **nicht bestellt,
sondern auf diesem Rechner erzeugt** — mit der lokalen SDXL-Installation unter
`D:\AI\ComfyUI` (Werkzeug `D:\AI\tools\txt2img.py`). Die Bestellung steht
trotzdem hier: Sie ist die Prüfliste, gegen die abgenommen wurde, und die
Vorlage, falls jemand Motive nachliefert.

---

## 1 — Was geliefert wurde

| Was | Ordner | Anzahl | Maß | Format | Gewicht |
| --- | --- | --- | --- | --- | --- |
| Motive | `public/mememory/motive/` | 88 | 256 × 256 | WebP q78 | 2,3–17,9 kB · **804 kB gesamt** |
| Tischdecken | `public/mememory/` | 5 | 640 × 936 | WebP q70 | 19–27 kB · **109 kB gesamt** |
| Kartenrückseite (HUD-Stapel) | `public/mememory/karte-ruecken.webp` | 1 | 78 × 108 | WebP q92 | 3,4 kB · *gerechnet, siehe 6* |
| Banner Spielauswahl | `public/hub/spielwahl-mememory.webp` | 1 | 1200 × 300 | WebP q80 | 30 kB |

**Seit dem 23. August sind 13 der 43 Motive nicht mehr selbst erzeugt.**
Der Nutzer hat seine dreizehn Vorlagen ausdrücklich im Deck haben wollen;
sie ersetzen jeweils meine KI-Fassung desselben Motivs. Nebeneinander ging
es nicht — mein Apfel mit Augen und der echte Apfel mit Augen sind auf
80 px nicht auseinanderzuhalten (Abnahmekriterium 4). **Was daran offen
ist, steht unten unter „Herkunft“.**

Originale (PNG, 1024 × 1024 bzw. 832 × 1216) liegen unter
`packages/client/art/mememory/` und sind über `.gitignore` aus dem Repo
gehalten — so will es Regel 4. **Sie sind noch NICHT im Archivrepo
`moodsteppi/brauweg-art`**, weil das auf diesem Rechner nicht ausgecheckt ist;
siehe `docs/MEMEMORY-TICKETS.md`, T-04.

---

## 2 — Maße, und warum genau diese

**256 × 256 für ein Motiv.** Auf einem 375 px breiten Handy sind vier Spalten
mit Abstand 80 CSS-Pixel breit. Bei dreifacher Pixeldichte sind das 240 echte
Pixel; 256 ist die nächste sinnvolle Größe. Vorher standen hier 224 — passend
zu den fünf Spalten, die das Brett bis zum 22. August hatte.

**Quadratisch.** Das Brett trägt ein Seitenverhältnis aus Spalten und Zeilen
(4/6), damit die Zellen fast genau quadratisch werden — gemessen 80 × 79 px.
Vom quadratischen Motiv fällt dadurch kaum noch etwas weg. Die Karte schneidet
mit `object-fit: cover` nach, das Motiv muss also die Mitte tragen.

**Ein Match lädt 12 Motive**, nicht 88: rund **110 kB**. Zusammen mit einer
Tischdecke ist das Spiel damit unter 125 kB spielbereit — trotz größerer
Bilder weniger als vorher. Das ist die Zahl,
an der die Forderung „keine langen Ladephasen" hängt. **Seit dem 27. August
gibt es fünf Decken statt drei** (weiß plus vier Spielerfarben); ein Tisch
hängt aber nur die ins Blatt, deren Farbe an ihm sitzt — zu zweit sind das
weiterhin drei.

**640 × 936 für die Tischdecke.** Sie liegt hinter vierundzwanzig Karten und
ist zum guten Teil verdeckt. Mehr Auflösung landet unter den Karten.

---

## 3 — Abnahmekriterien für ein Motiv

1. **Ein Ding, mittig.** Auf 80 px ist ein Haufen ein Farbfleck, und zwei
   Farbflecken sind im Memory nicht auseinanderzuhalten. Vier Motive sind bei
   der ersten Runde genau daran gescheitert (Apfel, Heul-Emoji, Schere,
   Strichtier — alle wurden zu Wimmelbildern) und wurden nachgezogen.
2. **Kein eingebrannter Text.** Steht im Negativprompt und wird beim Sichten
   geprüft. Einer der drei Fehler aus CLAUDE.md Regel 5.
3. **Heller, ruhiger Hintergrund.** Dunkle Motive verschwinden auf der dunklen
   Tischdecke.
4. **Unverwechselbar gegen die anderen 87.** Zwei ähnliche Motive machen das
   Spiel nicht schwerer, sondern unfair — man kann ein Paar dann nicht mehr
   sicher wiedererkennen. Lama und Alpaka sind der engste Fall im Katalog und
   wurden bewusst behalten (weiß mit Mähne gegen braun und zottelig).
   `dinohund` fiel beim ersten Zug durch: Der Dinosaurier fehlte, übrig blieb
   ein Hund mit großen Augen — also `hundschock` zum Verwechseln ähnlich.
   Nachgezogen mit dem Dinosaurier VORNE im Prompt; SDXL malt zuverlässig
   das, was zuerst genannt wird.
5. **Kein Alphakanal.** Die Karte ist immer voll gefüllt; Transparenz gäbe es
   hier nichts zu tun, und Schachbrett statt Alpha ist laut STAND.md dreimal
   passiert.

## 4 — Abnahmekriterien für die Tischdecke

1. **Die Spielerfarben müssen deckungsgleich sein.** Sie werden beim
   Zugwechsel ineinander geblendet; ein anderer Faltenwurf wäre ein
   Bildsprung. **Deshalb ist es EINE Aufnahme:** Aus einem geänderten
   Farbwort macht SDXL auch bei gleichem Startwert ein anderes Bild (geprüft
   — die weiße Decke hing diagonal, die blaue lag mittig). Geliefert wurde
   die **blaue** Aufnahme; Rot, Gelb und Grün entstehen daraus durch
   Farbdrehung, und zwar nur auf dem Stoff. Der Holztisch am Rand bleibt Holz.

   **Weiß ist die Ausnahme und war es von Anfang an.** Nachgemessen am
   27. August: Die Helligkeitsverläufe von Blau und Rot decken sich zu 0,83,
   die von Blau und Weiß nur zu 0,39 — die weiße Decke ist eine eigene
   Aufnahme mit anderem Faltenwurf. Sie liegt nur am Partieende, wenn
   niemand mehr am Zug ist; dort blendet nichts mehr über. Für die vier
   Spielerfarben gilt die Regel weiterhin ohne Ausnahme.
2. **Die Maske trennt Stoff von Holz.** Stoff ist bläulich und farbig
   (Farbton 0,50–0,78, Sättigung > 0,15), Holz ist orange. Die Maske wird
   weich gezeichnet, sonst zieht der Farbwechsel einen harten Saum. Gemessen:
   47,5 % der Fläche sind Stoff — das passt zum Bild.
3. **Die Mitte bleibt ruhig.** Dort liegen die Karten.
4. **Matte Töne, keine Signalfarben.** Ein reines Gelb neben einem reinen
   Grün wäre hinter 24 Karten Lärm — und die Kartenrückseite ist selbst
   dunkelbraun mit Gold. Gelb muss dabei heller ausfallen als die anderen,
   sonst wird daraus Braun.

### Das Rezept

Es steht als `decke-faerben.py` neben den Originalen (also außerhalb des
Repos, `packages/client/art/` ist ignoriert). Was es tut, in Zahlen:
Zielfarbton setzen, die Abweichung jedes Pixels davon zur Hälfte behalten
(sonst ist die Decke eine Fläche statt eines Stoffs), Sättigung und
Helligkeit mit einem Faktor nachziehen, weiche Maske darüber.

| Farbe | Farbton | × Sättigung | × Helligkeit | Datei |
| --- | --- | --- | --- | --- |
| Blau | *Vorlage* (0,627) | — | — | 19 kB |
| Rot | 0,960 | 1,19 | 1,17 | 20 kB *(Bestand, nicht neu erzeugt)* |
| Gelb | 0,115 | 1,05 | 1,15 | 27 kB |
| Grün | 0,300 | 0,68 | 0,98 | 24 kB |

**Rot wird vom Skript nur nachgebaut, nicht ausgeliefert.** Die rote Decke
liegt seit dem 23. August im Bündel; sie noch einmal zu erzeugen hieße, das
Aussehen eines fertigen Spiels nebenbei zu ändern. Sie steht im Skript als
Prüfung: Trifft das Rezept die vorhandene rote Decke, trifft es Gelb und
Grün auch.

**Geladen wird nur, was der Tisch braucht.** Fünf Decken sind 109 kB; ein
Tisch zu zweit hängt aber nur drei davon ins Blatt (weiß plus die zwei
Spielerfarben) und bleibt damit bei den 57 kB von vorher. Die Liste steht in
`Mememory.tsx` als `decken`.

## 5 — Was NICHT ins Bild gehört

- Text, Wasserzeichen, Signaturen, Bildunterschriften
- Rahmen, Ränder, Collagen, Bildraster
- Menschen und Hände (bei den Decken auch Geschirr, Besteck, Essen)
- mehrere gleichartige Objekte

---

## 6 — Kartenrückseite: am Brett CSS, im HUD ein Bild

Am Brett ist die Rückseite **CSS**, kein Asset: warmes Dunkelbraun mit Goldrahmen,
feinem Diagonalmuster, einem Ring und dem Monogramm „M" (`.mm-rueck` in
`styles.css`). Gründe:

- Sie erscheint **vierzig Mal gleichzeitig** auf demselben Schirm. Als Bild
  wäre sie eine Datei mehr im Ladepfad für null zusätzliche Information.
- Sie muss auf jeder Kartengröße scharf sein. CSS und Schrift skalieren, ein
  224er WebP nicht.
- Ein Goldrahmen mit Alphakanal ist genau der Fall, bei dem hier schon dreimal
  ein Schachbrett statt Transparenz ausgeliefert wurde.

**Seit dem 27. August 2026 gibt es sie zusätzlich als Bild** —
`public/mememory/karte-ruecken.webp`, 78 × 108, 3,4 kB. Nicht für das Brett:
Dort bleibt es beim CSS, und alle drei Gründe oben gelten dort weiter. Das Bild
ist für den **Kartenstapel im Ecken-HUD**, wo jeder Spieler eine Karte je Punkt
bekommt. Warum dort umgekehrt entschieden:

- Es sind bis zu **zwanzig** Karten je Spieler, also achtzig auf dem Schirm.
  Als CSS wäre jede davon fünf gestapelte Schichten (Verlauf, Streifen, drei
  Ringe, Kreis, Monogramm) — vierhundert Zeichenebenen in vier Ecken, die sich
  bei jedem Punkt neu aufbauen. Als Bild ist jede eine Ebene.
- Sie ist dort **immer 16 px breit**. Das Argument „muss auf jeder Kartengröße
  scharf sein“ trifft die Brettkarte, nicht diese.
- Kein Alphakanal an den Kanten: Die runden Ecken sind ins Bild gestanzt, der
  Rest ist voll gefüllt.

**Das Bild wird nicht bestellt, sondern gerechnet.** `scripts/mememory-karte-zeichnen.py`
malt es aus denselben Zahlen, die in `styles.css` stehen — Verlauf, Streifenwinkel,
Ringstärken, Goldtöne. Wer die Rückseite am Brett ändert, lässt das Skript
noch einmal laufen; sonst liegen im selben Bildschirm zwei verschiedene Karten.
Das Skript liegt unter `scripts/` und nicht unter `packages/client/art/`, weil
dieser Ordner in `.gitignore` steht — ein Erzeuger ist Quelltext, kein Original.

---

## 7 — Herkunft

Der Katalog hat **88 Motive** aus drei Quellen. Die Spalte gab es im Repo
bisher nicht (`docs/KLANG.md` fuehrt sie fuer Toene, fuer Bilder fehlte sie —
`docs/MEMEMORY-TICKETS.md`, T-22). Hier ist sie.

| Quelle | Anzahl | Lizenzlage |
| --- | --- | --- |
| Selbst erzeugt (lokale SDXL) | 40 | unbedenklich |
| Wikimedia Commons | 35 | **frei lizenziert, Namensnennung siehe Tabelle** |
| Vorlagen des Nutzers | 13 | **ungeklaert — siehe 7.1** |

### 7.1 — Die 13 Vorlagen des Nutzers: ungeklaert

`apfel`, `kartoffel`, `greis`, `heulemoji`, `denkemoji`, `hamster`,
`waschbaer`, `schere`, `strichtier`, `zerrgesicht`, `spritzglas`,
`katzenfilter`, `dinohund` sind fremde Bilder aus dem Netz, vom Nutzer
mitgeschickt und auf seine ausdrueckliche Anweisung eingebaut. Offen bleibt:

1. **Urheberrecht.** Mindestens `dinohund` ist ein Filmstandbild
   (Spinosaurus aus *Jurassic Park III*). Bei den uebrigen ist die Quelle
   unbekannt.
2. **Recht am eigenen Bild.** `greis`, `zerrgesicht` und `katzenfilter`
   zeigen **erkennbare Personen** (§ 22 KUG verlangt fuer die Verbreitung
   grundsaetzlich deren Einwilligung). Der gewichtigste Punkt.
3. **Eine Attribution wurde entfernt.** `zerrgesicht` trug die Handles
   `@max_jaou` / `@czroc`; der Zuschnitt schneidet sie weg.

Originale unter `packages/client/art/mememory/vorlagen/`.

### 7.2 — Die 35 aus Wikimedia Commons: frei, aber mit Pflicht

Geholt ueber die Commons-API, gefiltert auf **CC0, Public Domain, CC BY und
CC BY-SA**. Alles andere wurde verworfen — der Filter steht im Skript
`commons_holen.py`, nicht im Kopf.

**CC BY und CC BY-SA verlangen eine Namensnennung.** Diese Tabelle IST die
Namensnennung. Wer ein Motiv entfernt, streicht die Zeile; wer eines
hinzufuegt, ergaenzt sie. Sie darf nicht verlorengehen.

| Kennung | Datei auf Commons | Lizenz | Urheber |
| --- | --- | --- | --- |
| `avocado` | [Persea americana fruit 2.JPG](https://commons.wikimedia.org/wiki/File:Persea_americana_fruit_2.JPG) | CC BY-SA 3.0 | B.navez |
| `burger` | [NCI Visuals Food Hamburger.jpg](https://commons.wikimedia.org/wiki/File:NCI_Visuals_Food_Hamburger.jpg) | Public domain | Len Rizzi (photographer) |
| `chamaeleon` | [Panther chameleon (Furcifer pardalis) male Nosy Be.jpg](https://commons.wikimedia.org/wiki/File:Panther_chameleon_(Furcifer_pardalis)_male_Nosy_Be.jpg) | CC BY-SA 4.0 | Charles J. Sharp |
| `donut` | [Golden Donut Sugar Coated Doughnut (15533318029).jpg](https://commons.wikimedia.org/wiki/File:Golden_Donut_Sugar_Coated_Doughnut_(15533318029).jpg) | CC BY-SA 2.0 | Willis Lam |
| `erdmaennchen` | [Standing meerkat looking behind.jpg](https://commons.wikimedia.org/wiki/File:Standing_meerkat_looking_behind.jpg) | CC BY-SA 4.0 | Basile Morin |
| `fledermaus` | [Unidentified newborn bat.jpg](https://commons.wikimedia.org/wiki/File:Unidentified_newborn_bat.jpg) | CC BY-SA 4.0 | Anton |
| `fliegenpilz` | [Fly Agaric mushroom 3.jpg](https://commons.wikimedia.org/wiki/File:Fly_Agaric_mushroom_3.jpg) | CC BY 2.5 | Tony Wills |
| `fuchs` | [Alaska Red Fox (Vulpes vulpes).jpg](https://commons.wikimedia.org/wiki/File:Alaska_Red_Fox_(Vulpes_vulpes).jpg) | CC BY-SA 2.0 | Gregory "Slobirdr" Smith |
| `giraffe` | [Giraffe head close up.jpg](https://commons.wikimedia.org/wiki/File:Giraffe_head_close_up.jpg) | Public domain | Stansell Kenneth, U.S. Fish and Wildlife Service |
| `gluehbirne` | [Gluehlampe 01 KMJ.jpg](https://commons.wikimedia.org/wiki/File:Gluehlampe_01_KMJ.jpg) | CC BY-SA 3.0 | KMJ |
| `gottesanbeterin` | [Praying mantis india.jpg](https://commons.wikimedia.org/wiki/File:Praying_mantis_india.jpg) | CC BY-SA 2.0 | Shiva shankar |
| `igel` | [Erinaceus roumanicus 2020 G2.jpg](https://commons.wikimedia.org/wiki/File:Erinaceus_roumanicus_2020_G2.jpg) | Public domain | George Chernilevsky |
| `kaenguru` | [Forester kangaroo (Macropus giganteus tasmaniensis) juvenile hopping Esk Valley.jpg](https://commons.wikimedia.org/wiki/File:Forester_kangaroo_(Macropus_giganteus_tasmaniensis)_juvenile_hopping_Esk_Valley.jpg) | CC BY-SA 4.0 | Charles J. Sharp |
| `kaktusbluete` | [Echinopsis unidentified.jpg](https://commons.wikimedia.org/wiki/File:Echinopsis_unidentified.jpg) | CC BY-SA 3.0 | Tomas Castelazo |
| `kamel` | [07. Camel Profile, near Silverton, NSW, 07.07.2007.jpg](https://commons.wikimedia.org/wiki/File:07._Camel_Profile,_near_Silverton,_NSW,_07.07.2007.jpg) | CC BY-SA 3.0 | Jjron |
| `koala` | [Australia Cairns Koala.jpg](https://commons.wikimedia.org/wiki/File:Australia_Cairns_Koala.jpg) | CC BY-SA 1.0 | Guillaume Blanchard at French Wikipedia |
| `krake` | [Octopus vulgaris Merculiano.jpg](https://commons.wikimedia.org/wiki/File:Octopus_vulgaris_Merculiano.jpg) | Public domain | Comingio Merculiano (1845-1915) in Jatta Giuseppe (1860-1903) |
| `libelle` | [Dragonfly macro.jpg](https://commons.wikimedia.org/wiki/File:Dragonfly_macro.jpg) | CC BY-SA 3.0 | Daniel Schwen |
| `lolli` | [Lollipop in the package.jpg](https://commons.wikimedia.org/wiki/File:Lollipop_in_the_package.jpg) | CC BY-SA 2.5 | - |
| `melone` | [Taiwan 2009 Tainan City Organic Farm Watermelon FRD 7962.jpg](https://commons.wikimedia.org/wiki/File:Taiwan_2009_Tainan_City_Organic_Farm_Watermelon_FRD_7962.jpg) | CC BY-SA 3.0 | Fred Hsu (Wikipedia:User:Fred Hsu on en.wikipedia) |
| `panda` | [Panda eating Bamboo leaves.jpg](https://commons.wikimedia.org/wiki/File:Panda_eating_Bamboo_leaves.jpg) | CC BY 4.0 | MspreilsCN |
| `papageitaucher` | [Puffin Latrabjarg Iceland.jpg](https://commons.wikimedia.org/wiki/File:Puffin_Latrabjarg_Iceland.jpg) | CC BY 3.0 | Boaworm |
| `pelikan` | [ComputerHotline - Pelecanus crispus (by) (1).jpg](https://commons.wikimedia.org/wiki/File:ComputerHotline_-_Pelecanus_crispus_(by)_(1).jpg) | CC BY 2.0 | Thomas Bresson |
| `qualle` | [Moon jellyfish at Gota Sagher.JPG](https://commons.wikimedia.org/wiki/File:Moon_jellyfish_at_Gota_Sagher.JPG) | CC BY-SA 3.0 | Alexander Vasenin |
| `quokka` | [Quokka (Setonix brachyurus) (27725086285).jpg](https://commons.wikimedia.org/wiki/File:Quokka_(Setonix_brachyurus)_(27725086285).jpg) | CC BY 2.0 | patrickkavanagh |
| `roterpanda` | [Red Panda.JPG](https://commons.wikimedia.org/wiki/File:Red_Panda.JPG) | CC BY-SA 3.0 | User Bernard Landgraf on de.wikipedia.org |
| `schildkroete` | [Green sea turtle (Chelonia mydas) Moorea.jpg](https://commons.wikimedia.org/wiki/File:Green_sea_turtle_(Chelonia_mydas)_Moorea.jpg) | CC BY-SA 4.0 | Charles J. Sharp |
| `schmetterling` | [Peacock butterfly (Aglais io) 2.jpg](https://commons.wikimedia.org/wiki/File:Peacock_butterfly_(Aglais_io)_2.jpg) | CC BY-SA 3.0 | Charles J. Sharp |
| `seepferdchen` | [Seahorse Skeleton Macro 8.JPG](https://commons.wikimedia.org/wiki/File:Seahorse_Skeleton_Macro_8.JPG) | CC BY-SA 3.0 | “Jon Zander (Digon3)" |
| `seestern` | [Asterias rubens.jpg](https://commons.wikimedia.org/wiki/File:Asterias_rubens.jpg) | CC BY-SA 4.0 | Hans Hillewaert |
| `shiba` | [Shiba inu taiki.jpg](https://commons.wikimedia.org/wiki/File:Shiba_inu_taiki.jpg) | Public domain | Roberto Vasarri |
| `sonnenblume` | [Single Sunflower 1.JPG](https://commons.wikimedia.org/wiki/File:Single_Sunflower_1.JPG) | CC BY-SA 3.0 | Sivaraj |
| `taco` | [001 Tacos de carnitas, carne asada y al pastor.jpg](https://commons.wikimedia.org/wiki/File:001_Tacos_de_carnitas,_carne_asada_y_al_pastor.jpg) | CC BY-SA 2.0 | Larry Miller |
| `tukan` | [006 Toco toucan in Encontro das Águas State Park Photo by Giles Laurent.jpg](https://commons.wikimedia.org/wiki/File:006_Toco_toucan_in_Encontro_das_%C3%81guas_State_Park_Photo_by_Giles_Laurent.jpg) | CC BY-SA 4.0 | Giles Laurent |
| `walross` | [Pacific Walrus - Bull (8247646168).jpg](https://commons.wikimedia.org/wiki/File:Pacific_Walrus_-_Bull_(8247646168).jpg) | Public domain | Joel Garlich-Miller, U.S. Fish and Wildlife Service |

### 7.3 — Was noch fehlt

Die Namensnennung steht bisher nur hier, nicht **im Spiel**. Fuer CC BY ist
das grenzwertig: Ueblich ist ein Hinweis dort, wo das Werk erscheint —
`CREDITS.md` oder eine Zeile im Mememory-Menue waeren der saubere Ort. Nicht
gebaut, weil die Zeit dafuer nicht reichte.

---

## 8 — Nachliefern

Die Prompts stehen in den Erzeugerskripten (Sitzungs-Scratchpad,
`mememory_motive.py` / `mememory_nachzug.py` / `mememory_kulisse.py`), die
Wandlung in `mememory_ausliefern.py`. Vorlagen des Nutzers werden über
`vorlagen_einbauen.py` eingebaut — dort stehen auch die Zuschnitte als Zahlen
und die Regel, Transparenz gegen die **Kartenfarbe** zusammenzulegen und nicht
gegen Schwarz (`.convert("RGB")` nimmt sonst Schwarz, und ein freigestelltes
Emoji wird zum schwarzen Kasten).

Wer ein Motiv ersetzt, muss **beides**
tun: die Datei unter `public/mememory/motive/<kennung>.webp` austauschen **und**
die Kennung in `packages/game-mememory/src/motive.ts` stehen lassen bzw.
mitändern. Der Katalog ist der Vertrag zwischen Modul und Client — eine Kennung
ohne Datei ist ein weißer Kasten auf der Karte.
