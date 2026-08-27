"""Zeichnet die Kartenrueckseite von Mememory als Bilddatei.

Warum eine Datei und nicht das vorhandene CSS? Am Brett ist die Rueckseite
`.mm-rueck` — Verlaeufe, drei eingelegte Raender, ein Ring und ein Monogramm,
zusammen fuenf gestapelte Schichten. Fuer EINE grosse Karte ist das richtig.
Im Ecken-HUD liegen aber bis zu zwanzig winzige Karten uebereinander, und
fuenf Schichten je Karte waeren hundert Zeichenebenen in einer Ecke, die sich
bei jedem Punkt neu aufbaut. Ein Bild ist dort eine Ebene.

Die Zahlen sind ABGESCHRIEBEN, nicht neu erfunden: dieselben Farben,
dieselben Randstaerken, derselbe Winkel im Streifenmuster wie in styles.css.
Wer die Rueckseite am Brett aendert, aendert sie hier mit — sonst liegen im
selben Bildschirm zwei verschiedene Karten.

Aufruf:  python scripts/mememory-karte-zeichnen.py
Ergebnis: packages/client/public/mememory/karte-ruecken.webp

Das Skript liegt unter scripts/ und NICHT unter packages/client/art/: Dort
liegen die Originale, und der ganze Ordner steht in .gitignore (Regel 4).
Ein Erzeuger ist aber Quelltext — ohne ihn im Repo wuesste beim naechsten Mal
niemand, wie das Bild entstanden ist.
"""

import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HIER = os.path.dirname(os.path.abspath(__file__))
ZIEL = os.path.normpath(
    os.path.join(HIER, "..", "packages", "client", "public", "mememory", "karte-ruecken.webp")
)

# Ausgeliefert wird 78 x 108 — das Dreifache der groessten Stelle, an der die
# Karte im HUD steht (26 x 36 auf einem breiten Schirm). Mehr waere Ballast:
# Die Karte ist im Spiel nie groesser als ein Daumennagel.
BREITE, HOEHE = 78, 108
# Gerechnet wird achtfach und am Ende heruntergerechnet. Die eingelegten
# Raender sind unter einem Pixel breit; ohne diesen Umweg verschwinden sie.
S = 8
RADIUS = 9  # entspricht `border-radius: 9px` am Brett, auf diese Breite umgerechnet

GOLD = (255, 214, 140)
DUNKEL = (18, 10, 34)


def grundflaeche(b, h):
    """radial-gradient(130% 100% at 50% 0%, #3c332a, #221c15 55%, #12100c)"""
    bild = Image.new("RGB", (b, h))
    px = bild.load()
    # Der Verlauf laeuft von der oberen Mitte nach aussen; 130 % Breite,
    # 100 % Hoehe — beides wie im CSS.
    rx, ry = b * 1.3, h * 1.0
    for y in range(h):
        for x in range(b):
            d = math.sqrt(((x - b / 2) / rx) ** 2 + (y / ry) ** 2)
            d = min(1.0, d)
            if d < 0.55:
                t = d / 0.55
                farbe = tuple(int(a + (c - a) * t) for a, c in zip((60, 51, 42), (34, 28, 21)))
            else:
                t = (d - 0.55) / 0.45
                farbe = tuple(int(a + (c - a) * t) for a, c in zip((34, 28, 21), (18, 16, 12)))
            px[x, y] = farbe
    return bild


def streifen(b, h):
    """repeating-linear-gradient(45deg, gold 7% 0-5px, nichts 5-10px)"""
    lage = Image.new("RGBA", (b, h), (0, 0, 0, 0))
    z = ImageDraw.Draw(lage)
    schritt = 10 * S / 3  # 10 px bei 78 px Breite entsprechen dieser Teilung
    breite = schritt / 2
    # 45 Grad: Linien von links unten nach rechts oben.
    i = -h
    while i < b + h:
        z.line([(i, h), (i + h, 0)], fill=GOLD + (18,), width=int(breite))
        i += schritt
    return lage


def karte():
    b, h = BREITE * S, HOEHE * S
    bild = grundflaeche(b, h).convert("RGBA")
    bild = Image.alpha_composite(bild, streifen(b, h))
    z = ImageDraw.Draw(bild)

    # Der Ring in der Mitte: 56 % der Breite, 1,5 px Strich am Brett.
    r = b * 0.56 / 2
    mx, my = b / 2, h / 2
    z.ellipse([mx - r, my - r, mx + r, my + r], outline=GOLD + (115,), width=max(1, int(1.5 * S / 3)))

    # Das Monogramm, Verlauf von #ffe9b0 nach #c9922f.
    try:
        schrift = ImageFont.truetype("georgiab.ttf", int(h * 0.30))
    except OSError:
        schrift = ImageFont.truetype("timesbd.ttf", int(h * 0.30))
    kasten = z.textbbox((0, 0), "M", font=schrift)
    tb, th = kasten[2] - kasten[0], kasten[3] - kasten[1]
    maske = Image.new("L", (b, h), 0)
    ImageDraw.Draw(maske).text(
        (mx - tb / 2 - kasten[0], my - th / 2 - kasten[1]), "M", font=schrift, fill=255
    )
    verlauf = Image.new("RGBA", (b, h))
    vpx = verlauf.load()
    for y in range(h):
        t = y / h
        farbe = tuple(int(a + (c - a) * t) for a, c in zip((255, 233, 176), (201, 146, 47)))
        for x in range(b):
            vpx[x, y] = farbe + (255,)
    bild = Image.composite(verlauf, bild, maske)

    # Die drei eingelegten Raender von aussen nach innen: Gold 40 %,
    # Dunkelblau 90 % (2 px breit), Gold 20 %.
    z = ImageDraw.Draw(bild)
    ecke = RADIUS * S
    z.rounded_rectangle([0, 0, b - 1, h - 1], radius=ecke, outline=GOLD + (102,), width=S)
    z.rounded_rectangle(
        [S, S, b - 1 - S, h - 1 - S], radius=ecke - S, outline=DUNKEL + (230,), width=2 * S
    )
    z.rounded_rectangle(
        [3 * S, 3 * S, b - 1 - 3 * S, h - 1 - 3 * S],
        radius=max(1, ecke - 3 * S),
        outline=GOLD + (51,),
        width=S,
    )

    # Runde Ecken ausstanzen, damit die Karte im Stapel keine schwarzen
    # Zipfel zeigt.
    maske = Image.new("L", (b, h), 0)
    ImageDraw.Draw(maske).rounded_rectangle([0, 0, b - 1, h - 1], radius=ecke, fill=255)
    bild.putalpha(maske)

    return bild.resize((BREITE, HOEHE), Image.LANCZOS)


if __name__ == "__main__":
    bild = karte()
    os.makedirs(os.path.dirname(ZIEL), exist_ok=True)
    bild.save(ZIEL, "WEBP", quality=92, method=6)
    print("%s  %d x %d  %d Bytes" % (ZIEL, bild.width, bild.height, os.path.getsize(ZIEL)))
