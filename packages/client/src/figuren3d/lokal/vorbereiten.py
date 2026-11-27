"""Stellt ein freigestelltes Konzeptbild so hin, wie TripoSR es erwartet:
Figur auf 85 % der Kante, quadratisch, auf mittelgrauem Grund (0.5).
Ersetzt den rembg-Schritt, weil codex schon echtes Alpha liefert."""
import sys
from PIL import Image

quelle, ziel = sys.argv[1], sys.argv[2]
bild = Image.open(quelle).convert("RGBA")
bild = bild.crop(bild.getchannel("A").getbbox())
kante = int(max(bild.size) / 0.85)
grund = Image.new("RGBA", (kante, kante), (127, 127, 127, 255))
grund.alpha_composite(bild, ((kante - bild.width) // 2, (kante - bild.height) // 2))
grund.convert("RGB").resize((512, 512), Image.LANCZOS).save(ziel)
print(ziel, kante)
