import fs from "node:fs";
import { B, kopf } from "./api.mjs";
for (const a of process.argv.slice(2)) {
  const [n, id] = a.split("=");
  const r = await fetch(`${B}/creatives/assets/${id}/datei`, { headers: kopf });
  const typ = r.headers.get("content-type") ?? "";
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(`quelle/${n}`, buf);
  console.log(n, r.status, typ, buf.length);
}
