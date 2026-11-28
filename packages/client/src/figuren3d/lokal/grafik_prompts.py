"""Bildzeilen fuer Feld, Karten, Zeichen und Effekte (Umsetzungsplan, Abschnitt 4).
Schreibt <name>.prompt.txt in den Zielordner. Stilvorlage ist der Ritter-Pinguin."""
import os
import sys

ziel = sys.argv[1]
os.makedirs(ziel, exist_ok=True)

EIN = ("Use your image generation tool to create exactly ONE image. Do not run shell commands and do not "
       "read files, just generate. The attached image is the style reference for rendering (materials, light, "
       "colours, friendliness).")
STIL_FREI = ("Style: match the attached Brauweg knight penguin reference in rendering — stylized 3D-rendered "
             "mobile game art, rounded modelled shapes with real volume, soft gradients, glossy highlights, one "
             "light source from the top left, no black outline, not flat vector, not photorealistic. Original "
             "design for our own game. Real transparent background with alpha channel — no checkerboard, no "
             "ground, no cast floor shadow, no text, no letters, no numbers, no logo, no frame, no UI. One single "
             "object, centered, fully visible with a small margin.")
STIL_SZENE = ("Style: match the attached Brauweg knight penguin reference in rendering — stylized 3D-rendered "
              "mobile game art, soft gradients, warm light from the top left, not flat vector, not "
              "photorealistic. Original design for our own game. No characters, no animals, no text, no "
              "letters, no logo, no frame, no UI, no grid lines. FULL-BLEED opaque image, NO transparency.")

SZENE = ("Subject: the ground of a cosy auto-battler arena for a mobile game, PORTRAIT 1024x1536, seen from "
         "above at a steep angle (about 60 degrees, almost top-down, very slight perspective). The central 80 % "
         "of the image is ONE large, even, walkable playing surface with a calm, low-contrast texture, so that "
         "small game pieces stand out on it; no objects, holes, paths or patterns that could look like game "
         "tiles in that area. The upper half and the lower half are the two opposing sides and look the same. "
         "Decoration only along the left and right edges and in the corners. Theme: {thema}")

THEMEN = {
    "feld-burghof": "a snowy castle courtyard: worn grey cobblestone with light snow, snowdrifts and a wooden "
                    "fence along the edges, two warm burning torches in the corners, small blue-and-gold banners.",
    "feld-dorfplatz": "a sunny summer village square: soft green grass with a few flowers, bits of cobblestone "
                      "at the edges, little market stalls with striped awnings and barrels along the sides.",
    "feld-herbstwald": "an autumn forest clearing: soft moss and fallen orange-red leaves, roots, mushrooms and "
                       "ferns along the edges, warm golden light falling through the trees.",
    "feld-vulkan": "a volcanic shore: dark smooth basalt ground with a few faint glowing cracks only near the "
                   "edges, small lava pools and steaming rocks in the corners, warm orange glow, still friendly.",
}

RAHMEN = ("Subject: an ornamental PORTRAIT card frame for a unit card in a mobile game, 704x1024 (ratio 11:16). "
          "Only the frame border, about 7 % of the width thick, rounded corners, a small gem at the top centre "
          "and a small plaque area at the bottom centre (empty, no text). The ENTIRE inner area of the card is "
          "fully TRANSPARENT (alpha 0) — nothing inside the border. Material: {material}. Real transparent "
          "background and transparent centre with alpha channel, no checkerboard, no text, no letters.")
MATERIAL = {
    "rahmen-1": "warm polished bronze with a small green gem",
    "rahmen-2": "bright polished silver with a small blue gem",
    "rahmen-3": "rich shining gold with a small red gem and fine engraved ornaments",
}

ZEICHEN = {
    # Rollen
    "rolle-wache": "a small round wooden shield with an iron rim, front view",
    "rolle-schuetze": "a small wooden bow with an arrow, diagonal",
    "rolle-magier": "a short magic staff with a glowing blue crystal on top, diagonal",
    "rolle-meuchler": "two small crossed daggers",
    "rolle-beistand": "a soft glowing green heart with a small white plus",
    # Marken
    "marke-krieger": "a small crossed sword and axe emblem, steel and red",
    "marke-elementar": "a swirling elemental orb of fire, water and lightning, glowing",
    "marke-meuchler": "a dark purple hooded mask emblem with two eye slits",
    "marke-waechter": "a sturdy blue tower shield emblem with a golden rim",
    "marke-naturwesen": "a fresh green leaf with a small acorn",
    "marke-untot": "a friendly pale lilac ghost wisp, cute, not scary",
    "marke-drache": "a small orange dragon head emblem breathing a tiny flame",
    # Sonstiges
    "stern": "a single shiny golden five-pointed star",
    "gold": "a single shiny gold coin seen at a slight angle, a penguin silhouette embossed on it",
    "leben": "a single glossy red heart",
}

EFFEKTE = {
    "effekt-schild": "a translucent glowing blue magic shield bubble, round, light and airy",
    "effekt-heilung": "a soft cloud of green healing sparkles and tiny leaves",
    "effekt-funken": "a burst of small orange fire sparks",
    "effekt-feuer": "a short horizontal jet of bright orange-yellow dragon fire, flowing to the RIGHT",
    "effekt-blitz": "a short jagged bright cyan-white lightning bolt, horizontal",
    "effekt-frost": "a ring of icy blue frost crystals and snowflakes",
    "effekt-rauch": "a puff of soft dark purple smoke",
    "effekt-blaetter": "a few small green leaves swirling upward",
    "effekt-geist": "a pale lilac ghostly shimmer rising upward, soft and friendly",
    "effekt-betaeubt": "three small golden stars circling in a ring, seen from slightly above",
}

for name, thema in THEMEN.items():
    text = f"{EIN}\n\n{SZENE.format(thema=thema)}\n\n{STIL_SZENE}\n"
    open(os.path.join(ziel, f"{name}.prompt.txt"), "w", encoding="utf-8").write(text)
for name, material in MATERIAL.items():
    text = f"{EIN}\n\n{RAHMEN.format(material=material)}\n\nStyle: match the attached reference in rendering, stylized 3D game art, glossy, no black outline.\n"
    open(os.path.join(ziel, f"{name}.prompt.txt"), "w", encoding="utf-8").write(text)
for name, motiv in {**ZEICHEN, **EFFEKTE}.items():
    groesse = "Square 1024x1024."
    text = f"{EIN}\n\nSubject: a game icon / effect sprite: {motiv}. Bold, simple, readable at 32 pixels. {groesse}\n\n{STIL_FREI}\n"
    open(os.path.join(ziel, f"{name}.prompt.txt"), "w", encoding="utf-8").write(text)
print(len(THEMEN) + len(MATERIAL) + len(ZEICHEN) + len(EFFEKTE), "Bildzeilen")
