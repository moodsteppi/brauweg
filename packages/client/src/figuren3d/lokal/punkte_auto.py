"""
Schaetzt die Gelenkpunkte einer Figur aus dem Alphakanal ihres Konzeptbilds.

  python punkte_auto.py <konzept.png> <ausgabe.punkte.json>

WARUM DAS GEHT: Alle Figuren stehen in derselben A-Haltung, frontal, mit
denselben Chibi-Proportionen (Stilbibel, docs/ASSETS-TAFELRUNDE-NEU.md). Was
sich unterscheidet, misst das Skript: wo die Fuesse stehen, wie breit der
Rumpf ist, wie hoch der Kopf reicht. Der Rest folgt den Proportionen, die an
Dorfwache und Frostweberin von Hand abgelesen und abgenommen wurden.

Ausgabe in Metern wie riggen.py: Die Huelle des Bildes wird auf 1,8 m Hoehe
gebracht, x um die Huellenmitte, z = 0 am Boden.
"""
import json
import sys

import numpy as np
from PIL import Image

quelle, ziel = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(quelle).convert("RGBA"))[..., 3] > 128
zeilen = np.where(a.any(axis=1))[0]
spalten = np.where(a.any(axis=0))[0]
oben, unten = zeilen[0], zeilen[-1]
links, rechts = spalten[0], spalten[-1]
k = 1.8 / (unten - oben)
mitte_x = (links + rechts) / 2


def laeufe(zeile):
    """Zusammenhaengende belegte Abschnitte einer Zeile als (anfang, ende)."""
    belegt = a[zeile]
    kanten = np.diff(np.concatenate([[0], belegt.astype(int), [0]]))
    return list(zip(np.where(kanten == 1)[0], np.where(kanten == -1)[0] - 1))


# --- Fuesse: die zwei breitesten Abschnitte knapp ueber dem Boden -------------
fussband = int(unten - (unten - oben) * 0.03)
fuesse = sorted(laeufe(fussband), key=lambda l: l[1] - l[0], reverse=True)[:2]
if len(fuesse) < 2:  # Fuesse beruehren sich: Abschnitt teilen
    a0, a1 = fuesse[0]
    fuesse = [(a0, (a0 + a1) // 2), ((a0 + a1) // 2, a1)]
fx = sorted((l[0] + l[1]) / 2 for l in fuesse)
koerper_x = (fx[0] + fx[1]) / 2

# --- Kopfhoehe: oberster Punkt in einem schmalen Band ueber der Koerpermitte --
band = int((rechts - links) * 0.06)
kopf_oben = np.where(a[:, int(koerper_x) - band:int(koerper_x) + band].any(axis=1))[0][0]
hb = unten - kopf_oben  # Koerperhoehe in Pixeln (ohne Stab ueber dem Kopf)

# --- Rumpfbreite auf Bauchhoehe ------------------------------------------------
bauch = int(unten - hb * 0.33)
rumpf = next((l for l in laeufe(bauch) if l[0] <= koerper_x <= l[1]), None)
halb = (rumpf[1] - rumpf[0]) / 2 if rumpf else hb * 0.2
halb = min(halb, hb * 0.26)


def p(x_px, h_anteil, y=0.0):
    return [round((x_px - mitte_x) * k, 3), y, round(hb * h_anteil * k, 3)]


schulter = 0.85 * halb
punkte = {
    "_quelle": f"punkte_auto.py aus {quelle.split('/')[-1]}: Fuesse {fx[0]:.0f}/{fx[1]:.0f}, Kopf {kopf_oben}, Boden {unten}, Rumpf +-{halb:.0f} px",
    # Koerperhoehe (Scheitel bis Boden, ohne Stab darueber) in Metern bei
    # 1,8 m Huellenhoehe: riggen.py bringt damit alle Koerper auf dieselbe
    # Groesse, egal wie hoch der Stab ragt.
    "koerperhoehe": round(hb * k, 3),
    "hals": p(koerper_x, 0.56),
    "brust": p(koerper_x, 0.47),
    "huefte": p(koerper_x, 0.26),
    "schulter_r": p(koerper_x - schulter, 0.51),
    "hand_r": p(koerper_x - schulter - hb * 0.18, 0.41),
    "schulter_l": p(koerper_x + schulter, 0.51),
    "hand_l": p(koerper_x + schulter + hb * 0.18, 0.41),
    "bein_r": p(koerper_x + (fx[0] - koerper_x) * 0.85, 0.19),
    "knoechel_r": p(fx[0], 0.06),
    "zeh_r": p(fx[0], 0.02, -0.22),
    "bein_l": p(koerper_x + (fx[1] - koerper_x) * 0.85, 0.19),
    "knoechel_l": p(fx[1], 0.06),
    "zeh_l": p(fx[1], 0.02, -0.22),
}
json.dump(punkte, open(ziel, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(ziel, punkte["_quelle"])
