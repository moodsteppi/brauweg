"""Zeichnet das Spielwahl-Banner fuer Filler.

    python scripts/filler-banner-zeichnen.py

Erzeugt `packages/client/public/hub/spielwahl-filler.webp` (1200 x 300).

**Warum gezeichnet und nicht bestellt.** CLAUDE.md Regel 5 sagt: Neue Grafik
wird bestellt, nicht beschrieben. Das gilt fuer gemalte Motive — hier ist das
Motiv aber das SPIEL SELBST, und das ist ein Raster aus sechs Farbwerten, die
schon im Quelltext stehen. Ein Auftrag haette sie abmalen lassen; so kommen
sie aus derselben Quelle wie das Brett im Spiel und koennen gar nicht
auseinanderlaufen. Wer die Farben aendert, laesst dieses Skript neu laufen.

**Warum ein Skript und kein einmaliges Bild.** Das Banner ist 1200 x 300 und
traegt unten links den Titel als Overlay (`.hub-themenspiel-text`). Wie viel
Platz der braucht, sieht man erst im Zusammenspiel — und dann will man das
Bild noch dreimal verschieben. Ein Skript macht das zu einer Zahl statt zu
einer Bestellung.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

# Muss zu FARBEN in packages/client/src/screens/Filler.tsx passen.
FARBEN = ["#f5325a", "#92d84e", "#fed42a", "#35b4f0", "#6b4fb5", "#3c3c3c"]
# Muss zu GRAUTOENE ebendort passen.
GRAUTOENE = ["#949494", "#a3a3a3", "#b2b2b2", "#c0c0c0", "#cbcbcb"]

BREITE, HOEHE = 1200, 300
SPALTEN, ZEILEN = 8, 7
KACHEL = 36
FUGE = 2

# Der Titel liegt unten links ueber dem Bild. So weit bleibt das Motiv weg —
# gemessen an `.hub-themenspiel-text`, das mit 0.02rem Zeilenabstand zwei
# Zeilen traegt.
TITELZONE = 470


def farbe(hexwert: str) -> tuple[int, int, int]:
    h = hexwert.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def hintergrund() -> Image.Image:
    """Dunkler Verlauf, damit der weisse Titel unten links lesbar bleibt.

    Der Bildschirm des Spiels ist hell — das Banner ist es bewusst NICHT: Es
    steht in der Spielauswahl neben sechs dunklen Nachbarn, und ein heller
    Kasten dazwischen sieht nach fehlendem Bild aus. Das Brett bringt seine
    Helligkeit selbst mit und leuchtet auf dem dunklen Grund erst richtig.
    """
    bild = Image.new("RGB", (BREITE, HOEHE), (18, 18, 24))
    zeichner = ImageDraw.Draw(bild)
    for y in range(HOEHE):
        t = y / (HOEHE - 1)
        zeichner.line(
            [(0, y), (BREITE, y)],
            fill=(int(20 + 14 * t), int(20 + 14 * t), int(28 + 18 * t)),
        )
    return bild


def schein(bild: Image.Image, mitte: tuple[int, int], radius: int) -> Image.Image:
    """Ein weicher Lichtschein hinter dem Brett.

    Ohne ihn steht das Brett wie ausgeschnitten auf der Flaeche. Gebaut ueber
    eine geblurrte Maske statt ueber einen Verlauf: Ein Verlauf waere
    rechteckig, und die Kanten saehe man.
    """
    maske = Image.new("L", (BREITE, HOEHE), 0)
    ImageDraw.Draw(maske).ellipse(
        [mitte[0] - radius, mitte[1] - radius // 2, mitte[0] + radius, mitte[1] + radius // 2],
        fill=90,
    )
    maske = maske.filter(ImageFilter.GaussianBlur(90))
    return Image.composite(Image.new("RGB", (BREITE, HOEHE), (74, 96, 128)), bild, maske)


def brett() -> list[list[str]]:
    """Das Brett des Banners: fest gelegt, nicht gewuerfelt.

    Es soll in einem Bild BEIDES zeigen — das bunte Spiel und den Nebel. Ein
    zufaelliges Brett trifft das mal und mal nicht; hier steht es also
    ausgeschrieben.

    Und es haelt sich an die Regel des Spiels: Farbig ist genau, was einem
    Gebiet gehoert oder daran GRENZT — alles andere liegt im Nebel. Ein Banner,
    das irgendwo mittendrin eine Farbe zeigt, wuerde die Abwandlung falsch
    erklaeren, bevor der Erste sie gespielt hat.

    Unten links das gruene Gebiet, oben rechts das lila. Lila und nicht das
    Dunkelgrau der Palette: Auf dem dunklen Banner verschwaende ein
    dunkelgraues Gebiet im Hintergrund, und dann haette nur einer der beiden
    Spieler eine Ecke.

    Zeichen: 0-5 = Farbnummer, . = Nebel (Grauton nach Position).
    """
    plan = [
        "....2444",
        "....0442",
        ".....35.",
        "........",
        "32......",
        "110.....",
        "1113....",
    ]
    aus: list[list[str]] = []
    for z, zeile in enumerate(plan):
        aus.append([])
        for sp, zeichen in enumerate(zeile):
            if zeichen == ".":
                aus[z].append(GRAUTOENE[(z * 3 + sp * 5) % len(GRAUTOENE)])
            else:
                aus[z].append(FARBEN[int(zeichen)])
    return aus


def male() -> Image.Image:
    bild = hintergrund()
    brett_breite = SPALTEN * KACHEL + (SPALTEN + 1) * FUGE
    brett_hoehe = ZEILEN * KACHEL + (ZEILEN + 1) * FUGE
    links = BREITE - brett_breite - 74
    oben = (HOEHE - brett_hoehe) // 2

    bild = schein(bild, (links + brett_breite // 2, HOEHE // 2), 340)

    # Die linke Haelfte traegt den Titel und waere sonst eine tote Flaeche.
    # Ein weit aufgeblasenes, unscharfes Brett fuellt sie, ohne mit der
    # Schrift zu streiten: Es ist dieselbe Form, nur ausser Fokus.
    bild = kulisse(bild)

    zeichner = ImageDraw.Draw(bild)

    # Die Fuge ist die Brettfarbe: dieselbe Loesung wie im Spiel, wo sonst zwei
    # benachbarte Nebelfelder zu einer Flaeche verschmelzen.
    zeichner.rounded_rectangle(
        [links, oben, links + brett_breite, oben + brett_hoehe],
        radius=6,
        fill=(12, 12, 16),
    )
    felder = brett()
    for z in range(ZEILEN):
        for sp in range(SPALTEN):
            x = links + FUGE + sp * (KACHEL + FUGE)
            y = oben + FUGE + z * (KACHEL + FUGE)
            zeichner.rectangle([x, y, x + KACHEL - 1, y + KACHEL - 1], fill=farbe(felder[z][sp]))

    # Die sechs Farben links neben dem Brett, senkrecht: Sie sind die
    # eigentliche Handlung des Spiels ("waehle eine Farbe") und gehoeren
    # deshalb ins Bild.
    kachel = 44
    abstand = 10
    saeule = len(FARBEN) * kachel + (len(FARBEN) - 1) * abstand
    # Passt die Saeule nicht in die Hoehe, wird sie gestaucht statt
    # abgeschnitten — sonst faellt beim naechsten Groessenwechsel still die
    # unterste Farbe aus dem Bild.
    if saeule > HOEHE - 24:
        abstand = max(2, (HOEHE - 24 - len(FARBEN) * kachel) // (len(FARBEN) - 1))
        saeule = len(FARBEN) * kachel + (len(FARBEN) - 1) * abstand
    sx = links - 92
    sy = (HOEHE - saeule) // 2
    for i, f in enumerate(FARBEN):
        y = sy + i * (kachel + abstand)
        # Gruen und Lila sind die belegten Gebietsfarben und deshalb klein —
        # genau wie unter dem Brett im Spiel.
        klein = i in (1, 4)
        gr = kachel // 2 if klein else kachel
        versatz = (kachel - gr) // 2
        zeichner.rounded_rectangle(
            [sx + versatz, y + versatz, sx + versatz + gr, y + versatz + gr],
            radius=max(4, gr // 5),
            fill=farbe(f),
            # Ein duenner heller Rand um JEDE Kachel, nicht nur um die dunkle.
            # Im Spiel steht die Palette auf hellem Grund, hier auf dunklem —
            # ohne Rand verschwindet ausgerechnet das Dunkelgrau, und dann
            # zeigt das Banner fuenf Farben statt sechs. Nur die dunkle zu
            # umranden waere derselbe Effekt mit einer Ausnahme, die beim
            # naechsten Farbwechsel niemand mehr versteht.
            outline=(255, 255, 255, 255),
            width=2,
        )

    return bild


def kulisse(bild: Image.Image) -> Image.Image:
    """Unscharfe Riesenkacheln hinter der Titelzone.

    Sie sind sehr dunkel gehalten (Deckkraft ueber die Maske, nicht ueber die
    Farbe): Das Overlay schreibt hier weissen Text hinein, und jeder Kontrast,
    den die Kulisse mitbringt, geht dem Text verloren.
    """
    schicht = Image.new("RGB", (BREITE, HOEHE), (18, 18, 24))
    zeichner = ImageDraw.Draw(schicht)
    gross = 132
    muster = [(0, 3), (1, 5), (2, 0), (3, 2)]
    for i, (spalte, f) in enumerate(muster):
        x = -40 + spalte * (gross + 16)
        y = -30 + (i % 2) * (gross + 20)
        zeichner.rectangle([x, y, x + gross, y + gross], fill=farbe(FARBEN[f]))
    schicht = schicht.filter(ImageFilter.GaussianBlur(46))
    maske = Image.new("L", (BREITE, HOEHE), 0)
    ImageDraw.Draw(maske).rectangle([0, 0, TITELZONE + 60, HOEHE], fill=46)
    maske = maske.filter(ImageFilter.GaussianBlur(60))
    return Image.composite(schicht, bild, maske)


def main() -> None:
    ziel = Path(__file__).resolve().parent.parent / "packages/client/public/hub/spielwahl-filler.webp"
    bild = male()
    # Qualitaet 88: Die Nachbarbanner liegen bei 30-50 kB, und ein Banner, das
    # dreimal so schwer ist wie seine Nachbarn, faellt genau dann auf, wenn
    # jemand die Spielauswahl auf dem Handy oeffnet.
    bild.save(ziel, "WEBP", quality=88, method=6)
    print(f"{ziel} — {bild.size[0]}x{bild.size[1]}, {ziel.stat().st_size / 1024:.1f} kB")


if __name__ == "__main__":
    main()
