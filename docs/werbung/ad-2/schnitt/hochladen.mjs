import fs from "node:fs";
import { B, C, kopf } from "./api.mjs";
const datei = process.argv[2];
const fd = new FormData();
fd.append("art", "VIDEO");
fd.append("datei", new Blob([fs.readFileSync(datei)], { type: "video/mp4" }), "ad-2-drei-staedte-9x16-handschnitt.mp4");
const r = await fetch(`${B}/creatives/${C}/assets`, { method: "POST", headers: { ...kopf }, body: fd });
const t = await r.text();
console.log(r.status, t.slice(0, 600));
