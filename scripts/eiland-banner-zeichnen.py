"""Zeichnet das Spielwahl-Banner fuer Eiland.

    python scripts/eiland-banner-zeichnen.py

Erzeugt `packages/client/public/hub/spielwahl-eiland.webp` (1200 x 300).

**Warum gezeichnet und nicht bestellt.** Wie bei Filler: Das Motiv ist das
Spiel selbst — eine Karte aus Wiese, Wasser, Fels und Nebel, deren Farben
schon im Quelltext stehen (`Eiland.tsx`, `styles.css`). Ein Auftrag haette
sie abmalen lassen; so kommen sie aus derselben Quelle wie die Karte im Spiel
und koennen nicht auseinanderlaufen. Wer eine Farbe aendert, laesst dieses
Skript neu laufen.

**Warum es dieses Bild neben dem bewegten Banner gibt.** In der Spielauswahl
spielt sich seit dem 2. September eine Partie im Banner selbst (`EilandBanner`
in `packages/client/src/minispiele/eiland/Banner.tsx`). Dieses Bild ist deren
Stillstand: fuer den Themen-Tab, fuer „Bewegung reduzieren" — und fuer den
Fall, dass die Simulation je zu teuer wird. Beide zeigen dieselben Farben und
dieselbe Bauart (dunkler Grund, Karte rechts, Titelzone links).
"""

import colorsys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

# Muss zu GEBIET in packages/client/src/minispiele/eiland/farben.ts passen.
GEBIET = ["#e2603f", "#7b4fd0"]
# Die Stufenleiter ebendort (stufenfarbe): Helligkeit von Stufe 0 bis 8.
STUFEN_MAX = 8
HELL_STUFE_0 = 82
HELL_STUFE_MAX = 26
# Das Gold der Heimat, siehe GOLD ebendort und `.ei-feld[data-heimat]`.
GOLD = "#e4b23c"
GOLD_HELL = "#f3cf6a"
# Muss zu GRAUTOENE ebendort passen.
GRAUTOENE = ["#9a9a9a", "#a6a6a6", "#b1b1b1", "#bcbcbc", "#c6c6c6"]
# Muss zu `.ei-feld[data-art=…]` in styles.css passen.
GRAS = "#a9c46c"
WASSER = "#6aa7cf"
BERG = "#8f857a"
# Kegel und Schneekappe des Bergs, siehe `.ei-feld[data-art='berg']`.
BERG_KEGEL = (87, 78, 69, 184)
BERG_SCHNEE = (255, 255, 255, 245)

BREITE, HOEHE = 1200, 300
SPALTEN, ZEILEN = 10, 10
KACHEL = 25
FUGE = 2
# Sichtweite wie im Spiel (DEFAULT_REGELN.sichtweite).
SICHTWEITE = 3

# Die Karte des Banners: festgelegt, nicht gewuerfelt — sie soll in einem
# Bild alles zeigen, was das Spiel ausmacht: beide Gebiete, Seen, Berge, die
# vier ausliegenden Ornamente, je ein eingesammeltes Bauwerk, und den Nebel.
#
#   g Wiese  w Wasser  b Berg  s Stadt  r Brunnen (beide auf Wiese, frei)
#   O Gebiet Orange    S Stadt, von Orange eingesammelt
#   P Gebiet Violett   R Brunnen, von Violett eingesammelt
#
# Der Nebel wird NICHT eingezeichnet, sondern gerechnet — nach derselben
# Regel wie im Spiel (drei Schritte ueber beide Gebiete hinaus). Ein Banner,
# das irgendwo mittendrin ein Feld zeigt, wuerde die Abwandlung falsch
# erklaeren, bevor der Erste sie gespielt hat.
PLAN = [
    "ggbgggwwPP",
    "ggggsggPPP",
    "gggggggRPP",
    "wwgggbgggg",
    "gwggggggrg",
    "grggggggwg",
    "ggggbgggww",
    "OSgggggggg",
    "OOOggsggbg",
    "OOOOgwwggg",
]


def farbe(hexwert: str) -> tuple[int, int, int]:
    h = hexwert.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def stufe(z: int, sp: int) -> int:
    """Die Stufe eines Gebietsfelds: gleichfarbige Felder im Umfeld (bis 8).

    Dieselbe Rechnung wie `stufe` in packages/game-eiland/src/partie.ts —
    Orange ist "OS", Violett "PR".
    """
    gruppe = "OS" if PLAN[z][sp] in "OS" else "PR"
    zahl = 0
    for dz in (-1, 0, 1):
        for dsp in (-1, 0, 1):
            if dz == 0 and dsp == 0:
                continue
            z2, sp2 = z + dz, sp + dsp
            if 0 <= z2 < ZEILEN and 0 <= sp2 < SPALTEN and PLAN[z2][sp2] in gruppe:
                zahl += 1
    return zahl


def stufenfarbe(hexwert: str, wert: int) -> tuple[int, int, int]:
    """Die Gebietsfarbe in der Helligkeit ihrer Stufe — wie `stufenfarbe` in farben.ts."""
    r, g, b = (k / 255 for k in farbe(hexwert))
    h, _l, s = colorsys.rgb_to_hls(r, g, b)
    t = max(0, min(STUFEN_MAX, wert)) / STUFEN_MAX
    l = (HELL_STUFE_0 + (HELL_STUFE_MAX - HELL_STUFE_0) * t) / 100
    return tuple(round(k * 255) for k in colorsys.hls_to_rgb(h, l, s))  # type: ignore[return-value]


def hintergrund() -> Image.Image:
    """Dunkler Verlauf — derselbe wie bei Filler, aus demselben Grund.

    Das Spiel ist hell, das Banner bewusst nicht: Es haengt in der Reihe
    neben dunklen gemalten Nachbarn, und ein heller Kasten dazwischen sieht
    nach fehlendem Bild aus. Die Karte bringt ihre Helligkeit selbst mit.
    """
    bild = Image.new("RGB", (BREITE, HOEHE), (18, 18, 24))
    zeichner = ImageDraw.Draw(bild)
    for y in range(HOEHE):
        t = y / (HOEHE - 1)
        zeichner.line(
            [(0, y), (BREITE, y)],
            fill=(int(20 + 14 * t), int(22 + 14 * t), int(26 + 16 * t)),
        )
    return bild


def schein(bild: Image.Image, mitte: tuple[int, int], radius: int) -> Image.Image:
    """Weicher, moosgruener Lichtschein hinter der Karte (Filler: blau)."""
    maske = Image.new("L", (BREITE, HOEHE), 0)
    ImageDraw.Draw(maske).ellipse(
        [mitte[0] - radius, mitte[1] - radius // 2, mitte[0] + radius, mitte[1] + radius // 2],
        fill=95,
    )
    maske = maske.filter(ImageFilter.GaussianBlur(90))
    return Image.composite(Image.new("RGB", (BREITE, HOEHE), (74, 112, 84)), bild, maske)


def kulisse(bild: Image.Image) -> Image.Image:
    """Unscharfe Riesenfelder hinter der Titelzone.

    Sehr dunkel (Deckkraft ueber die Maske, nicht ueber die Farbe): Das
    Overlay schreibt hier weissen Text hinein, und jeder Kontrast, den die
    Kulisse mitbringt, geht dem Text verloren.
    """
    schicht = Image.new("RGB", (BREITE, HOEHE), (18, 18, 24))
    zeichner = ImageDraw.Draw(schicht)
    gross = 132
    muster = [(0, GRAS), (1, WASSER), (2, GEBIET[0]), (3, GRAS), (4, BERG), (5, GEBIET[1])]
    for i, (spalte, f) in enumerate(muster):
        x = -40 + spalte * (gross + 16)
        y = -30 + (i % 2) * (gross + 20)
        zeichner.rounded_rectangle([x, y, x + gross, y + gross], radius=14, fill=farbe(f))
    schicht = schicht.filter(ImageFilter.GaussianBlur(22))
    maske = Image.new("L", (BREITE, HOEHE), 0)
    ImageDraw.Draw(maske).rectangle([0, 0, 640, HOEHE], fill=48)
    maske = maske.filter(ImageFilter.GaussianBlur(70))
    return Image.composite(schicht, bild, maske)


def sichtbar() -> list[list[bool]]:
    """Was mindestens einer der beiden sieht: drei Schritte ueber sein Gebiet hinaus."""
    raus = [[False] * SPALTEN for _ in range(ZEILEN)]
    for z in range(ZEILEN):
        for sp in range(SPALTEN):
            for z2 in range(ZEILEN):
                for sp2 in range(SPALTEN):
                    if PLAN[z2][sp2] in "OSPR" and abs(z - z2) + abs(sp - sp2) <= SICHTWEITE:
                        raus[z][sp] = True
    return raus


def ornament(
    schicht: ImageDraw.ImageDraw, x: int, y: int, art: int, alpha: int = 235
) -> None:
    """Stadt (0) oder Brunnen (1) — dieselben Formen wie das SVG in Eiland.tsx.

    Die Pfade dort liegen in einer 24er-Box; hier werden sie auf 66 % der
    Kachel skaliert, so wie `.ei-ornament` im Stylesheet.
    """
    groesse = KACHEL * 0.66
    x0 = x + (KACHEL - groesse) / 2
    y0 = y + (KACHEL - groesse) / 2
    k = groesse / 24

    def p(u: float, v: float) -> tuple[float, float]:
        return (x0 + u * k, y0 + v * k)

    weiss = (255, 255, 255, alpha)
    schatten = (0, 0, 0, 110)
    if art == 0:
        formen = [
            [(3, 21), (3, 12), (7, 9), (11, 12), (11, 21)],
            [(13, 21), (13, 8), (17, 5), (21, 8), (21, 21)],
        ]
    else:
        formen = [
            [(4, 8), (12, 3), (20, 8)],
            [(7, 10), (9, 10), (9, 21), (7, 21)],
            [(15, 10), (17, 10), (17, 21), (15, 21)],
            [(9, 15), (15, 15), (15, 21), (9, 21)],
        ]
    for form in formen:
        schicht.polygon([(px, py + 1) for px, py in (p(u, v) for u, v in form)], fill=schatten)
    for form in formen:
        schicht.polygon([p(u, v) for u, v in form], fill=weiss)


def berg(schicht: ImageDraw.ImageDraw, x: int, y: int) -> None:
    """Dunkler Kegel mit Schneekappe — dieselben Pfade wie das SVG in styles.css.

    Die Pfade liegen in einer 24er-Box und werden auf 80 % der Kachel
    skaliert, leicht nach unten gerueckt, so wie `background-size` und
    `background-position` es im Stylesheet tun.
    """
    groesse = KACHEL * 0.8
    x0 = x + (KACHEL - groesse) / 2
    y0 = y + (KACHEL - groesse) * 0.58
    k = groesse / 24

    def p(u: float, v: float) -> tuple[float, float]:
        return (x0 + u * k, y0 + v * k)

    schicht.polygon([p(2.5, 20.5), p(12, 4.5), p(21.5, 20.5)], fill=BERG_KEGEL)
    schicht.polygon(
        [p(12, 4.5), p(15.6, 10.6), p(14.3, 9.7), p(13.1, 11.1), p(12, 9.9), p(10.9, 11.1), p(9.7, 9.7), p(8.4, 10.6)],
        fill=BERG_SCHNEE,
    )


def male() -> Image.Image:
    bild = hintergrund()
    brett_breite = SPALTEN * KACHEL + (SPALTEN + 1) * FUGE
    brett_hoehe = ZEILEN * KACHEL + (ZEILEN + 1) * FUGE
    links = BREITE - brett_breite - 74
    oben = (HOEHE - brett_hoehe) // 2

    bild = schein(bild, (links + brett_breite // 2, HOEHE // 2), 340)
    bild = kulisse(bild)

    zeichner = ImageDraw.Draw(bild)
    # Die Fuge ist die Brettfarbe — wie im Spiel, wo sonst zwei Nebelfelder
    # zu einer Flaeche verschmelzen.
    zeichner.rounded_rectangle(
        [links, oben, links + brett_breite, oben + brett_hoehe],
        radius=6,
        fill=(14, 14, 18),
    )

    sicht = sichtbar()
    # Zeichen und Ornamente auf einer eigenen RGBA-Schicht: Sie brauchen
    # Deckkraft, und PIL mischt auf einem RGB-Bild nicht.
    deko = Image.new("RGBA", (BREITE, HOEHE), (0, 0, 0, 0))
    dz = ImageDraw.Draw(deko)

    for z in range(ZEILEN):
        for sp in range(SPALTEN):
            x = links + FUGE + sp * (KACHEL + FUGE)
            y = oben + FUGE + z * (KACHEL + FUGE)
            zeichen = PLAN[z][sp]
            if not sicht[z][sp]:
                grau = GRAUTOENE[(z * 3 + sp * 5) % len(GRAUTOENE)]
                zeichner.rectangle([x, y, x + KACHEL - 1, y + KACHEL - 1], fill=farbe(grau))
                continue
            if zeichen in "OS":
                grund = stufenfarbe(GEBIET[0], stufe(z, sp))
            elif zeichen in "PR":
                grund = stufenfarbe(GEBIET[1], stufe(z, sp))
            elif zeichen == "w":
                grund = farbe(WASSER)
            elif zeichen == "b":
                grund = farbe(BERG)
            else:
                grund = farbe(GRAS)
            zeichner.rectangle([x, y, x + KACHEL - 1, y + KACHEL - 1], fill=grund)

            if zeichen in "OSPR":
                # Der Innenschimmer des Gebiets (`.ei-feld[data-eigen]`).
                dz.rectangle([x, y, x + KACHEL - 1, y + KACHEL - 1], outline=(255, 255, 255, 128))
            if (z, sp) in ((ZEILEN - 1, 0), (0, SPALTEN - 1)):
                # Die Heimat (`.ei-feld[data-heimat]`): goldener Rahmen, goldenes
                # Rechteck in der Mitte — die Ecke, um die es geht.
                dz.rectangle([x, y, x + KACHEL - 1, y + KACHEL - 1], outline=farbe(GOLD) + (255,), width=2)
                dz.rectangle([x + 2, y + 2, x + KACHEL - 3, y + KACHEL - 3], outline=(0, 0, 0, 76))
                bx0, by0 = x + round(KACHEL * 0.27), y + round(KACHEL * 0.37)
                bx1, by1 = x + KACHEL - 1 - round(KACHEL * 0.27), y + KACHEL - 1 - round(KACHEL * 0.37)
                dz.rectangle([bx0, by0, bx1, by1], fill=farbe(GOLD_HELL) + (255,), outline=(0, 0, 0, 72))
            if zeichen == "b":
                berg(dz, x, y)
            if zeichen == "w":
                # Die Welle (`.ei-feld[data-art='wasser']::after`).
                dz.line(
                    [(x + KACHEL * 0.24, y + KACHEL / 2), (x + KACHEL * 0.76, y + KACHEL / 2)],
                    fill=(255, 255, 255, 115),
                    width=2,
                )
            if zeichen in "sS":
                ornament(dz, x, y, 0)
            if zeichen in "rR":
                ornament(dz, x, y, 1)

    bild = Image.alpha_composite(bild.convert("RGBA"), deko).convert("RGB")
    return bild


if __name__ == "__main__":
    ziel = Path(__file__).resolve().parent.parent / "packages" / "client" / "public" / "hub" / "spielwahl-eiland.webp"
    male().save(ziel, "WEBP", quality=90, method=6)
    print(f"{ziel} ({ziel.stat().st_size // 1024} kB)")
