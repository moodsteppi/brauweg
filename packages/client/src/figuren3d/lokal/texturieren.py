"""
Faerbt eine TripoSG-Form ein: vorn das Konzeptbild, scharf projiziert, der
Rest aus dem Farbfeld von TripoSR. Beides MIT, beides lokal.

  python texturieren.py <konzept.png> <triposr-eingang.png> <form.obj> <ausgabe-ordner>

WARUM ZWEI QUELLEN: TripoSG liefert nur die Form. TripoSR kann zu JEDEM Punkt
im Raum eine Farbe sagen, aber unscharf (die Gesichter verschmieren). Das
Konzeptbild ist scharf, zeigt aber nur die Vorderseite. Also: Was von vorn zu
sehen ist und nach vorn zeigt, bekommt die Farbe des Konzeptbilds; Seiten,
Rueckseite und Verdecktes bekommen die Farbe von TripoSR, mit weichem
Uebergang.

Koordinaten: Ausgegeben wird im Rahmen von TripoSR (Z oben, Gesicht nach +X,
rechte Flosse der Figur bei -Y), damit riggen.py dieselben Schalter nimmt.
TripoSG liefert Y oben, Gesicht nach +Z, rechte Flosse bei -X.
"""
import os
import sys
import time
from types import SimpleNamespace

import moderngl
import numpy as np
import torch
import trimesh
import xatlas
from PIL import Image

WERK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(WERK, "TripoSR"))
from tsr.system import TSR  # noqa: E402
from tsr.bake_texture import make_atlas, rasterize_position_atlas, positions_to_colors  # noqa: E402

konzept_pfad, eingang_pfad, form_pfad, ziel = sys.argv[1:5]
AUFLOESUNG = 2048
os.makedirs(ziel, exist_ok=True)
t0 = time.time()

# --- Form in den Rahmen von TripoSR bringen --------------------------------
form = trimesh.load(form_pfad, process=False, force="mesh")
v = form.vertices
form = trimesh.Trimesh(np.stack([v[:, 2], v[:, 0], v[:, 1]], axis=1), form.faces, process=True)

modell = TSR.from_pretrained("stabilityai/TripoSR", config_name="config.yaml", weight_name="model.ckpt")
modell.renderer.set_chunk_size(8192)
modell.to("cuda")
eingang = Image.open(eingang_pfad).convert("RGB")
with torch.no_grad():
    code = modell([eingang], device="cuda")
sr = modell.extract_mesh(code, True, resolution=256)[0]

# Kastenweise angleichen: Beide Netze kommen aus demselben Bild, ihre Huellen
# entsprechen sich. Je Achse eigener Massstab, weil TripoSR in der Tiefe
# gern etwas duenner ausfaellt.
lo_f, hi_f = form.bounds
lo_s, hi_s = sr.bounds
form.vertices = lo_s + (form.vertices - lo_f) / (hi_f - lo_f) * (hi_s - lo_s)
print(f"[texturieren] Form {len(form.vertices)} Ecken, angeglichen an TripoSR-Huelle {np.round(hi_s - lo_s, 3)}")

# --- Atlas, Ort und Richtung je Texel --------------------------------------
polster = round(max(2, AUFLOESUNG / 256))
atlas = make_atlas(form, AUFLOESUNG, polster)
orte = rasterize_position_atlas(form, atlas["vmapping"], atlas["indices"], atlas["uvs"], AUFLOESUNG, polster)
normalen_netz = SimpleNamespace(vertices=np.asarray(form.vertex_normals))
richtungen = rasterize_position_atlas(normalen_netz, atlas["vmapping"], atlas["indices"], atlas["uvs"], AUFLOESUNG, polster)
belegt = orte[..., 3] > 0

# --- Farbe 1: TripoSR ------------------------------------------------------
farbe_sr = positions_to_colors(modell, code[0], orte, AUFLOESUNG)[..., :3]

# --- Farbe 2: das Konzeptbild von vorn -------------------------------------
konzept = np.asarray(Image.open(konzept_pfad).convert("RGBA")).astype(np.float32) / 255.0
alpha = konzept[..., 3]
zeilen = np.where(alpha.max(axis=1) > 0.5)[0]
spalten = np.where(alpha.max(axis=0) > 0.5)[0]
v0, v1, u0, u1 = zeilen[0], zeilen[-1], spalten[0], spalten[-1]
lo, hi = form.bounds  # Y: links->rechts im Bild, Z: oben


def ins_bild(p):
    u = u0 + (p[..., 1] - lo[1]) / (hi[1] - lo[1]) * (u1 - u0)
    w = v0 + (hi[2] - p[..., 2]) / (hi[2] - lo[2]) * (v1 - v0)
    return u, w


# Tiefenbild von vorn: Welcher Punkt ist an jeder Bildstelle der vorderste?
# Ohne das bekaeme der Bauch hinter dem Schild die Farbe des Schildes.
H, B = konzept.shape[:2]
ctx = moderngl.create_context(standalone=True)
prog = ctx.program(
    vertex_shader="""
        #version 330
        uniform vec2 u_lo; uniform vec2 u_hi; uniform vec2 u_x; uniform vec4 u_bild;
        in vec3 in_pos; out float v_x;
        void main() {
            float u = u_bild.x + (in_pos.y - u_lo.x) / (u_hi.x - u_lo.x) * (u_bild.y - u_bild.x);
            float w = u_bild.z + (u_hi.y - in_pos.z) / (u_hi.y - u_lo.y) * (u_bild.w - u_bild.z);
            v_x = in_pos.x;
            float tiefe = 1.0 - 2.0 * (in_pos.x - u_x.x) / (u_x.y - u_x.x);
            gl_Position = vec4(u / u_bild_size().x * 2.0 - 1.0, 1.0 - w / u_bild_size().y * 2.0, tiefe * 0.99, 1.0);
        }
    """.replace("u_bild_size()", "vec2(%d.0, %d.0)" % (B, H)),
    fragment_shader="""
        #version 330
        in float v_x; out vec4 o; void main() { o = vec4(v_x, 0.0, 0.0, 1.0); }
    """,
)
prog["u_lo"].value = (lo[1], lo[2])
prog["u_hi"].value = (hi[1], hi[2])
prog["u_x"].value = (lo[0] - 0.01, hi[0] + 0.01)
prog["u_bild"].value = (float(u0), float(u1), float(v0), float(v1))
vbo = ctx.buffer(form.vertices[form.faces].reshape(-1, 3).astype("f4"))
vao = ctx.vertex_array(prog, [(vbo, "3f", "in_pos")])
fbo = ctx.framebuffer(color_attachments=[ctx.texture((B, H), 4, dtype="f4")], depth_attachment=ctx.depth_texture((B, H)))
fbo.use()
fbo.clear(0, 0, 0, 0, depth=1.0)
ctx.enable(moderngl.DEPTH_TEST)
vao.render()
vorne = np.frombuffer(fbo.color_attachments[0].read(), dtype="f4").reshape(H, B, 4)
vorne_x = np.where(vorne[..., 3] > 0, vorne[..., 0], -np.inf)
# Zeilen kommen aus OpenGL von unten nach oben
vorne_x = vorne_x[::-1]

p = orte[..., :3]
u, w = ins_bild(p)
ui = np.clip(np.round(u).astype(int), 0, B - 1)
wi = np.clip(np.round(w).astype(int), 0, H - 1)
spanne = hi[0] - lo[0]
sichtbar = p[..., 0] >= vorne_x[wi, ui] - 0.015 * spanne
nx = richtungen[..., 0] / np.maximum(np.linalg.norm(richtungen[..., :3], axis=-1), 1e-6)
gewicht = np.clip((nx - 0.15) / 0.35, 0, 1) * sichtbar * alpha[wi, ui] * belegt
farbe_bild = konzept[wi, ui, :3]
farbe = farbe_bild * gewicht[..., None] + farbe_sr * (1 - gewicht[..., None])
print(f"[texturieren] Anteil aus dem Konzeptbild: {gewicht[belegt].mean() * 100:.0f} % der Texel")

# --- Ausgabe wie TripoSR: OBJ mit UV, texture.png daneben ------------------
xatlas.export(
    os.path.join(ziel, "mesh.obj"),
    form.vertices[atlas["vmapping"]],
    atlas["indices"],
    atlas["uvs"],
    form.vertex_normals[atlas["vmapping"]],
)
bild = np.concatenate([farbe, belegt[..., None].astype(np.float32)], axis=-1)
Image.fromarray((np.clip(bild, 0, 1) * 255).astype(np.uint8)).transpose(Image.FLIP_TOP_BOTTOM).save(
    os.path.join(ziel, "texture.png")
)
print(f"[texturieren] fertig in {time.time() - t0:.0f} s")
