# Schnelle Kontrollansicht eines Netzes (Workbench, grau): vorn und seitlich.
#   blender -b -P ansicht.py -- <netz.obj> <ausgabe-praefix> [roh]
import bpy, sys, math
a = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
if len(a) > 2 and a[2] == "roh":
    bpy.ops.wm.obj_import(filepath=a[0], forward_axis="Y", up_axis="Z")
else:
    bpy.ops.wm.obj_import(filepath=a[0])
o = bpy.context.scene.objects[0]
lo = [min(v.co[i] for v in o.data.vertices) for i in range(3)]
hi = [max(v.co[i] for v in o.data.vertices) for i in range(3)]
print("[ansicht] lo", [round(x, 3) for x in lo], "hi", [round(x, 3) for x in hi])
m = [(lo[i] + hi[i]) / 2 for i in range(3)]
s = bpy.context.scene
s.render.engine = "BLENDER_WORKBENCH"
s.render.resolution_x = s.render.resolution_y = 600
for p in o.data.polygons: p.use_smooth = True
for name, loc, rot in [("x", (m[0] + 5, m[1], m[2]), (90, 0, 90)), ("y", (m[0], m[1] - 5, m[2]), (90, 0, 0)), ("z", (m[0], m[1], m[2] + 5), (0, 0, 0))]:
    c = bpy.data.objects.new(name, bpy.data.cameras.new(name)); c.data.type = "ORTHO"
    c.data.ortho_scale = max(hi[i] - lo[i] for i in range(3)) * 1.2
    c.location = loc; c.rotation_euler = [math.radians(r) for r in rot]
    s.collection.objects.link(c); s.camera = c
    s.render.filepath = f"{a[1]}-{name}.png"; bpy.ops.render.render(write_still=True)
