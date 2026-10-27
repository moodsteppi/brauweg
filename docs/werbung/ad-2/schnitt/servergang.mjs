import { api, C } from "./api.mjs";
const q = process.argv[2];
const r = await api(`/creatives/${C}/schnitt`, { method: "POST", body: JSON.stringify({ quelleAssetId: q, format: "9:16", abschnitte: [{ assetId: q, vonMs: 0, bisMs: 28000 }], untertitel: false, kiKennzeichnung: true }) });
console.log(r.status, r.text.slice(0, 400));
const id = r.json?.id ?? r.json?.schnitt?.id ?? r.json?.auftragId;
for (let i = 0; i < 60 && id; i++) {
  await new Promise(s => setTimeout(s, 5000));
  const s = await api(`/creatives/schnitt/${id}`);
  const st = s.json?.status ?? s.json?.schnitt?.status;
  console.log(i, st);
  if (!/LAEUFT|WARTET|OFFEN|PENDING|RUNNING/i.test(String(st))) { console.log(s.text.slice(0, 1200)); break; }
}
