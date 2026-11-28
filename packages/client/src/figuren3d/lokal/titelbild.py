"""
Titelbild fuer den Einstieg: ein Gruppenbild aus den eigenen, gerigten
Figuren (kostenlos, kein Videomodell). Freigestellt; den Hintergrund setzt
titelbild.mjs dahinter.

  blender -b -P titelbild.py -- <modell-ordner> <ausgabe.png> name1,name2,...

Die erste Figur steht in der Mitte vorn, die weiteren abwechselnd links und
rechts dahinter. Alle in der Ruhepose (`stand`, erstes Bild).
"""
import bpy
import math
import os
import sys

a = sys.argv[sys.argv.index("--") + 1:]
ordner, ausgabe, namen = a[0], a[1], a[2].split(",")

bpy.ops.wm.read_factory_settings(use_empty=True)
szene = bpy.context.scene

# Aufstellung: Mitte vorn, dann im Bogen nach hinten
plaetze = [(0.0, 0.0)]
for i in range(1, len(namen)):
    seite = -1 if i % 2 else 1
    stufe = (i + 1) // 2
    plaetze.append((seite * 1.35 * stufe, 0.9 * stufe))

for name, (x, tiefe) in zip(namen, plaetze):
    vorher = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ordner, f"{name}.glb"))
    neu = [o for o in bpy.data.objects if o not in vorher]
    wurzeln = [o for o in neu if o.parent is None]
    for o in wurzeln:
        o.location = (x, tiefe, 0)
        # leicht zur Mitte gedreht; glTF-Import: Figur schaut nach -Y
        o.rotation_euler[2] = math.radians(-12 * (1 if x > 0 else -1 if x < 0 else 0))
    for o in neu:
        if o.type == "ARMATURE" and o.animation_data:
            spur = next((s for s in o.animation_data.nla_tracks if s.name == "stand"), None)
            for s in o.animation_data.nla_tracks:
                s.mute = s is not spur
szene.frame_set(1)

# Licht: wie das Spiel — Sonne von oben links, weiches Umgebungslicht
welt = bpy.data.worlds.new("welt")
welt.use_nodes = True
welt.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.62, 0.8, 1)
welt.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
szene.world = welt
sonne = bpy.data.objects.new("sonne", bpy.data.lights.new("sonne", "SUN"))
sonne.data.energy = 3.2
sonne.rotation_euler = (math.radians(50), math.radians(-25), math.radians(-35))
szene.collection.objects.link(sonne)

kamera = bpy.data.objects.new("kamera", bpy.data.cameras.new("kamera"))
kamera.data.lens = 50
kamera.location = (0, -11.5, 2.6)
kamera.rotation_euler = (math.radians(82), 0, 0)
szene.collection.objects.link(kamera)
szene.camera = kamera

szene.render.engine = "BLENDER_EEVEE_NEXT"
szene.render.resolution_x = 1200
szene.render.resolution_y = 900
szene.render.film_transparent = True
szene.view_settings.view_transform = "Standard"
szene.render.filepath = ausgabe
bpy.ops.render.render(write_still=True)
print("[titelbild]", ausgabe)
