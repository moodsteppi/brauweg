"""
Form aus dem Konzeptbild mit TripoSG (MIT), lokal.

  python triposg_lauf.py <konzept.png> <ausgabe.obj> [--flaechen 80000] [--seed 42]

Bewusst OHNE RMBG-1.4: Das Gewicht zum Freistellen steht unter einer
nicht-kommerziellen Lizenz, und codex liefert ohnehin echtes Alpha. Ohne
Flash-Decoder (der braucht `diso`, das sich unter Windows ohne CUDA-Compiler
nicht bauen laesst); die hierarchische Extraktion mit skimage ist langsamer,
liefert aber dieselbe Form.
"""
import argparse
import os
import sys
import time

import numpy as np
import torch
import trimesh
from huggingface_hub import snapshot_download

WERK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SG = os.path.join(WERK, "TripoSG")
sys.path.insert(0, SG)
sys.path.insert(0, os.path.join(SG, "scripts"))

from triposg.pipelines.pipeline_triposg import TripoSGPipeline  # noqa: E402
from image_process import prepare_image  # noqa: E402

a = argparse.ArgumentParser()
a.add_argument("bild")
a.add_argument("ausgabe")
a.add_argument("--flaechen", type=int, default=80000)
a.add_argument("--seed", type=int, default=42)
a.add_argument("--schritte", type=int, default=50)
a.add_argument("--tiefe", type=int, default=8, help="Octree-Tiefe der Extraktion (8 = 256er Gitter)")
args = a.parse_args()

t0 = time.time()
gewichte = os.path.join(WERK, "gewichte", "TripoSG")
snapshot_download(repo_id="VAST-AI/TripoSG", local_dir=gewichte)
pipe = TripoSGPipeline.from_pretrained(gewichte).to("cuda", torch.float16)

bild = prepare_image(args.bild, bg_color=np.array([1.0, 1.0, 1.0]), rmbg_net=None)
aus = pipe(
    image=bild,
    generator=torch.Generator(device="cuda").manual_seed(args.seed),
    num_inference_steps=args.schritte,
    guidance_scale=7.0,
    use_flash_decoder=False,
    hierarchical_octree_depth=args.tiefe,
).samples[0]
netz = trimesh.Trimesh(aus[0].astype(np.float32), np.ascontiguousarray(aus[1]))

if len(netz.faces) > args.flaechen:
    import pymeshlab
    ms = pymeshlab.MeshSet()
    ms.add_mesh(pymeshlab.Mesh(vertex_matrix=netz.vertices, face_matrix=netz.faces))
    ms.meshing_merge_close_vertices()
    ms.meshing_decimation_quadric_edge_collapse(targetfacenum=args.flaechen)
    m = ms.current_mesh()
    netz = trimesh.Trimesh(m.vertex_matrix(), m.face_matrix())

netz.export(args.ausgabe)
print(f"[triposg] {len(netz.vertices)} Ecken, {len(netz.faces)} Flaechen, {time.time() - t0:.0f} s, "
      f"Spitze {torch.cuda.max_memory_allocated() / 2**30:.1f} GB")
