"""Banner fuer Farbduell (public/hub/banner-filler.webp), 1200 x 800.

Gezeichnet statt erzeugt (docs/ASSETS-FARBDUELL.md): Das erste Motiv aus dem
Bildwerkzeug zeigte fallende Bloecke und wurde fuer Tetris gehalten (Niklas,
27.10.2026). Hier liegt nur das Spielfeld: zwei Gebiete, Blau von links unten,
Rot von rechts oben, die sich ueber ein buntes Raster ausbreiten — genau das
Spiel. Nichts faellt, keine Viererformen, keine Schrift.

    python3 werkzeug/hub/farbduell-banner.py <ziel.png>

Danach mit cwebp nach public/hub/banner-filler.webp (siehe Bestellung).
"""
import random
import sys

from PIL import Image, ImageDraw, ImageFilter

S = 2  # Ueberabtastung: erst doppelt zeichnen, dann verkleinern
B, H = 1200 * S, 800 * S
SP, ZE = 16, 11  # Spalten, Zeilen
ZELLE = 120 * S
LUECKE = 12 * S

BLAU = (54, 180, 240)
ROT = (242, 56, 90)
NEUTRAL = [(148, 214, 78), (255, 212, 42), (108, 75, 192), (70, 74, 92)]

rnd = random.Random(27102026)


def gebiet(start, groesse, belegt):
    """Ein zusammenhaengendes Gebiet, das vom Startfeld aus waechst."""
    feld = {start}
    rand = [start]
    while len(feld) < groesse and rand:
        x, y = rnd.choice(rand)
        nach = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
        nach = [p for p in nach if 0 <= p[0] < SP and 0 <= p[1] < ZE and p not in feld and p not in belegt]
        if not nach:
            rand.remove((x, y))
            continue
        p = rnd.choice(nach)
        feld.add(p)
        rand.append(p)
    return feld


blau = gebiet((0, ZE - 1), 46, set())
rot = gebiet((SP - 1, 0), 44, blau)

farbe = {}
for y in range(ZE):
    for x in range(SP):
        if (x, y) in blau:
            farbe[x, y] = BLAU
        elif (x, y) in rot:
            farbe[x, y] = ROT
        else:
            # Neutral, aber nie zwei gleiche nebeneinander — so sieht es nach
            # Feld aus und nicht nach Flaechen.
            verboten = {farbe.get((x - 1, y)), farbe.get((x, y - 1))}
            farbe[x, y] = rnd.choice([f for f in NEUTRAL if f not in verboten])


def misch(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def kachel(f, glanz):
    """Eine Kachel mit Licht oben, Schatten unten — wie die anderen Banner."""
    k = ZELLE - LUECKE
    im = Image.new('RGBA', (k, k), (0, 0, 0, 0))
    maske = Image.new('L', (k, k), 0)
    ImageDraw.Draw(maske).rounded_rectangle((0, 0, k - 1, k - 1), radius=22 * S, fill=255)
    verlauf = Image.new('RGB', (k, k))
    d = ImageDraw.Draw(verlauf)
    for i in range(k):
        t = i / k
        d.line([(0, i), (k, i)], fill=misch(misch(f, (255, 255, 255), 0.35 if glanz else 0.22), misch(f, (0, 0, 0), 0.35), t))
    im.paste(verlauf, (0, 0), maske)
    # Glanzkante oben
    kante = Image.new('L', (k, k), 0)
    ImageDraw.Draw(kante).rounded_rectangle((8 * S, 6 * S, k - 8 * S, k // 3), radius=16 * S, fill=90 if glanz else 55)
    weiss = Image.new('RGBA', (k, k), (255, 255, 255, 255))
    im.paste(weiss, (0, 0), Image.composite(kante, Image.new('L', (k, k), 0), maske))
    return im


bw, bh = SP * ZELLE, ZE * ZELLE
brett = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
gd = ImageDraw.Draw(brett)
for y in range(ZE):
    for x in range(SP):
        gd.rounded_rectangle(
            (x * ZELLE + 2 * S, y * ZELLE + 2 * S, (x + 1) * ZELLE - 2 * S, (y + 1) * ZELLE - 2 * S),
            radius=24 * S, outline=(60, 80, 140, 120), width=2 * S,
        )
for (x, y), f in farbe.items():
    glanz = f in (BLAU, ROT)
    brett.alpha_composite(kachel(f, glanz), (x * ZELLE + LUECKE // 2, y * ZELLE + LUECKE // 2))

# Leuchten unter den beiden Gebieten
leucht = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
ld = ImageDraw.Draw(leucht)
for (x, y) in blau:
    ld.rectangle((x * ZELLE, y * ZELLE, (x + 1) * ZELLE, (y + 1) * ZELLE), fill=BLAU + (150,))
for (x, y) in rot:
    ld.rectangle((x * ZELLE, y * ZELLE, (x + 1) * ZELLE, (y + 1) * ZELLE), fill=ROT + (150,))
leucht = leucht.filter(ImageFilter.GaussianBlur(40 * S))
brett = Image.alpha_composite(leucht, brett)


def perspektive(breite, hoehe, ziel):
    """Koeffizienten fuer Image.transform: Zielviereck -> Quellrechteck."""
    import numpy as np  # noqa: PLC0415 — nur hier gebraucht
    quelle = [(0, 0), (breite, 0), (breite, hoehe), (0, hoehe)]
    a = []
    for (x, y), (u, v) in zip(ziel, quelle):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    rechts = np.array([c for p in quelle for c in p], dtype=float)
    return np.linalg.solve(np.array(a, dtype=float), rechts).tolist()


ziel = [(int(B * 0.25), int(H * 0.17)), (int(B * 0.75), int(H * 0.17)), (int(B * 0.97), int(H * 0.95)), (int(B * 0.03), int(H * 0.95))]
schraeg = brett.transform((B, H), Image.Transform.PERSPECTIVE, perspektive(bw, bh, ziel), Image.Resampling.BICUBIC)

grund = Image.new('RGB', (B, H))
gd = ImageDraw.Draw(grund)
for i in range(H):
    gd.line([(0, i), (B, i)], fill=misch((8, 14, 40), (4, 8, 24), i / H))
schein = Image.new('RGBA', (B, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(schein)
sd.ellipse((-B * 0.2, H * 0.3, B * 0.5, H * 1.3), fill=BLAU + (90,))
sd.ellipse((B * 0.55, -H * 0.3, B * 1.2, H * 0.7), fill=ROT + (80,))
schein = schein.filter(ImageFilter.GaussianBlur(160 * S))
bild = Image.alpha_composite(grund.convert('RGBA'), schein)
bild = Image.alpha_composite(bild, schraeg)
bild.convert('RGB').resize((1200, 800), Image.Resampling.LANCZOS).save(sys.argv[1])
