import fs from "node:fs";
import { homedir } from "node:os";
export const B = "https://bps.broweg.de";
export const C = "1bda9128-aa21-4ffa-9574-2cd9d194c34f";
const S = fs.readFileSync(homedir() + "/.brotool-staging-sitzung", "utf8").trim();
export const kopf = { cookie: `bro_session=${S}` };
export async function api(pfad, init = {}) {
  const r = await fetch(B + pfad, { ...init, headers: { ...kopf, "content-type": "application/json", ...(init.headers ?? {}) } });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, json: j, text: t };
}
