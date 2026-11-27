"""
Riggt ein KI-Modell auf das feste Pinguin-Skelett und gibt ihm die fuenf
Bewegungen der Tafelrunde. Laeuft in Blender ohne Fenster:

  blender -b -P riggen.py -- --eingang mesh.obj --ausgang figur.glb \
      [--punkte punkte.json] [--vorschau ordner] [--drehen-x 90] [--drehen-z 0]

WARUM EIN EIGENES SKELETT UND KEIN AUTO-RIGGER: Die Rig-Vorlagen der
Anbieter (Tripo, Meshy, Mixamo) sind fuer Menschen gebaut - zwei lange Arme,
zwei lange Beine, ein Hals. Ein Pinguin hat Flossen, Stummelbeine und keinen
Hals. Ein Skelett fuer alle Pinguine heisst: Die fuenf Bewegungen werden EINMAL
gebaut und passen auf jede Figur, und jede neue Figur kostet nur Rechenzeit.

Koordinaten in Blender: Z oben, die Figur schaut nach -Y (der glTF-Export
macht daraus +Z, und genau so erwartet es bildfolgen-rendern.mjs).
Die rechte Flosse der Figur liegt also bei -X.
"""

import bpy
import bmesh
import json
import math
import sys
from mathutils import Matrix, Quaternion, Vector

# ---------------------------------------------------------------------------
# Aufruf
# ---------------------------------------------------------------------------

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
opt = {}
i = 0
while i < len(argv):
    k = argv[i].lstrip("-")
    opt[k] = argv[i + 1]
    i += 2

EINGANG = opt["eingang"]
AUSGANG = opt["ausgang"]
VORSCHAU = opt.get("vorschau")
PUNKTE = json.load(open(opt["punkte"], encoding="utf-8")) if "punkte" in opt else {}

# Hoehe der fertigen Figur in Metern. Die KayKit-Figuren sind gut 1,8 hoch;
# derselbe Wert haelt den Ausschnitt des Renderers (PROBE_HALBE_HOEHE) passend.
HOEHE = 1.8
# Zielgroesse des Netzes. Marching Cubes liefert 100k+ Dreiecke; fuer ein
# Bild von 256 Pixeln reicht ein Bruchteil, und Bone Heat wird mit grossen
# Netzen langsam und scheitert oefter.
ZIEL_DREIECKE = 12000
FPS = 24

# ---------------------------------------------------------------------------
# Laden und ausrichten
# ---------------------------------------------------------------------------

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = FPS

if EINGANG.lower().endswith(".obj"):
    # Achsen roh uebernehmen: TripoSR hat schon Z oben. Die Vorgabe des
    # Importers (Y oben) legte die Figur auf die Seite.
    bpy.ops.wm.obj_import(filepath=EINGANG, forward_axis="Y", up_axis="Z")
else:
    bpy.ops.import_scene.gltf(filepath=EINGANG)

netze = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in bpy.context.scene.objects:
    o.select_set(o.type == "MESH")
bpy.context.view_layer.objects.active = netze[0]
if len(netze) > 1:
    bpy.ops.object.join()
figur = bpy.context.view_layer.objects.active
figur.name = "figur"
# Eltern und Drehungen des Imports in die Ecken einrechnen
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

drehung = Matrix.Rotation(math.radians(float(opt.get("drehen-x", 0))), 4, "X")
drehung = Matrix.Rotation(math.radians(float(opt.get("drehen-z", 0))), 4, "Z") @ drehung
figur.data.transform(drehung)

ecken = [v.co for v in figur.data.vertices]
lo = Vector((min(c.x for c in ecken), min(c.y for c in ecken), min(c.z for c in ecken)))
hi = Vector((max(c.x for c in ecken), max(c.y for c in ecken), max(c.z for c in ecken)))
faktor = HOEHE / (hi.z - lo.z)
mitte = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
figur.data.transform(Matrix.Scale(faktor, 4) @ Matrix.Translation(-mitte))
figur.data.update()

# Alle Koerper gleich gross: Die Huelle schliesst einen Stab ueber dem Kopf
# ein, und eine Figur mit hohem Stab waere sonst kleiner als eine ohne.
# `koerperhoehe` kommt aus punkte.json (punkte_auto.py); fehlt sie, gilt
# die Huelle als Koerper (Figuren ohne etwas ueber dem Kopf).
KOERPER_ZIEL = 1.8
KOERPER = float(PUNKTE.get("koerperhoehe", HOEHE))
NACHSKALIERUNG = KOERPER_ZIEL / KOERPER
if abs(NACHSKALIERUNG - 1) > 0.01:
    figur.data.transform(Matrix.Scale(NACHSKALIERUNG, 4))
    figur.data.update()
print(f"[riggen] Koerper {KOERPER:.2f} m -> {KOERPER_ZIEL} m (x{NACHSKALIERUNG:.2f})")

# Textur: TripoSR legt texture.png neben eine OBJ ohne Materialdatei.
import os
textur = os.path.join(os.path.dirname(EINGANG), "texture.png")
if EINGANG.lower().endswith(".obj") and os.path.exists(textur):
    mat = bpy.data.materials.new("figur")
    mat.use_nodes = True
    knoten = mat.node_tree.nodes
    bsdf = knoten["Principled BSDF"]
    bild = knoten.new("ShaderNodeTexImage")
    bild.image = bpy.data.images.load(textur)
    mat.node_tree.links.new(bild.outputs["Color"], bsdf.inputs["Base Color"])
    # Eingebackenes Licht steckt schon in der Farbe; matt halten, damit der
    # Renderer nicht noch einen Glanz obendrauf setzt.
    bsdf.inputs["Roughness"].default_value = 0.75
    figur.data.materials.clear()
    figur.data.materials.append(mat)

# Zusammennaehen: xatlas verdoppelt jede Ecke auf einer UV-Naht. Fuer Bone
# Heat ist das Netz dann ein Haufen loser Inseln, und es scheitert an JEDER
# Ecke (gemessen: 20021 von 20021 ohne Gewicht). Die UVs haengen an den
# Schleifen, nicht an den Ecken, und ueberleben das Zusammenfuehren.
bm = bmesh.new()
bm.from_mesh(figur.data)
vorher = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
print(f"[riggen] zusammengenaeht: {vorher} -> {len(bm.verts)} Ecken")
bm.to_mesh(figur.data)
bm.free()

# Verkleinern - nur wenn ausdruecklich verlangt: Ueber die UV-Naehte hinweg
# zerreisst es die eingebackene Textur (weisse Splitter im Kontrollbild).
dreiecke = sum(len(p.vertices) - 2 for p in figur.data.polygons)
if "verkleinern" in opt and dreiecke > ZIEL_DREIECKE:
    mod = figur.modifiers.new("verkleinern", "DECIMATE")
    mod.ratio = ZIEL_DREIECKE / dreiecke
    bpy.ops.object.modifier_apply(modifier=mod.name)

# Glatt schattieren - Marching Cubes sieht flach schattiert facettiert aus
for p in figur.data.polygons:
    p.use_smooth = True

ecken = [v.co.copy() for v in figur.data.vertices]
breite = max(abs(c.x) for c in ecken)
print(f"[riggen] Netz: {len(figur.data.polygons)} Flaechen, Breite +-{breite:.2f}, Hoehe {HOEHE}")

# ---------------------------------------------------------------------------
# Skelett
# ---------------------------------------------------------------------------

H = HOEHE


def punkt(name, vorgabe):
    """Ein Ankerpunkt: aus punkte.json, sonst die Vorgabe — beides mit der
    Koerper-Nachskalierung, damit das Skelett zum Netz passt."""
    return Vector(PUNKTE.get(name, vorgabe)) * NACHSKALIERUNG


# Vorgaben fuer einen Chibi-Pinguin in A-Haltung: grosser Kopf (obere 45 %),
# kurze Beine. Alles in Metern bei H = 1,8. Abweichende Figuren bekommen ihre
# Punkte ueber punkte.json, nicht ueber neue Zahlen hier.
P = {
    "boden": punkt("boden", (0, 0, 0)),
    "huefte": punkt("huefte", (0, 0, 0.26 * H)),
    "brust": punkt("brust", (0, 0, 0.50 * H)),
    "hals": punkt("hals", (0, 0, 0.56 * H)),
    "scheitel": punkt("scheitel", (0, 0, 1.0 * H)),
    "schulter_r": punkt("schulter_r", (-0.17 * H, 0, 0.50 * H)),
    "hand_r": punkt("hand_r", (-0.36 * H, 0, 0.36 * H)),
    "schulter_l": punkt("schulter_l", (0.17 * H, 0, 0.50 * H)),
    "hand_l": punkt("hand_l", (0.36 * H, 0, 0.36 * H)),
    "bein_r": punkt("bein_r", (-0.09 * H, 0, 0.20 * H)),
    "knoechel_r": punkt("knoechel_r", (-0.10 * H, 0, 0.05 * H)),
    "zeh_r": punkt("zeh_r", (-0.11 * H, -0.12 * H, 0.02 * H)),
    "bein_l": punkt("bein_l", (0.09 * H, 0, 0.20 * H)),
    "knoechel_l": punkt("knoechel_l", (0.10 * H, 0, 0.05 * H)),
    "zeh_l": punkt("zeh_l", (0.11 * H, -0.12 * H, 0.02 * H)),
}

arm_daten = bpy.data.armatures.new("skelett")
skelett = bpy.data.objects.new("skelett", arm_daten)
bpy.context.scene.collection.objects.link(skelett)
bpy.context.view_layer.objects.active = skelett
bpy.ops.object.mode_set(mode="EDIT")

# Name, Kopf, Schwanz, Elter. "hips" heisst so, weil bildfolgen-rendern.mjs
# die Figur an genau diesem Knochen festhaelt (ANKERKNOCHEN).
KNOCHEN = [
    ("root", P["boden"], P["boden"] + Vector((0, 0, 0.1 * H)), None),
    ("hips", P["huefte"], P["brust"], "root"),
    ("spine", P["brust"], P["hals"], "hips"),
    ("head", P["hals"], P["scheitel"], "spine"),
    ("flipper.R", P["schulter_r"], P["hand_r"], "spine"),
    ("flipper.L", P["schulter_l"], P["hand_l"], "spine"),
    ("leg.R", P["bein_r"], P["knoechel_r"], "hips"),
    ("foot.R", P["knoechel_r"], P["zeh_r"], "leg.R"),
    ("leg.L", P["bein_l"], P["knoechel_l"], "hips"),
    ("foot.L", P["knoechel_l"], P["zeh_l"], "leg.L"),
]
for name, kopf, schwanz, elter in KNOCHEN:
    b = arm_daten.edit_bones.new(name)
    b.head, b.tail = kopf, schwanz
    if elter:
        b.parent = arm_daten.edit_bones[elter]
    # root ist reiner Traeger und soll keine Ecken an sich ziehen
    b.use_deform = name != "root"
bpy.ops.object.mode_set(mode="OBJECT")


def kontrollbild(pfad, blick):
    """Orthografische Ansicht mit roten Kugeln auf den Gelenken (Workbench)."""
    kugeln = []
    for name, kopf, schwanz, _ in KNOCHEN:
        for p in (kopf, schwanz):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, location=p)
            k = bpy.context.active_object
            k.color = (1, 0, 0, 1)
            kugeln.append(k)
    szene = bpy.context.scene
    szene.render.engine = "BLENDER_WORKBENCH"
    szene.display.shading.color_type = "TEXTURE"
    szene.display.shading.show_xray = blick == "seite"
    szene.render.resolution_x = szene.render.resolution_y = 768
    szene.render.film_transparent = True
    cam_daten = bpy.data.cameras.new("kamera")
    cam_daten.type = "ORTHO"
    cam_daten.ortho_scale = HOEHE * 1.6
    cam = bpy.data.objects.new("kamera", cam_daten)
    szene.collection.objects.link(cam)
    if blick == "vorn":
        cam.location = (0, -6, HOEHE / 2)
        cam.rotation_euler = (math.radians(90), 0, 0)
    else:
        cam.location = (6, 0, HOEHE / 2)
        cam.rotation_euler = (math.radians(90), 0, math.radians(90))
    szene.camera = cam
    szene.render.filepath = pfad
    bpy.ops.render.render(write_still=True)
    for k in kugeln:
        bpy.data.objects.remove(k)
    bpy.data.objects.remove(cam)


if VORSCHAU:
    kontrollbild(f"{VORSCHAU}/kontrolle-vorn.png", "vorn")
    kontrollbild(f"{VORSCHAU}/kontrolle-seite.png", "seite")

# ---------------------------------------------------------------------------
# Gewichte
# ---------------------------------------------------------------------------

bpy.ops.object.select_all(action="DESELECT")
figur.select_set(True)
skelett.select_set(True)
bpy.context.view_layer.objects.active = skelett
bpy.ops.object.parent_set(type="ARMATURE_AUTO")

# Bone Heat scheitert lautlos: Ecken ohne Gewicht bleiben beim Bewegen im Raum
# stehen und reissen das Netz auf. Deshalb zaehlen und notfalls dem naechsten
# Knochen geben.
ohne = [v for v in figur.data.vertices if not any(g.weight > 0.001 for g in v.groups)]
print(f"[riggen] Ecken ohne Gewicht nach Bone Heat: {len(ohne)} von {len(figur.data.vertices)}")
if ohne:
    def abstand(p, a, b):
        ab = b - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
        return (a + ab * t - p).length
    segmente = [(n, k, s) for n, k, s, _ in KNOCHEN if n != "root"]
    for v in ohne:
        n = min(segmente, key=lambda seg: abstand(v.co, seg[1], seg[2]))[0]
        figur.vertex_groups[n].add([v.index], 1.0, "REPLACE")

# ---------------------------------------------------------------------------
# Bewegungen
# ---------------------------------------------------------------------------

# Weltachsen der Ruhehaltung. Vorzeichen geprueft (Rechte-Hand-Regel):
#   um +X positiv  -> oberes Ende kippt nach VORN (-Y)
#   um +Y positiv  -> rechte Flosse (bei -X) geht HOCH, linke runter
#   um +Z positiv  -> rechte Flosse schwingt nach VORN
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))

pose = skelett.pose
for pb in pose.bones:
    pb.rotation_mode = "QUATERNION"


def dreh(knochen, *teile):
    """Drehung eines Knochens aus Paaren (Weltachse, Grad), in Knochenachsen."""
    rest = skelett.data.bones[knochen].matrix_local.to_3x3().inverted()
    q = Quaternion()
    for achse, grad in teile:
        q = Quaternion(rest @ achse, math.radians(grad)) @ q
    return q


def schiebe(knochen, welt):
    rest = skelett.data.bones[knochen].matrix_local.to_3x3().inverted()
    return rest @ Vector(welt)


def bewegung(name, sekunden, bilder, schleife):
    """
    Legt eine Aktion aus Schluesselbildern an.
    bilder: {zeit_anteil: {knochen: {"r": [(achse, grad), ...], "t": (x,y,z)}}}
    Jeder Knochen, der irgendwo vorkommt, bekommt in jedem Schluesselbild einen
    Wert (fehlt er, gilt die Ruhe) - sonst haelt Blender den letzten Wert und
    die Bewegung haengt hinterher.
    """
    aktion = bpy.data.actions.new(name)
    skelett.animation_data_create()
    skelett.animation_data.action = aktion
    beteiligt = sorted({k for b in bilder.values() for k in b})
    for anteil, werte in sorted(bilder.items()):
        frame = 1 + round(anteil * sekunden * FPS)
        for k in beteiligt:
            pb = pose.bones[k]
            w = werte.get(k, {})
            pb.rotation_quaternion = dreh(k, *w.get("r", []))
            pb.location = schiebe(k, w.get("t", (0, 0, 0))) if "t" in w else Vector()
            pb.keyframe_insert("rotation_quaternion", frame=frame)
            pb.keyframe_insert("location", frame=frame)
    for kurve in aktion.fcurves:
        for kp in kurve.keyframe_points:
            kp.interpolation = "BEZIER"
            kp.easing = "AUTO"
    spur = skelett.animation_data.nla_tracks.new()
    spur.name = name
    spur.strips.new(name, 1, aktion)
    skelett.animation_data.action = None
    aktion.use_fake_user = True
    return aktion


def r(*teile):
    return {"r": list(teile)}


# stand: ruhiges Atmen, Flossen wiegen leicht. Schleife -> Ende = Anfang.
bewegung("stand", 1.6, {
    0.0: {"hips": {"t": (0, 0, 0)}, "head": r((X, 0)), "flipper.R": r((Y, 0)), "flipper.L": r((Y, 0))},
    0.5: {"hips": {"t": (0, 0, -0.015)}, "spine": r((X, 2)), "head": r((X, -3), (Y, 3)),
          "flipper.R": r((Y, 6)), "flipper.L": r((Y, -6))},
    1.0: {"hips": {"t": (0, 0, 0)}, "head": r((X, 0)), "flipper.R": r((Y, 0)), "flipper.L": r((Y, 0))},
}, True)

# lauf: Watscheln. Der Koerper rollt von Fuss zu Fuss, das jeweils freie Bein
# geht nach vorn. Auf der Stelle - der Renderer haelt die Huefte fest.
lauf = {}
for anteil, seite in [(0.0, 1), (0.25, 0), (0.5, -1), (0.75, 0), (1.0, 1)]:
    lauf[anteil] = {
        "hips": {"r": [(Y, 9 * seite)], "t": (0, 0, 0.02 * abs(seite) - 0.01)},
        "spine": r((Y, -3 * seite), (X, 4)),
        "head": r((Y, -4 * seite)),
        "leg.R": r((X, -18 * seite), (Y, 4 * max(seite, 0))),
        "leg.L": r((X, 18 * seite), (Y, 4 * min(seite, 0))),
        "flipper.R": r((Y, 10 + 8 * seite), (Z, 8 * seite)),
        "flipper.L": r((Y, -10 + 8 * seite), (Z, 8 * seite)),
    }
bewegung("lauf", 0.8, lauf, True)

# schlag: rechte Flosse (Schwert) holt hoch und hinten aus und schlaegt nach
# vorn unten durch; der Oberkoerper dreht mit.
bewegung("schlag", 0.75, {
    0.0: {},
    0.35: {"spine": r((Z, -18), (X, -6)), "head": r((Z, 6)),
           "flipper.R": r((Y, 95), (Z, -35)), "flipper.L": r((Y, -15)),
           "hips": {"r": [(Z, -6)]}},
    0.55: {"spine": r((Z, 22), (X, 14)), "head": r((Z, -8), (X, 4)),
           "flipper.R": r((Y, -5), (Z, 70)), "flipper.L": r((Y, -25), (Z, -10)),
           "hips": {"r": [(Z, 8)]}},
    0.7: {"spine": r((Z, 18), (X, 10)), "flipper.R": r((Y, -10), (Z, 60)),
          "hips": {"r": [(Z, 6)]}},
    1.0: {},
}, False)

# getroffen: Rueckstoss nach hinten, Kopf und Flossen fliegen hoch.
bewegung("getroffen", 0.6, {
    0.0: {},
    0.3: {"hips": {"r": [(X, -10)], "t": (0, 0.06, 0)}, "spine": r((X, -12)), "head": r((X, -15), (Y, 8)),
          "flipper.R": r((Y, 35)), "flipper.L": r((Y, -35))},
    1.0: {},
}, False)

# tod: kippt rueckwaerts auf den Ruecken, Fuesse hoch, Flossen fallen.
bewegung("tod", 1.3, {
    0.0: {},
    0.2: {"hips": {"r": [(X, -12)]}, "head": r((X, -10)),
          "flipper.R": r((Y, 40)), "flipper.L": r((Y, -40))},
    0.65: {"root": {"r": [(X, -95)], "t": (0, 0.35, 0.1)}, "head": r((X, -15)),
           "flipper.R": r((Y, 70)), "flipper.L": r((Y, -70)),
           "leg.R": r((X, -25)), "leg.L": r((X, -30))},
    0.8: {"root": {"r": [(X, -88)], "t": (0, 0.38, 0.12)}, "head": r((X, -5)),
          "flipper.R": r((Y, 60)), "flipper.L": r((Y, -60)),
          "leg.R": r((X, -15)), "leg.L": r((X, -20))},
    1.0: {"root": {"r": [(X, -90)], "t": (0, 0.38, 0.1)}, "head": r((X, 0)),
          "flipper.R": r((Y, 55)), "flipper.L": r((Y, -55)),
          "leg.R": r((X, 0)), "leg.L": r((X, 0))},
}, False)

# ---------------------------------------------------------------------------
# Ausgabe
# ---------------------------------------------------------------------------

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=AUSGANG,
    export_format="GLB",
    use_selection=False,
    export_animation_mode="NLA_TRACKS",
    export_force_sampling=True,
    # Alle Knochen mit: root verformt nichts, traegt aber den Sturz beim Tod.
    export_def_bones=False,
    export_yup=True,
)
print(f"[riggen] geschrieben: {AUSGANG}")

if VORSCHAU:
    bpy.ops.wm.save_as_mainfile(filepath=f"{VORSCHAU}/figur.blend")
